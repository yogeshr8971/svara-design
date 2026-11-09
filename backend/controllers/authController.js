import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Seller from '../models/Seller.js';
import Session from '../models/Session.js';
import Otp from '../models/Otp.js';
import CreditBalance from '../models/CreditBalance.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { normalizePhone, maskEmail, maskPhone } from '../utils/phone.js';
import { createSession, clearAuthCookie, signSessionToken } from '../utils/session.js';
import { issueOtp, verifyOtp } from '../services/otpService.js';
import { addBonusCredits, getDefaultCreditsForRole, ensureCreditBalance, getBalance } from '../services/creditService.js';
import { notifyAdmins } from '../services/notificationService.js';
import { sendPasswordResetConfirmationEmail } from '../services/emailService.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LOGIN_OTP_ENABLED = () => process.env.LOGIN_EMAIL_OTP !== 'false';

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isRootAdmin: Boolean(user.isRootAdmin),
  isBlocked: Boolean(user.isBlocked),
  businessName: user.businessName,
  businessAddress: user.businessAddress,
  gstNumber: user.gstNumber,
  sellerDescription: user.sellerDescription,
  sellerStatus: user.sellerStatus,
  rejectionReason: user.rejectionReason,
  phone: user.phone,
  emailVerified: user.emailVerified,
  phoneVerified: user.phoneVerified,
  profileImage: user.profileImage,
  addresses: user.addresses || [],
  createdAt: user.createdAt,
});

const startSession = async (user, req, res, status, extra = {}) => {
  const creditRecord = await ensureCreditBalance(user._id, user.role);
  const sid = await createSession(user, req, res);
  const token = signSessionToken(user._id, sid);
  res.status(status).json({ success: true, token, user: publicUser(user), credits: creditRecord?.balance ?? 0, ...extra });
};

const normEmail = (e) => String(e || '').toLowerCase().trim();

// ---------------------------------------------------------------------------
// Registration (customers + sellers share the same verified flow)
// 1) POST register  -> account created UNVERIFIED, codes sent to email + phone
// 2) POST register/verify -> both codes confirmed -> session issued
// ---------------------------------------------------------------------------
const beginRegistration = async ({ role, body }) => {
  const { name, password } = body;
  const email = normEmail(body.email);
  const phone = normalizePhone(body.phone);

  if (!name?.trim() || !email || !password) throw new ApiError(400, 'Name, email and password are required.', 'VALIDATION_ERROR');
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Please enter a valid email address.', 'VALIDATION_ERROR');
  if (!phone) throw new ApiError(400, 'A valid 10-digit mobile number is required.', 'VALIDATION_ERROR');
  if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters long.', 'VALIDATION_ERROR');

  const existingEmail = await User.findOne({ email });
  if (existingEmail?.emailVerified) throw new ApiError(409, 'An account with this email address already exists.', 'EMAIL_EXISTS');

  const phoneOwner = await User.findOne({ phone, phoneVerified: true });
  if (phoneOwner && (!existingEmail || phoneOwner._id.toString() !== existingEmail._id.toString())) {
    throw new ApiError(409, 'This mobile number is already registered.', 'PHONE_EXISTS');
  }

  const fields = {
    name: name.trim(), email, phone, role,
    emailVerified: false, phoneVerified: false,
    ...(role === 'seller'
      ? {
          businessName: body.businessName?.trim(), businessAddress: body.businessAddress || '',
          gstNumber: body.gstNumber || '', sellerDescription: body.sellerDescription || '', sellerStatus: 'pending',
        }
      : { sellerStatus: 'none' }),
  };

  let user;
  if (existingEmail) {
    // Unverified leftover from an abandoned sign-up: let the person start over.
    Object.assign(existingEmail, fields, { password });
    user = await existingEmail.save();
  } else {
    user = await User.create({ ...fields, password });
  }
  return user;
};

const sendRegistrationCodes = async (user) => {
  await issueOtp({ identifier: user.email, channel: 'email', purpose: 'register', userId: user._id });
  await issueOtp({ identifier: user.phone, channel: 'sms', purpose: 'register', userId: user._id });
};

const registrationResponse = (res, user, message) =>
  res.status(202).json({
    success: true,
    verificationRequired: true,
    email: user.email,
    maskedEmail: maskEmail(user.email),
    maskedPhone: maskPhone(user.phone),
    message,
  });

export const registerCustomer = asyncHandler(async (req, res) => {
  const user = await beginRegistration({ role: 'user', body: req.body });
  await sendRegistrationCodes(user);
  registrationResponse(res, user, 'We sent a code to your email and your mobile number.');
});

export const registerSeller = asyncHandler(async (req, res) => {
  if (!req.body.businessName?.trim()) {
    throw new ApiError(400, 'Store or Business Name is required for seller registration.', 'VALIDATION_ERROR');
  }
  const user = await beginRegistration({ role: 'seller', body: req.body });
  await sendRegistrationCodes(user);
  // Seller profile is created now (pending) so bank details aren't lost; it stays inactive until verified + approved.
  await Seller.findOneAndUpdate(
    { userId: user._id },
    {
      userId: user._id, name: user.name, email: user.email, businessName: user.businessName,
      businessAddress: user.businessAddress, gstNumber: user.gstNumber, sellerDescription: user.sellerDescription,
      sellerStatus: 'pending', phone: user.phone, bankDetails: req.body.bankDetails || {},
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  registrationResponse(res, user, 'We sent a code to your email and your mobile number.');
});

export const verifyRegistration = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const { emailOtp, phoneOtp } = req.body;
  if (!email || !emailOtp || !phoneOtp) throw new ApiError(400, 'Enter both the email code and the mobile code.', 'VALIDATION_ERROR');

  const user = await User.findOne({ email });
  if (!user || user.emailVerified) throw new ApiError(400, 'Nothing to verify for this email. Please register again.', 'NOT_PENDING');

  // Verify both before consuming either success state, so a typo in one doesn't burn the other.
  await verifyOtp({ identifier: user.email, purpose: 'register', code: emailOtp });
  try {
    await verifyOtp({ identifier: user.phone, purpose: 'register', code: phoneOtp });
  } catch (err) {
    // Email code was consumed; mark it so the user only needs to fix the phone code.
    user.emailVerified = true;
    await user.save();
    throw err;
  }

  user.emailVerified = true;
  user.phoneVerified = true;
  await user.save();

  await ensureCreditBalance(user._id, user.role);
  if (user.role === 'seller') {
    notifyAdmins('seller_status', 'New seller awaiting approval', `${user.businessName} (${user.email}) has registered and needs review.`, { link: '/admin' }).catch(() => {});
  }

  await startSession(user, req, res, 201, { message: user.role === 'seller' ? 'Verified. Your seller account is pending admin approval.' : 'Account verified. Welcome to SVARA!' });
});

/** Partial-verification retry (e.g. only the phone code was wrong). */
export const resendRegistrationOtp = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const channel = req.body.channel === 'sms' ? 'sms' : 'email';
  const user = await User.findOne({ email });
  if (!user || (user.emailVerified && user.phoneVerified)) throw new ApiError(400, 'Nothing to verify for this email.', 'NOT_PENDING');
  await issueOtp({ identifier: channel === 'email' ? user.email : user.phone, channel, purpose: 'register', userId: user._id });
  res.json({ success: true, message: `A new code was sent to your ${channel === 'email' ? 'email' : 'mobile'}.` });
});

// ---------------------------------------------------------------------------
// Login: password check -> email OTP -> long-lived session (until logout)
// ---------------------------------------------------------------------------
const checkPassword = async (req, allowedRoles) => {
  const email = normEmail(req.body.email);
  const { password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.', 'VALIDATION_ERROR');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }
  if (user.isDeleted) {
    throw new ApiError(401, 'This account has been deleted.', 'ACCOUNT_DELETED');
  }
  if (user.isBlocked) {
    throw new ApiError(403, `Your account has been suspended or blocked${user.blockedReason ? `: ${user.blockedReason}` : ''}. Please contact support.`, 'ACCOUNT_BLOCKED');
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new ApiError(403, 'This account is registered as a customer. Please use the Customer Sign-in or register as a Seller.', 'NOT_SELLER_ACCOUNT');
  }
  if (user.role === 'seller' && user.sellerStatus === 'suspended') {
    throw new ApiError(403, `Your seller account has been suspended${user.suspensionReason ? `: ${user.suspensionReason}` : ''}. Please contact support.`, 'SELLER_SUSPENDED');
  }
  return user;
};

const beginLogin = (allowedRoles) =>
  asyncHandler(async (req, res) => {
    const user = await checkPassword(req, allowedRoles);

    if (!user.emailVerified || (user.role !== 'admin' && user.phone && !user.phoneVerified && user.createdAt > new Date(process.env.PHONE_VERIFY_AFTER || '2000-01-01'))) {
      // Unfinished sign-up: resume verification instead of logging in.
      await sendRegistrationCodes(user).catch(() => {});
      return res.status(403).json({
        success: false, code: 'VERIFICATION_REQUIRED', verificationRequired: true,
        email: user.email, maskedEmail: maskEmail(user.email), maskedPhone: maskPhone(user.phone),
        message: 'Please finish verifying your email and mobile number. We re-sent your codes.',
      });
    }

    if (!LOGIN_OTP_ENABLED()) return startSession(user, req, res, 200);

    await issueOtp({ identifier: user.email, channel: 'email', purpose: 'login', userId: user._id });
    res.status(202).json({ success: true, otpRequired: true, email: user.email, maskedEmail: maskEmail(user.email), message: 'We emailed you a sign-in code.' });
  });

export const loginCustomer = beginLogin(null);
export const loginSeller = beginLogin(['seller', 'admin']);
export const login = beginLogin(null);

export const verifyLogin = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  if (!email || !req.body.otp) throw new ApiError(400, 'Enter the code we emailed you.', 'VALIDATION_ERROR');
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, 'Invalid code.', 'OTP_INVALID');
  await verifyOtp({ identifier: user.email, purpose: 'login', code: req.body.otp });
  await startSession(user, req, res, 200);
});

export const resendLoginOtp = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: normEmail(req.body.email) });
  // Same response whether or not the account exists (no user enumeration).
  if (user?.emailVerified) await issueOtp({ identifier: user.email, channel: 'email', purpose: 'login', userId: user._id });
  res.json({ success: true, message: 'If the account exists, a new code is on its way.' });
});

export const register = asyncHandler(async (req, res) => {
  if (req.body.role && req.body.role !== 'user') {
    throw new ApiError(400, 'Use the dedicated seller registration flow to create a seller account.', 'SELLER_REGISTRATION_ROUTE_REQUIRED');
  }
  return registerCustomer(req, res);
});

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------
export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (token) {
    const decoded = jwt.decode(token);
    if (decoded?.sid) await Session.deleteOne({ sid: decoded.sid });
  }
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out successfully.' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  await Session.deleteMany({ userId: req.user._id });
  clearAuthCookie(res);
  res.json({ success: true, message: 'Signed out of all devices.' });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(401, 'User session is invalid.', 'USER_NOT_FOUND');
  const credits = await getBalance(req.user._id, user.role);
  const sellerProfile = user.role === 'seller' ? await Seller.findOne({ userId: user._id }) : null;
  res.json({
    success: true,
    user: publicUser(user),
    seller: sellerProfile,
    credits: credits ? credits.balance : 0,
    reservedCredits: credits ? credits.reservedBalance : 0,
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, profileImage, addresses } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (profileImage !== undefined) updates.profileImage = profileImage;
  if (addresses !== undefined && Array.isArray(addresses)) updates.addresses = addresses;
  // Phone/email changes require re-verification and are intentionally not editable here.
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ success: true, message: 'Profile updated successfully.', user: publicUser(user) });
});

// ---------------------------------------------------------------------------
// Password Reset Flow (3-Minute Expiry Code)
// ---------------------------------------------------------------------------

/** Request a password reset code. Returns identical response whether email exists or not to prevent user enumeration. */
export const forgotPassword = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  if (!email || !EMAIL_RE.test(email)) {
    throw new ApiError(400, 'A valid email address is required.', 'VALIDATION_ERROR');
  }

  const user = await User.findOne({ email });
  if (user && user.emailVerified && !user.isDeleted && !user.isBlocked) {
    await issueOtp({ identifier: user.email, channel: 'email', purpose: 'password-reset', userId: user._id });
  }

  res.status(200).json({
    success: true,
    maskedEmail: maskEmail(email),
    message: 'If an account exists with this email, a 6-digit verification code expiring in 3 minutes has been sent.',
  });
});

/** Verify password reset code and apply new password. Accepts { email, code, password } or { email, otp, newPassword }. Invalidates code immediately upon success. */
export const resetPassword = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const code = String(req.body.code || req.body.otp || '').trim();
  const password = req.body.password || req.body.newPassword;

  if (!email || !code || !password) {
    throw new ApiError(400, 'Email, verification code, and new password are required.', 'VALIDATION_ERROR');
  }

  if (password.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters long.', 'VALIDATION_ERROR');
  }

  const user = await User.findOne({ email });
  if (!user || user.isDeleted) {
    throw new ApiError(400, 'Invalid verification code or email.', 'INVALID_CODE');
  }

  if (user.isBlocked) {
    throw new ApiError(403, 'Account is suspended or blocked. Cannot reset password.', 'ACCOUNT_BLOCKED');
  }

  // Verifies hash, checks 3-minute expiry, deletes code on success (single-use)
  await verifyOtp({ identifier: user.email, purpose: 'password-reset', code });

  // Update password (pre-save hook will bcrypt hash it)
  user.password = password;
  await user.save();

  // Invalidate all active sessions for security
  await Session.deleteMany({ userId: user._id });
  clearAuthCookie(res);

  // Send confirmation email
  sendPasswordResetConfirmationEmail(user.email, user.name).catch(() => {});

  res.status(200).json({
    success: true,
    message: 'Password reset successful. Please sign in with your new password.',
  });
});

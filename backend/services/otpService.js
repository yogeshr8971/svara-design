import crypto from 'crypto';
import Otp from '../models/Otp.js';
import { ApiError } from '../utils/apiError.js';
import { sendOtpEmail } from './emailService.js';
import { sendOtpSms } from './smsService.js';

/** Verification codes expire after exactly 3 minutes (180 seconds). */
const OTP_TTL_MS = 3 * 60 * 1000;
/** Minimum wait between resend requests. */
const RESEND_COOLDOWN_MS = 30 * 1000;
/** Maximum incorrect attempts before the code is invalidated. */
const MAX_ATTEMPTS = 5;

const secret = () => process.env.OTP_SECRET || process.env.JWT_SECRET;
const hash = (identifier, purpose, code) =>
  crypto.createHmac('sha256', secret()).update(`${identifier}|${purpose}|${code}`).digest('hex');
const generate = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

/** Create (or replace) an OTP and deliver it. Enforces a resend cool-down and invalidates old codes. */
export const issueOtp = async ({ identifier, channel, purpose, userId }) => {
  const existing = await Otp.findOne({ identifier, purpose });
  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime())) / 1000);
    throw new ApiError(429, `Please wait ${wait}s before requesting another code.`, 'OTP_COOLDOWN');
  }

  const code = generate();
  // Atomically replace any prior code for this identifier + purpose (old code invalidation)
  await Otp.findOneAndUpdate(
    { identifier, purpose },
    {
      identifier,
      channel,
      purpose,
      userId,
      codeHash: hash(identifier, purpose, code),
      attempts: 0,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    if (channel === 'email') await sendOtpEmail(identifier, code, purpose);
    else await sendOtpSms(identifier, code);
  } catch (err) {
    await Otp.deleteOne({ identifier, purpose });
    console.error(`[otp] ${channel} delivery failed:`, err.message);
    throw new ApiError(502, `We couldn't send the code to your ${channel === 'email' ? 'email' : 'phone'}. Please try again shortly.`, 'OTP_DELIVERY_FAILED');
  }
};

/** Verify and consume an OTP. Enforces single-use by deleting upon verification. Throws ApiError on any failure. */
export const verifyOtp = async ({ identifier, purpose, code }) => {
  const record = await Otp.findOne({ identifier, purpose });
  if (!record || record.expiresAt < new Date()) {
    throw new ApiError(400, 'This code has expired. Please request a new one.', 'OTP_EXPIRED');
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: record._id });
    throw new ApiError(429, 'Too many incorrect attempts. Please request a new code.', 'OTP_LOCKED');
  }

  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(hash(identifier, purpose, String(code || '').trim()), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    record.attempts += 1;
    await record.save();
    throw new ApiError(400, `Incorrect code. ${MAX_ATTEMPTS - record.attempts} attempt(s) left.`, 'OTP_INVALID');
  }
  await Otp.deleteOne({ _id: record._id }); // Single-use consumption
  return record;
};

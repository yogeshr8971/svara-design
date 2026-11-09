import express from 'express';
import {
  register, login, registerCustomer, loginCustomer, registerSeller, loginSeller,
  verifyRegistration, resendRegistrationOtp, verifyLogin, resendLoginOtp,
  forgotPassword, resetPassword,
  logout, logoutAll, getMe, updateProfile,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter, registerLimiter, otpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Registration (email + phone verification)
router.post('/register', registerLimiter, register);
router.post('/customer/register', registerLimiter, registerCustomer);
router.post('/seller/register', registerLimiter, registerSeller);
router.post('/register/verify', otpLimiter, verifyRegistration);
router.post('/register/resend', otpLimiter, resendRegistrationOtp);

// Login (password -> email OTP)
router.post('/login', authLimiter, login);
router.post('/customer/login', authLimiter, loginCustomer);
router.post('/seller/login', authLimiter, loginSeller);
router.post('/login/verify', otpLimiter, verifyLogin);
router.post('/login/resend', otpLimiter, resendLoginOtp);

// Password Reset (60-second code expiry)
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/reset-password', otpLimiter, resetPassword);

// Session & profile
router.post('/logout', logout);
router.post('/logout-all', protect, logoutAll);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

export default router;

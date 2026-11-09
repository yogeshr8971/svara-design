import rateLimit from 'express-rate-limit';

// Key generator that handles proxy IP correctly
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown-ip'
  );
};

// 1. Public catalog (products, categories, curate categories, general browsing)
export const catalogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1200, // Generous allowance for fast catalog navigation and asset loading
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    success: false,
    code: 'RATE_LIMIT_CATALOG',
    message: 'Catalog browsing rate limit reached. Please wait a moment and refresh.',
  },
});

// 2. Authentication Login (protects against credential brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 attempts per 15 minutes per IP
  skipSuccessfulRequests: true, // Do not penalize successful logins
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    success: false,
    code: 'RATE_LIMIT_AUTH',
    message: 'Too many unsuccessful login attempts. Please try again in 15 minutes.',
  },
});

// 3. User Registration
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 registrations per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    success: false,
    code: 'RATE_LIMIT_REGISTER',
    message: 'Too many account registrations from this network. Please try again later.',
  },
});

// 3b. OTP verification / resend (stops code guessing and SMS/email bombing)
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: { success: false, code: 'RATE_LIMIT_OTP', message: 'Too many verification attempts. Please try again in a few minutes.' },
});

// 4. Checkout and Payment creation
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || getClientIp(req),
  message: {
    success: false,
    code: 'RATE_LIMIT_CHECKOUT',
    message: 'Order creation rate limit reached. Please wait a moment before trying again.',
  },
});

// 5. Virtual Try-On Generation
export const vtoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 40, // 40 AI generations per hour per user/IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || getClientIp(req),
  message: {
    success: false,
    code: 'RATE_LIMIT_VTO',
    message: 'Virtual try-on generation limit reached. Please try again in a little while.',
  },
});

// 6. Admin operations
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || getClientIp(req),
  message: {
    success: false,
    code: 'RATE_LIMIT_ADMIN',
    message: 'Admin API request limit reached. Please pause for a moment.',
  },
});

// 7. Seller operations
export const sellerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || getClientIp(req),
  message: {
    success: false,
    code: 'RATE_LIMIT_SELLER',
    message: 'Seller Studio API request limit reached. Please pause for a moment.',
  },
});

// 8. Payment Webhooks (must never be starved by customer traffic)
export const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 800,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    success: false,
    code: 'RATE_LIMIT_WEBHOOK',
    message: 'Webhook rate limit exceeded.',
  },
});

// General fallback limiter with high threshold
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    success: false,
    code: 'RATE_LIMIT_GENERAL',
    message: 'Too many requests, please try again shortly.',
  },
});

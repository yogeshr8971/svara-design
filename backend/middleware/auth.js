import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { SESSION_MS, setAuthCookie, clearAuthCookie, signSessionToken } from '../utils/session.js';

const extractToken = (req) => {
  if (req.headers.authorization?.startsWith('Bearer ')) return req.headers.authorization.split(' ')[1];
  return req.cookies?.token || null;
};

const SLIDE_AFTER_MS = 60 * 60 * 1000; // refresh the sliding window at most hourly

/** Resolve token -> { user, session } or throw ApiError. */
const resolve = async (token, res) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new ApiError(401, 'Your session has expired. Please sign in again.', 'TOKEN_EXPIRED');
    throw new ApiError(401, 'Authentication token is invalid. Please sign in again.', 'TOKEN_INVALID');
  }
  if (!decoded.sid) throw new ApiError(401, 'Please sign in again.', 'TOKEN_INVALID');

  const session = await Session.findOne({ sid: decoded.sid, userId: decoded.id });
  if (!session || session.expiresAt < new Date()) {
    throw new ApiError(401, 'You have been signed out. Please sign in again.', 'SESSION_REVOKED');
  }
  const user = await User.findById(decoded.id).select('-password');
  if (!user || user.isDeleted) {
    await Session.deleteMany({ userId: decoded.id });
    if (res) clearAuthCookie(res);
    throw new ApiError(401, 'Account no longer exists. Please register or sign in.', 'USER_NOT_FOUND');
  }

  // Enforce immediate block: revoke all sessions and reject immediately
  if (user.isBlocked) {
    await Session.deleteMany({ userId: user._id });
    if (res) clearAuthCookie(res);
    throw new ApiError(
      403,
      `Your account has been suspended or blocked${user.blockedReason ? `: ${user.blockedReason}` : ''}. Please contact support.`,
      'ACCOUNT_BLOCKED'
    );
  }

  if (Date.now() - session.lastSeenAt.getTime() > SLIDE_AFTER_MS) {
    session.lastSeenAt = new Date();
    session.expiresAt = new Date(Date.now() + SESSION_MS);
    await session.save();
    if (res) setAuthCookie(res, signSessionToken(user._id, session.sid));
  }
  return { user, session };
};

export const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw new ApiError(401, 'Please sign in to access this feature.', 'AUTH_REQUIRED');
  const { user, session } = await resolve(token, res);
  req.user = user;
  req.sessionId = session.sid;
  next();
});

// Optional authentication for public endpoints that personalise responses
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      const { user, session } = await resolve(token, res);
      req.user = user;
      req.sessionId = session.sid;
    } catch {
      /* ignore */
    }
  }
  next();
});

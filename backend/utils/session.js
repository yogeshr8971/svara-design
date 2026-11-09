import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Session from '../models/Session.js';

// "Stay signed in until logout": sessions are long-lived and slide forward on use.
const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 365;
export const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

const cookieOptions = () => {
  const prod = process.env.NODE_ENV === 'production';
  const crossSite = process.env.CROSS_SITE_COOKIES === 'true'; // frontend & API on different domains
  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod && crossSite ? 'none' : 'lax',
    maxAge: SESSION_MS,
    path: '/',
  };
};

export const signSessionToken = (userId, sid) =>
  jwt.sign({ id: userId, sid }, process.env.JWT_SECRET, { expiresIn: `${SESSION_DAYS + 30}d` });

export const setAuthCookie = (res, token) => res.cookie('token', token, cookieOptions());

export const clearAuthCookie = (res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie('token', opts);
};

export const createSession = async (user, req, res) => {
  // Enforce single-device login: remove every previous session for this
  // account so only the newly created one remains valid.
  await Session.deleteMany({ userId: user._id });

  const sid = crypto.randomBytes(24).toString('hex');
  await Session.create({
    userId: user._id,
    sid,
    userAgent: (req.headers['user-agent'] || '').slice(0, 250),
    ip: req.ip || '',
    expiresAt: new Date(Date.now() + SESSION_MS),
  });
  setAuthCookie(res, signSessionToken(user._id, sid));
  return sid;
};

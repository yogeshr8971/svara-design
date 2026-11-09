import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { getPublicKey, isPushEnabled } from '../services/pushService.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const filter = { userId: req.user._id };
  if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };
  const [notifications, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ userId: req.user._id, readAt: null }),
  ]);
  res.json({ success: true, notifications, unread });
});

export const unreadCount = asyncHandler(async (req, res) => {
  res.json({ success: true, unread: await Notification.countDocuments({ userId: req.user._id, readAt: null }) });
});

export const markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
});

export const pushConfig = asyncHandler(async (req, res) => {
  res.json({ success: true, enabled: isPushEnabled(), publicKey: getPublicKey() });
});

export const subscribePush = asyncHandler(async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new ApiError(400, 'Invalid push subscription.', 'VALIDATION_ERROR');
  // endpoint is unique per browser profile: re-assign if another account used this browser before.
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { userId: req.user._id, endpoint, keys, userAgent: (req.headers['user-agent'] || '').slice(0, 250) },
    { upsert: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ success: true });
});

export const unsubscribePush = asyncHandler(async (req, res) => {
  await PushSubscription.deleteOne({ endpoint: req.body?.endpoint, userId: req.user._id });
  res.json({ success: true });
});

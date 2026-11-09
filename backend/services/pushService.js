import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

let ready = false;
const init = () => {
  if (ready) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:support@svara.in', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  ready = true;
  return true;
};

export const isPushEnabled = () => init();
export const getPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';

/** Deliver a Web Push message to every device the user subscribed. Dead subscriptions are pruned. */
export const sendPushToUser = async (userId, { title, body, url = '/', tag }) => {
  if (!init()) return 0;
  const subs = await PushSubscription.find({ userId });
  if (!subs.length) return 0;
  const payload = JSON.stringify({ title, body, url, tag });
  let delivered = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 60 * 60 * 24 });
        delivered += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: sub._id });
        else console.error('[push] failed:', err.statusCode || err.message);
      }
    })
  );
  return delivered;
};

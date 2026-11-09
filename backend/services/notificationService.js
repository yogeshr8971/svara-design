import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendPushToUser } from './pushService.js';
import { sendEmail, layout, esc } from './emailService.js';

// Email is sent for these notification types.
// For Ordered/Shipped/Delivered lifecycle events, dedicated emails are sent via orderEmailService
// to prevent duplicates (Bug B fix). Pass _skipEmail=true in reference to suppress email here.
const EMAIL_TYPES = new Set([
  'order_payment', 'order_new_seller',
  'seller_status', 'product_moderation', 'product_submitted', 'profile_change',
]);

const linkFor = (type, reference = {}) => {
  if (reference.link) return reference.link;
  if (reference.referenceType === 'order') return `/orders/${reference.referenceId}`;
  if (type === 'order_new_seller') return '/seller/dashboard?tab=orders';
  if (type === 'seller_status' || type === 'product_moderation' || type === 'profile_change') return '/seller/dashboard';
  if (type === 'product_submitted') return '/admin';
  return '/';
};

/**
 * Fan-out: in-app record + web push + email. Delivery channels never block or fail the
 * business operation that triggered them.
 * Back-compatible with the earlier createNotification(userId, type, title, message, reference).
 */
export const createNotification = async (userId, type, title, message, reference = {}) => {
  const link = linkFor(type, reference);
  const { link: _l, ...ref } = reference;
  let doc = null;
  try {
    doc = await Notification.create({ userId, type, title, message, link, ...ref });
  } catch (err) {
    console.error('[notify] store failed:', err.message);
    return null;
  }

  const channels = ['in_app'];
  const tasks = [];

  tasks.push(
    sendPushToUser(userId, { title, body: message, url: link, tag: `${type}:${ref.referenceId || ''}` })
      .then((n) => n > 0 && channels.push('push'))
      .catch((e) => console.error('[notify] push failed:', e.message))
  );

  if (EMAIL_TYPES.has(type) && !reference._skipEmail) {
    tasks.push(
      User.findById(userId).select('email name').lean().then((u) =>
        u?.email
          ? sendEmail({
              to: u.email,
              subject: `SVARA — ${title}`,
              html: layout({
                heading: title,
                bodyHtml: `<p>Hi ${esc(u.name || 'there')},</p><p>${esc(message)}</p>`,
                cta: { label: 'View details', url: link },
              }),
            }).then((ok) => ok && channels.push('email'))
          : null
      ).catch((e) => console.error('[notify] email failed:', e.message))
    );
  }

  // Fire-and-forget: callers don't wait on third-party delivery.
  Promise.allSettled(tasks).then(() => Notification.updateOne({ _id: doc._id }, { channels }).catch(() => {}));
  return doc;
};

export const notifyAdmins = async (type, title, message, reference = {}) => {
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  return Promise.all(admins.map((a) => createNotification(a._id, type, title, message, reference)));
};

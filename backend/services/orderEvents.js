import { createNotification } from './notificationService.js';

// Canonical status labels — exactly 3 lifecycle stages + internal states (§10)
const LABELS = {
  pending_payment: 'Awaiting payment',
  Ordered:         'Order confirmed',
  Shipped:         'Shipped',
  Delivered:       'Delivered',
  cancelled:       'Cancelled',
  refunded:        'Refunded',
};
export const statusLabel = (s) => LABELS[s] || s;

/** Append to the order timeline (call order.save() afterwards). */
export const pushHistory = (order, status, note = '', by = null) => {
  order.statusHistory.push({ status, note, by, at: new Date() });
};

/**
 * Tell the customer (in-app + push, optionally email) about an order change.
 *
 * Pass options.email = false to suppress the notification-service email when a
 * dedicated per-stage email is already sent via orderEmailService (Bug B fix).
 */
export const notifyCustomer = (order, title, message, type = 'order_status', options = {}) => {
  const ref = { referenceType: 'order', referenceId: order._id };
  if (options.email === false) ref._skipEmail = true;
  return createNotification(order.userId, type, title, message, ref);
};

/** Tell each distinct seller on the order that they have items to fulfil. */
export const notifySellersOfNewOrder = async (order) => {
  const sellerIds = [
    ...new Set(order.items.filter((i) => i.sellerId).map((i) => i.sellerId.toString())),
  ];
  await Promise.all(
    sellerIds.map((sid) => {
      const mine = order.items.filter((i) => i.sellerId?.toString() === sid);
      return createNotification(
        sid,
        'order_new_seller',
        `New order ${order.orderNumber}`,
        `${mine.length} item(s) to fulfil — ${mine.map((i) => `${i.name} ×${i.quantity}`).join(', ')}.`,
        { referenceType: 'order', referenceId: order._id, link: '/seller/dashboard?tab=orders' }
      );
    })
  );
};

/**
 * Derive the order-level status from per-item fulfilment (multi-seller orders).
 * Only uses the exactly three canonical statuses: Ordered, Shipped, Delivered (§10).
 * Returns the new status or null if nothing changed.
 */
export const recomputeOrderStatus = (order) => {
  const active = order.items.filter((i) => !['cancelled', 'refunded'].includes(i.fulfillmentStatus));
  if (!active.length || ['cancelled', 'pending_payment'].includes(order.orderStatus)) return null;

  const all = (s) => active.every((i) => (i.fulfillmentStatus || '').toLowerCase() === s.toLowerCase());
  let next = order.orderStatus;
  if (all('Delivered'))
    next = 'Delivered';
  else if (active.some((i) => ['Shipped', 'Delivered'].includes(i.fulfillmentStatus)))
    next = 'Shipped';
  else
    next = 'Ordered';

  if (next === order.orderStatus) return null;
  order.orderStatus = next;
  // NOTE: COD payment status is NOT automatically set to paid here.
  // Per spec §10, payment status is independent.
  return next;
};

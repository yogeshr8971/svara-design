import { sendEmail, layout, esc } from './emailService.js';
import Order from '../models/Order.js';
import User from '../models/User.js';

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

/** Default delivery estimate in business days from the shipped date. */
const DELIVERY_ESTIMATE_DAYS = Number(process.env.DELIVERY_ESTIMATE_DAYS) || 5;

const CLIENT_URL = () => process.env.CLIENT_URL || 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Shared HTML fragments for order emails
// ---------------------------------------------------------------------------

/** Format a number as ₹X,XXX.XX */
const inr = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

/** Build a human-readable expected delivery date string. */
const expectedDeliveryDate = (shippedDate) => {
  const d = new Date(shippedDate || Date.now());
  d.setDate(d.getDate() + DELIVERY_ESTIMATE_DAYS);
  return d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

/** Render the items table for an order email. */
const itemsTableHtml = (items) => {
  const rows = items.map((item) => {
    const hasDiscount = item.originalPrice && item.originalPrice > item.price;
    const discountPct = hasDiscount ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100) : 0;
    const priceHtml = hasDiscount
      ? `<span style="text-decoration:line-through;color:#9a8f7e;font-size:12px">${esc(inr(item.originalPrice))}</span> ${esc(inr(item.price))} <span style="color:#16a34a;font-size:11px;font-weight:600">↓${discountPct}%</span>`
      : esc(inr(item.price));
    const variant = [item.size, item.color].filter(Boolean).join(' / ');
    const imgTag = item.image
      ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" width="56" height="56" style="border-radius:8px;object-fit:cover;display:block" />`
      : '';

    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #eadfcd;vertical-align:top;width:64px">${imgTag}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eadfcd;vertical-align:top">
        <div style="font-weight:600;font-size:13px;color:#242019">${esc(item.name)}</div>
        ${variant ? `<div style="font-size:11px;color:#9a8f7e;margin-top:2px">${esc(variant)}</div>` : ''}
        <div style="font-size:11px;color:#9a8f7e;margin-top:2px">Qty: ${item.quantity}</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eadfcd;vertical-align:top;text-align:right;white-space:nowrap">
        <div style="font-size:13px;font-weight:600">${priceHtml}</div>
        <div style="font-size:11px;color:#9a8f7e;margin-top:2px">${esc(inr(item.price * item.quantity))}</div>
      </td>
    </tr>`;
  });

  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">${rows.join('')}</table>`;
};

/** Render the totals block. */
const totalsHtml = (order) => {
  // Calculate individual item shipping fees sum if available
  const itemShippingTotal = order.items.reduce((sum, item) => sum + (item.shippingFee || 0), 0);
  const shippingDisplay = order.shippingAmount || itemShippingTotal;

  const lines = [
    ['Subtotal', inr(order.subtotal)],
    ['Shipping', shippingDisplay > 0 ? inr(shippingDisplay) : 'FREE'],
  ];
  if (order.discountAmount > 0) {
    lines.push(['Discount', `−${inr(order.discountAmount)}`]);
  }
  lines.push(['Total', inr(order.totalAmount)]);

  return lines.map(([label, value], idx) => {
    const isBold = idx === lines.length - 1;
    return `<div style="display:flex;justify-content:space-between;padding:4px 0;${isBold ? 'font-weight:700;font-size:15px;border-top:2px solid #242019;padding-top:8px;margin-top:4px' : 'font-size:13px;color:#4a4339'}">
      <span>${esc(label)}</span><span>${esc(value)}</span>
    </div>`;
  }).join('');
};

/** Render payment method and status. */
const paymentInfoHtml = (order) => {
  const methodLabels = { razorpay: 'Online (Card/UPI/Netbanking)', upi: 'Direct UPI', cod: 'Cash on Delivery' };
  const statusLabels = { pending: 'Pending', confirmed: 'Confirmed (COD)', paid: 'Paid', failed: 'Failed' };
  const method = methodLabels[order.paymentMethod] || order.paymentMethod;
  const status = statusLabels[order.paymentStatus] || order.paymentStatus;

  return `<div style="background:#f7f3ec;border-radius:12px;padding:14px 16px;margin:12px 0">
    <div style="font-size:12px;color:#4a4339"><strong>Payment:</strong> ${esc(method)}</div>
    <div style="font-size:12px;color:#4a4339;margin-top:4px"><strong>Status:</strong> ${esc(status)}</div>
  </div>`;
};

// ---------------------------------------------------------------------------
// Email senders — Bug A fix
//
// Pattern: claim the flag atomically (findOneAndUpdate where flag is false),
// then send with strict:true. On failure, reset the flag to false so the next
// call can retry. A failed email never blocks or rolls back the status change.
// ---------------------------------------------------------------------------

/**
 * Send an order confirmation email after payment is confirmed.
 * For COD orders: sent immediately on order creation.
 * For online/UPI orders: sent after payment is captured/verified by admin.
 */
export const sendOrderConfirmedEmail = async (orderId) => {
  // Atomically claim: only proceed if the flag was false
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, confirmationEmailSent: false },
    { $set: { confirmationEmailSent: true } },
    { new: false }
  );
  if (!claimed) return; // already sent or not found

  const order = await Order.findById(orderId).populate('userId', 'name email');
  if (!order || !order.userId?.email) {
    // Reset flag so a future retry can try again
    await Order.updateOne({ _id: orderId }, { $set: { confirmationEmailSent: false } });
    return;
  }

  const customer = order.userId;
  const orderUrl = `${CLIENT_URL()}/orders/${order._id}`;
  const isCod = order.paymentMethod === 'cod';

  const html = layout({
    heading: 'Order Confirmed! 🎉',
    bodyHtml: `
      <p>Hi ${esc(customer.name)},</p>
      <p>${isCod
        ? 'Your Cash on Delivery order has been confirmed. Please keep the payment amount ready at delivery.'
        : 'Your payment has been received and your order is confirmed.'}</p>
      <div style="background:#f7f3ec;border-radius:12px;padding:14px 16px;margin:12px 0">
        <div style="font-size:13px;color:#242019"><strong>Order ID:</strong> ${esc(order.orderNumber)}</div>
        <div style="font-size:12px;color:#4a4339;margin-top:4px"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div style="font-size:12px;color:#4a4339;margin-top:4px"><strong>Status:</strong> Ordered</div>
      </div>
      ${itemsTableHtml(order.items)}
      ${totalsHtml(order)}
      ${paymentInfoHtml(order)}
      <p style="font-size:12px;color:#4a4339">We'll notify you when your order ships.</p>
      <p style="font-size:11px;color:#9a8f7e">Need help? Contact us at support@svara.in</p>
    `,
    cta: { label: 'View Order Details', url: orderUrl },
  });

  try {
    await sendEmail({ to: customer.email, subject: `Order Confirmed — ${order.orderNumber}`, html, strict: true });
  } catch (err) {
    // Reset flag so caller can retry
    console.error(`[orderEmail] confirmationEmail FAILED for ${order.orderNumber}:`, err.message);
    await Order.updateOne({ _id: orderId }, { $set: { confirmationEmailSent: false } });
  }
};

/**
 * Send a shipped notification email after admin changes status to Shipped.
 * Includes expected delivery date, courier, and tracking number.
 */
export const sendOrderShippedEmail = async (orderId, { trackingNumber = '', courier = '' } = {}) => {
  // Atomically claim
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, shippedEmailSent: false },
    { $set: { shippedEmailSent: true } },
    { new: false }
  );
  if (!claimed) return; // already sent or not found

  const order = await Order.findById(orderId).populate('userId', 'name email');
  if (!order || !order.userId?.email) {
    await Order.updateOne({ _id: orderId }, { $set: { shippedEmailSent: false } });
    return;
  }

  const customer = order.userId;
  const orderUrl = `${CLIENT_URL()}/orders/${order._id}`;
  const deliveryDate = expectedDeliveryDate(new Date());

  // Prefer explicitly passed values; fall back to what's on the first item
  const tn = trackingNumber || order.items[0]?.trackingNumber || '';
  const cr = courier || order.items[0]?.courier || '';

  const trackingHtml = tn
    ? `<div style="background:#f7f3ec;border-radius:12px;padding:14px 16px;margin:12px 0">
        <div style="font-size:12px;color:#4a4339"><strong>Courier:</strong> ${esc(cr || 'Standard Shipping')}</div>
        <div style="font-size:12px;color:#4a4339;margin-top:4px"><strong>Tracking:</strong> ${esc(tn)}</div>
        <div style="font-size:12px;color:#4a4339;margin-top:4px"><strong>Expected Delivery:</strong> ${esc(deliveryDate)}</div>
      </div>`
    : `<div style="background:#f7f3ec;border-radius:12px;padding:14px 16px;margin:12px 0">
        <div style="font-size:12px;color:#4a4339"><strong>Expected Delivery:</strong> ${esc(deliveryDate)}</div>
      </div>`;

  const html = layout({
    heading: 'Your Order Has Shipped! 📦',
    bodyHtml: `
      <p>Hi ${esc(customer.name)},</p>
      <p>Great news — your order <strong>${esc(order.orderNumber)}</strong> is on its way!</p>
      <div style="background:#f7f3ec;border-radius:12px;padding:14px 16px;margin:12px 0">
        <div style="font-size:13px;color:#242019"><strong>Order ID:</strong> ${esc(order.orderNumber)}</div>
        <div style="font-size:12px;color:#4a4339;margin-top:4px"><strong>Status:</strong> Shipped</div>
      </div>
      ${trackingHtml}
      ${itemsTableHtml(order.items)}
      ${totalsHtml(order)}
      ${paymentInfoHtml(order)}
      <p style="font-size:11px;color:#9a8f7e">Need help? Contact us at support@svara.in</p>
    `,
    cta: { label: 'Track Your Order', url: orderUrl },
  });

  try {
    await sendEmail({ to: customer.email, subject: `Order Shipped — ${order.orderNumber}`, html, strict: true });
  } catch (err) {
    console.error(`[orderEmail] shippedEmail FAILED for ${order.orderNumber}:`, err.message);
    await Order.updateOne({ _id: orderId }, { $set: { shippedEmailSent: false } });
  }
};

/**
 * Send a delivered confirmation email after admin changes status to Delivered.
 */
export const sendOrderDeliveredEmail = async (orderId) => {
  // Atomically claim
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, deliveredEmailSent: false },
    { $set: { deliveredEmailSent: true } },
    { new: false }
  );
  if (!claimed) return; // already sent or not found

  const order = await Order.findById(orderId).populate('userId', 'name email');
  if (!order || !order.userId?.email) {
    await Order.updateOne({ _id: orderId }, { $set: { deliveredEmailSent: false } });
    return;
  }

  const customer = order.userId;
  const orderUrl = `${CLIENT_URL()}/orders/${order._id}`;

  const html = layout({
    heading: 'Order Delivered! 🎊',
    bodyHtml: `
      <p>Hi ${esc(customer.name)},</p>
      <p>Your order <strong>${esc(order.orderNumber)}</strong> has been delivered. We hope you love it!</p>
      <div style="background:#f7f3ec;border-radius:12px;padding:14px 16px;margin:12px 0">
        <div style="font-size:13px;color:#242019"><strong>Order ID:</strong> ${esc(order.orderNumber)}</div>
        <div style="font-size:12px;color:#4a4339;margin-top:4px"><strong>Date Ordered:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div style="font-size:12px;color:#4a4339;margin-top:4px"><strong>Status:</strong> Delivered</div>
      </div>
      ${itemsTableHtml(order.items)}
      ${totalsHtml(order)}
      ${paymentInfoHtml(order)}
      <p style="font-size:12px;color:#4a4339">If you have any issues with your order, don't hesitate to reach out.</p>
      <p style="font-size:11px;color:#9a8f7e">Need help? Contact us at support@svara.in</p>
    `,
    cta: { label: 'View Order Details', url: orderUrl },
  });

  try {
    await sendEmail({ to: customer.email, subject: `Order Delivered — ${order.orderNumber}`, html, strict: true });
  } catch (err) {
    console.error(`[orderEmail] deliveredEmail FAILED for ${order.orderNumber}:`, err.message);
    await Order.updateOne({ _id: orderId }, { $set: { deliveredEmailSent: false } });
  }
};

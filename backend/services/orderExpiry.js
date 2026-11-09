import Order from '../models/Order.js';
import Product from '../models/Product.js';

const EXPIRY_MIN = { razorpay: 30, upi: 60 };

/**
 * Unpaid online/UPI orders hold stock. Release it when the payment window passes
 * (UPI orders with a submitted UTR are waiting on an admin and are never auto-expired).
 * NOTE: runs in-process; on serverless hosts trigger `expireStaleOrders` from a cron instead.
 */
export const expireStaleOrders = async () => {
  for (const [method, minutes] of Object.entries(EXPIRY_MIN)) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const filter = { paymentMethod: method, orderStatus: 'pending_payment', createdAt: { $lt: cutoff } };
    if (method === 'upi') filter['upi.utr'] = { $in: ['', null] };
    const stale = await Order.find(filter).limit(100);
    for (const order of stale) {
      // Atomic claim so two instances can't both restore stock.
      const claimed = await Order.findOneAndUpdate(
        { _id: order._id, orderStatus: 'pending_payment' },
        { orderStatus: 'cancelled', paymentStatus: 'failed', cancelledReason: 'Payment not completed in time', isInventoryDeducted: false,
          $push: { statusHistory: { status: 'cancelled', note: 'Payment not completed in time', at: new Date() } } },
        { new: false }
      );
      if (claimed?.isInventoryDeducted) {
        for (const it of claimed.items) await Product.findByIdAndUpdate(it.productId, { $inc: { stock: it.quantity } });
      }
    }
  }
};

export const startOrderExpiryJob = () => {
  const t = setInterval(() => expireStaleOrders().catch((e) => console.error('[expiry]', e.message)), 5 * 60 * 1000);
  t.unref();
  return () => clearInterval(t);
};

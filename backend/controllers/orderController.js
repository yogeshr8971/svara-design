import crypto from 'crypto';
import Razorpay from 'razorpay';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import PlatformSettings from '../models/PlatformSettings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { createRazorpayOrder, verifyPaymentSignature } from '../services/paymentService.js';
import { normalizePhone } from '../utils/phone.js';
import { notifyAdmins } from '../services/notificationService.js';
import { pushHistory, notifyCustomer, notifySellersOfNewOrder } from '../services/orderEvents.js';
import { sendOrderConfirmedEmail } from '../services/orderEmailService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shipping config from env or sensible defaults */
const getShippingConfig = () => ({
  freeThreshold: Number(process.env.FREE_SHIPPING_THRESHOLD) || 2000,
  flatRate: Number(process.env.SHIPPING_COST) || 99,
});

/**
 * Atomically decrement stock for every order item.
 * Supports variant-level stock decrement for size-specific items (Dress, Footwear)
 * as well as product-level stock decrement.
 * If any product/variant has insufficient stock, the entire operation is rolled back.
 */
const decrementInventory = async (items) => {
  const decremented = [];

  for (const item of items) {
    let result = null;
    const prod = await Product.findById(item.productId);
    if (!prod || !prod.isActive || prod.status !== 'approved') {
      for (const prev of decremented) {
        await restoreSingleItem(prev);
      }
      throw new ApiError(409, `"${item.name}" is no longer available.`, 'PRODUCT_UNAVAILABLE');
    }

    const hasMatchingVariant = prod.variants && prod.variants.length > 0 && item.size && prod.variants.some((v) => v.size === item.size);

    if (hasMatchingVariant) {
      result = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          isActive: true,
          status: 'approved',
          'variants.size': item.size,
          'variants.stock': { $gte: item.quantity },
          stock: { $gte: item.quantity },
        },
        {
          $inc: {
            stock: -item.quantity,
            'variants.$.stock': -item.quantity,
          },
        },
        { new: true }
      );
    } else {
      result = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          isActive: true,
          status: 'approved',
          stock: { $gte: item.quantity },
        },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
    }

    if (!result) {
      // Rollback already-decremented items
      for (const prev of decremented) {
        await restoreSingleItem(prev);
      }
      throw new ApiError(
        409,
        `"${item.name}"${item.size ? ` (Size ${item.size})` : ''} is out of stock or insufficient quantity available. Please update your cart.`,
        'INSUFFICIENT_STOCK'
      );
    }

    decremented.push({ ...item, hasMatchingVariant });
  }

  return decremented;
};

const restoreSingleItem = async (item) => {
  if (item.hasMatchingVariant && item.size) {
    await Product.findOneAndUpdate(
      { _id: item.productId, 'variants.size': item.size },
      { $inc: { stock: item.quantity, 'variants.$.stock': item.quantity } }
    );
  } else {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: item.quantity },
    });
  }
};

/** Restore stock when an order is cancelled or expires before fulfilment. */
const restoreInventory = async (items) => {
  for (const item of items) {
    if (item.size) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.productId, 'variants.size': item.size },
        { $inc: { stock: item.quantity, 'variants.$.stock': item.quantity } }
      );
      if (!updated) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity },
        });
      }
    } else {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity },
      });
    }
  }
};

const PAYMENT_METHODS = ['razorpay', 'upi', 'cod'];

const upiConfig = () => ({
  vpa: process.env.UPI_VPA || '',
  payeeName: process.env.UPI_PAYEE_NAME || 'SVARA',
});

export const buildUpiLink = (order) => {
  const { vpa, payeeName } = upiConfig();
  const q = new URLSearchParams({ pa: vpa, pn: payeeName, am: order.totalAmount.toFixed(2), cu: 'INR', tn: `Order ${order.orderNumber}`, tr: order.orderNumber });
  return `upi://pay?${q.toString()}`;
};

const validateAddress = (a) => {
  if (!a) throw new ApiError(400, 'Shipping address is required.', 'VALIDATION_ERROR');
  const phone = normalizePhone(a.phone);
  if (!a.name?.trim() || !a.street?.trim() || !a.city?.trim() || !a.state?.trim()) {
    throw new ApiError(400, 'Please complete the shipping address.', 'VALIDATION_ERROR');
  }
  if (!phone) throw new ApiError(400, 'Enter a valid 10-digit contact number.', 'VALIDATION_ERROR');
  if (!/^\d{6}$/.test(String(a.pincode || '').trim())) throw new ApiError(400, 'Enter a valid 6-digit PIN code.', 'VALIDATION_ERROR');
  return {
    name: a.name.trim(), phone, street: a.street.trim(), city: a.city.trim(),
    state: a.state.trim(), pincode: String(a.pincode).trim(), country: a.country || 'India',
  };
};

/** Release stock held by this user's earlier unpaid checkouts so abandoned attempts don't lock inventory. */
const cancelStalePending = async (userId) => {
  const stale = await Order.find({ userId, orderStatus: 'pending_payment' });
  for (const o of stale) {
    if (o.isInventoryDeducted) { await restoreInventory(o.items); o.isInventoryDeducted = false; }
    o.orderStatus = 'cancelled'; o.paymentStatus = o.paymentStatus === 'paid' ? o.paymentStatus : 'failed';
    o.cancelledReason = 'Replaced by a newer checkout';
    pushHistory(o, 'cancelled', o.cancelledReason);
    await o.save();
  }
};

/** Single place that marks an order as paid + confirmed (gateway verify, webhook, UPI approval). */
export const markOrderPaid = async (order, { note = 'Payment received', by = null } = {}) => {
  if (order.paymentStatus === 'paid') return false;
  order.paymentStatus = 'paid';
  if (order.orderStatus === 'pending_payment') order.orderStatus = 'Ordered';
  pushHistory(order, 'paid', note, by);
  pushHistory(order, 'Ordered', 'Order confirmed', by);
  await order.save();
  await Cart.findOneAndUpdate({ userId: order.userId }, { items: [] });
  notifyCustomer(order, `Payment received — order ${order.orderNumber} confirmed`, `We've received ₹${order.totalAmount}. Track your order any time from My Orders.`, 'order_payment').catch(() => {});
  notifySellersOfNewOrder(order).catch(() => {});
  // Send order confirmation email asynchronously (§12)
  sendOrderConfirmedEmail(order._id).catch(() => {});
  return true;
};

// ---------------------------------------------------------------------------
// Create Order  — server-authoritative pricing + atomic stock decrement
// ---------------------------------------------------------------------------
export const createOrder = asyncHandler(async (req, res) => {
  const paymentMethod = req.body.paymentMethod || 'razorpay';
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new ApiError(400, 'Unsupported payment method.', 'VALIDATION_ERROR');
  if (paymentMethod === 'upi' && !upiConfig().vpa) throw new ApiError(400, 'UPI payment is not available right now.', 'UPI_DISABLED');
  if (paymentMethod === 'cod' && process.env.COD_ENABLED === 'false') throw new ApiError(400, 'Cash on Delivery is not available right now.', 'COD_DISABLED');
  const shippingAddress = validateAddress(req.body.shippingAddress);

  await cancelStalePending(req.user._id);

  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Cart is empty.');
  }

  // --- 1. Re-fetch products for SERVER-AUTHORITATIVE pricing ---
  const productIds = cart.items.map((i) => i.productId);
  const products = await Product.find({
    _id: { $in: productIds },
    isActive: true,
    status: 'approved',
  }).populate('sellerId', 'name businessName');

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  // Validate every cart item has a matching active product and assigned shipping fee (§7)
  for (const item of cart.items) {
    const prod = productMap.get(item.productId.toString());
    if (!prod) {
      throw new ApiError(
        400,
        `Product "${item.name || item.productId}" is no longer available.`,
        'PRODUCT_UNAVAILABLE'
      );
    }
    if (prod.shippingFee === null || prod.shippingFee === undefined) {
      throw new ApiError(
        400,
        `Product "${prod.name}" cannot be checked out because its shipping fee has not been assigned by administration.`,
        'SHIPPING_FEE_UNASSIGNED'
      );
    }
  }

  // --- 2. Platform commission ---
  const settings = await PlatformSettings.getSettings();
  const currentCommissionRate = settings.commissionRate || 10;

  // --- 3. Build order items using DB prices (not cart-cached prices) ---
  const orderItems = cart.items.map((cartItem) => {
    const product = productMap.get(cartItem.productId.toString());
    const serverPrice = product.price; // authoritative

    const isSellerProduct =
      product.ownerType === 'seller' && product.sellerId;
    const sellerId = isSellerProduct ? product.sellerId._id : null;
    const sellerNameSnapshot = isSellerProduct
      ? product.sellerId.businessName || product.sellerId.name || 'Seller'
      : 'SVARA Direct';

    const itemSubtotal = serverPrice * cartItem.quantity;
    const commissionRate = isSellerProduct ? currentCommissionRate : 0;
    const commissionAmount = isSellerProduct
      ? Math.round((itemSubtotal * commissionRate) / 100)
      : 0;
    const sellerRevenue = itemSubtotal - commissionAmount;

    return {
      productId: cartItem.productId,
      name: product.name,
      image: product.images?.[0]?.url || cartItem.image || '',
      price: serverPrice,
      originalPrice: product.compareAtPrice || null,
      size: cartItem.size || '',
      color: cartItem.color || '',
      quantity: cartItem.quantity,
      sellerId,
      sellerNameSnapshot,
      commissionRate,
      commissionAmount,
      sellerRevenue,
      shippingFee: product.shippingFee ?? 0,
      fulfillmentStatus: 'Ordered',
    };
  });

  // --- 4. Calculate totals using server-authoritative settings ---
  const freeThreshold = settings.freeShippingThreshold ?? (Number(process.env.FREE_SHIPPING_THRESHOLD) || 2000);
  const subtotal = orderItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  // Sum of product-specific shipping fees assigned by administration
  const itemShippingSum = orderItems.reduce((acc, item) => acc + (item.shippingFee || 0), 0);
  const shippingAmount = subtotal >= freeThreshold ? 0 : itemShippingSum;
  const totalAmount = subtotal + shippingAmount;

  const codMax = Number(process.env.COD_MAX_AMOUNT) || 10000;
  if (paymentMethod === 'cod' && totalAmount > codMax) {
    throw new ApiError(400, `Cash on Delivery is available for orders up to ₹${codMax}. Please choose UPI or card.`, 'COD_LIMIT');
  }

  // --- 5. Atomic inventory decrement (rollback-safe) ---
  await decrementInventory(orderItems);

  // --- 5b. Cash on Delivery: begins as "Ordered", payment unpaid until collected (§10, §11) ---
  if (paymentMethod === 'cod') {
    let codOrder;
    try {
      codOrder = await Order.create({
        userId: req.user._id, items: orderItems, shippingAddress, subtotal, shippingAmount, totalAmount,
        paymentMethod: 'cod', paymentStatus: 'pending', orderStatus: 'Ordered', isInventoryDeducted: true,
        statusHistory: [{ status: 'Ordered', note: 'Cash on Delivery order placed', at: new Date() }],
      });
    } catch (err) { await restoreInventory(orderItems); throw err; }
    await Cart.findOneAndUpdate({ userId: req.user._id }, { items: [] });
    notifyCustomer(codOrder, `Order ${codOrder.orderNumber} confirmed`, `Your Cash on Delivery order of ₹${totalAmount} is placed. Please keep the amount ready at delivery.`, 'order_placed', { email: false }).catch(() => {});
    notifySellersOfNewOrder(codOrder).catch(() => {});
    sendOrderConfirmedEmail(codOrder._id).catch(() => {});
    return res.status(201).json({ success: true, order: codOrder, paymentMethod: 'cod' });
  }

  // --- 5c. Direct UPI: stock held, awaiting the customer's payment reference ---
  if (paymentMethod === 'upi') {
    let upiOrder;
    try {
      upiOrder = await Order.create({
        userId: req.user._id, items: orderItems, shippingAddress, subtotal, shippingAmount, totalAmount,
        paymentMethod: 'upi', paymentStatus: 'pending', orderStatus: 'pending_payment', isInventoryDeducted: true,
        upi: { payeeVpa: upiConfig().vpa },
        statusHistory: [{ status: 'pending_payment', note: 'Awaiting UPI payment', at: new Date() }],
      });
    } catch (err) { await restoreInventory(orderItems); throw err; }
    return res.status(201).json({
      success: true, order: upiOrder, paymentMethod: 'upi',
      upi: { vpa: upiConfig().vpa, payeeName: upiConfig().payeeName, amount: totalAmount, deepLink: buildUpiLink(upiOrder) },
    });
  }

  // --- 6. Create Razorpay order ---
  const receipt = `order_${req.user._id}_${Date.now()}`;
  let rzOrder;
  try {
    rzOrder = await createRazorpayOrder(totalAmount * 100, receipt);
  } catch (err) {
    // Restore stock if Razorpay call fails
    await restoreInventory(orderItems);
    throw new ApiError(
      502,
      'Payment gateway is temporarily unavailable. Please try again.',
      'PAYMENT_GATEWAY_ERROR'
    );
  }

  // --- 7. Persist order ---
  const order = await Order.create({
    userId: req.user._id,
    items: orderItems,
    shippingAddress,
    subtotal,
    shippingAmount,
    totalAmount,
    razorpayOrderId: rzOrder.id,
    paymentMethod: 'razorpay',
    orderStatus: 'pending_payment',
    isInventoryDeducted: true,
    statusHistory: [{ status: 'pending_payment', note: 'Awaiting online payment', at: new Date() }],
  });

  res.status(201).json({
    success: true,
    order,
    razorpayOrderId: rzOrder.id,
    amountInPaise: totalAmount * 100,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
});

// Public shipping configuration endpoint
export const getShippingConfigHandler = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.getSettings();
  res.json({
    success: true,
    freeShippingThreshold: settings.freeShippingThreshold || 2000,
    shippingCost: settings.shippingCost || 99,
  });
});

// ---------------------------------------------------------------------------
// Verify Payment (client-side callback — secondary confirmation with amount verification)
// ---------------------------------------------------------------------------
export const verifyOrderPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  const order = await Order.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!order) throw new ApiError(404, 'Order not found.');

  if (order.paymentStatus === 'paid') {
    return res.json({ success: true, order, message: 'Payment already verified.' });
  }

  if (razorpayOrderId !== order.razorpayOrderId) {
    throw new ApiError(400, 'Payment order does not belong to this checkout.', 'PAYMENT_ORDER_MISMATCH');
  }
  if (!razorpayPaymentId || !razorpaySignature) {
    throw new ApiError(400, 'Payment details are incomplete.', 'PAYMENT_DETAILS_REQUIRED');
  }

  // Verify HMAC signature
  const valid = verifyPaymentSignature(
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  );
  if (!valid) throw new ApiError(400, 'Payment verification failed: invalid signature.');

  // Validate payment amount & currency from gateway if API credentials available
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
      const razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      const paymentEntity = await razorpayInstance.payments.fetch(razorpayPaymentId);
      if (paymentEntity) {
        if (paymentEntity.order_id !== order.razorpayOrderId) {
          throw new ApiError(400, 'Payment gateway order does not match this checkout.', 'PAYMENT_ORDER_MISMATCH');
        }
        const expectedPaise = Math.round(order.totalAmount * 100);
        if (Number(paymentEntity.amount) !== expectedPaise) {
          throw new ApiError(400, `Payment amount ₹${(paymentEntity.amount / 100).toFixed(2)} does not match order total ₹${order.totalAmount.toFixed(2)}.`, 'AMOUNT_MISMATCH');
        }
        if (paymentEntity.currency && paymentEntity.currency !== 'INR') {
          throw new ApiError(400, 'Payment currency must be INR.', 'CURRENCY_MISMATCH');
        }
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      console.warn('[verifyOrderPayment] Optional payment fetch check warning:', err.message);
    }
  }

  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;
  await markOrderPaid(order, { note: 'Online payment verified' });

  res.json({ success: true, order, message: 'Payment verified. Order confirmed!' });
});

// ---------------------------------------------------------------------------
// Razorpay Webhook — primary source of truth for payment status
// ---------------------------------------------------------------------------
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured.');
    return res.status(500).json({ success: false });
  }

  // --- 1. Verify HMAC signature ---
  const receivedSignature = req.headers['x-razorpay-signature'];
  if (!receivedSignature) {
    return res.status(400).json({ success: false, message: 'Missing signature.' });
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== receivedSignature) {
    console.warn('[Webhook] Invalid signature — ignoring.');
    return res.status(400).json({ success: false, message: 'Invalid signature.' });
  }

  const body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
  const { event, payload } = body;
  const eventId = body.event_id || payload?.payment?.entity?.id;
  if (!eventId) return res.status(400).json({ success: false, message: 'Missing webhook event identifier.' });

  // --- 2. Handle payment.captured ---
  if (event === 'payment.captured') {
    const razorpayOrderId = payload.payment?.entity?.order_id;
    const razorpayPaymentId = payload.payment?.entity?.id;
    const paidAmount = Number(payload.payment?.entity?.amount);
    const paymentStatus = payload.payment?.entity?.status;

    if (!razorpayOrderId) {
      return res.status(200).json({ success: true, message: 'No order_id in payload.' });
    }

    const order = await Order.findOne({ razorpayOrderId });
    if (!order) {
      console.warn(`[Webhook] No order found for razorpayOrderId: ${razorpayOrderId}`);
      return res.status(200).json({ success: true, message: 'Order not found — ignoring.' });
    }

    if (paymentStatus !== 'captured' || paidAmount !== order.totalAmount * 100) {
      console.warn(`[Webhook] Payment amount/status mismatch for ${razorpayOrderId}`);
      return res.status(200).json({ success: true, message: 'Payment not eligible for confirmation.' });
    }

    // Idempotency: skip if this event was already processed
    if (order.webhookProcessedEvents.includes(eventId)) {
      return res.status(200).json({ success: true, message: 'Event already processed.' });
    }

    order.razorpayPaymentId = razorpayPaymentId;
    order.webhookProcessedEvents.push(eventId);
    if (order.orderStatus === 'cancelled') {
      // Paid after we released the stock: keep the money record, flag for manual refund.
      order.paymentStatus = 'paid';
      await order.save();
      notifyAdmins('order_payment', 'Refund needed', `Order ${order.orderNumber} was paid after cancellation.`, { referenceType: 'order', referenceId: order._id, link: '/admin' }).catch(() => {});
    } else {
      await markOrderPaid(order, { note: 'Payment captured by gateway' });
    }

    console.log(`[Webhook] payment.captured — Order ${order.orderNumber} confirmed.`);
  }

  // --- 3. Handle payment.failed ---
  if (event === 'payment.failed') {
    const razorpayOrderId = payload.payment?.entity?.order_id;
    if (razorpayOrderId) {
      const order = await Order.findOne({ razorpayOrderId });
      if (order && order.paymentStatus !== 'paid') {
        if (order.webhookProcessedEvents.includes(eventId)) {
          return res.status(200).json({ success: true, message: 'Event already processed.' });
        }
        // Restore inventory on payment failure
        if (order.isInventoryDeducted) {
          await restoreInventory(order.items);
          order.isInventoryDeducted = false;
        }
        order.paymentStatus = 'failed';
        order.orderStatus = 'cancelled';
        order.cancelledReason = 'Payment failed';
        order.webhookProcessedEvents.push(eventId);
        pushHistory(order, 'cancelled', 'Payment failed');
        await order.save();
        notifyCustomer(order, `Payment failed for order ${order.orderNumber}`, 'Your payment did not go through and the order was cancelled. You can place it again any time.', 'order_payment').catch(() => {});

        console.log(`[Webhook] payment.failed — Order ${order.orderNumber} cancelled, stock restored.`);
      }
    }
  }

  // Always respond 200 to Razorpay to prevent retries
  res.status(200).json({ success: true });
});

// ---------------------------------------------------------------------------
// Cancel Order (customer-initiated, only before shipping)
// ---------------------------------------------------------------------------
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found.');

  const statusLower = (order.orderStatus || '').toLowerCase();
  const nonCancellable = ['shipped', 'delivered', 'cancelled'];
  const hasShippedItem = order.items.some((i) => ['shipped', 'delivered'].includes((i.fulfillmentStatus || '').toLowerCase()));

  if (nonCancellable.includes(statusLower) || hasShippedItem) {
    throw new ApiError(400, 'This order is already being shipped or has been delivered and can no longer be cancelled.', 'ORDER_NOT_CANCELLABLE');
  }

  if (order.isInventoryDeducted) {
    await restoreInventory(order.items);
    order.isInventoryDeducted = false;
  }
  const wasPaid = order.paymentStatus === 'paid';
  order.orderStatus = 'cancelled';
  order.items.forEach((i) => { i.fulfillmentStatus = 'cancelled'; });
  if (!wasPaid && order.paymentStatus !== 'failed') order.paymentStatus = order.paymentMethod === 'cod' ? 'failed' : order.paymentStatus;
  order.cancelledReason = req.body.reason || 'Cancelled by customer';
  pushHistory(order, 'cancelled', order.cancelledReason, req.user._id);
  await order.save();

  if (wasPaid) {
    notifyAdmins('order_payment', 'Refund needed', `Order ${order.orderNumber} was cancelled by the customer after payment.`, { referenceType: 'order', referenceId: order._id, link: '/admin' }).catch(() => {});
  }
  notifyCustomer(order, `Order ${order.orderNumber} cancelled`, wasPaid ? 'Your refund will be processed to the original payment method.' : 'Your order has been cancelled.').catch(() => {});

  res.json({ success: true, order, message: 'Order cancelled successfully.' });
});

// ---------------------------------------------------------------------------
// Direct UPI — customer submits the UTR (12-digit UPI reference) after paying
// ---------------------------------------------------------------------------
export const submitUpiPayment = asyncHandler(async (req, res) => {
  const utr = String(req.body.utr || '').trim();
  if (!/^\d{12}$/.test(utr)) throw new ApiError(400, 'Enter the 12-digit UPI reference (UTR) shown in your UPI app.', 'VALIDATION_ERROR');

  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.paymentMethod !== 'upi') throw new ApiError(400, 'This order is not a UPI order.', 'VALIDATION_ERROR');
  if (order.orderStatus !== 'pending_payment') throw new ApiError(400, 'This order is no longer awaiting payment.', 'ORDER_NOT_PENDING');
  if (order.paymentStatus === 'paid') return res.json({ success: true, order });

  const dup = await Order.findOne({ 'upi.utr': utr, _id: { $ne: order._id } });
  if (dup) throw new ApiError(409, 'This UPI reference has already been used on another order.', 'UTR_DUPLICATE');

  order.upi.utr = utr;
  order.upi.submittedAt = new Date();
  order.upi.rejectionReason = '';
  pushHistory(order, 'pending_payment', 'UPI reference submitted — verification in progress', req.user._id);
  await order.save();
  await Cart.findOneAndUpdate({ userId: order.userId }, { items: [] });

  notifyAdmins('order_payment', 'UPI payment to verify', `Order ${order.orderNumber} · ₹${order.totalAmount} · UTR ${utr}`, { referenceType: 'order', referenceId: order._id, link: '/admin' }).catch(() => {});
  notifyCustomer(order, `Payment submitted for ${order.orderNumber}`, "We're verifying your UPI payment. You'll be notified as soon as it's confirmed.", 'order_payment').catch(() => {});

  res.json({ success: true, order, message: 'Payment reference received. We are verifying it.' });
});

export const getUpiDetails = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order || order.paymentMethod !== 'upi') throw new ApiError(404, 'UPI order not found.');
  res.json({ success: true, upi: { vpa: upiConfig().vpa, payeeName: upiConfig().payeeName, amount: order.totalAmount, deepLink: buildUpiLink(order) }, order });
});

// ---------------------------------------------------------------------------
// Get Orders (current user)
// ---------------------------------------------------------------------------
export const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: req.user._id })
    .populate('items.productId', 'name slug images')
    .sort({ createdAt: -1 });
  res.json({ success: true, orders });
});

// ---------------------------------------------------------------------------
// Get Single Order
// ---------------------------------------------------------------------------
export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).populate('items.productId', 'name slug images description');
  if (!order) throw new ApiError(404, 'Order not found.');
  res.json({ success: true, order });
});

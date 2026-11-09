import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Seller from '../models/Seller.js';
import { pushHistory, notifyCustomer, recomputeOrderStatus } from '../services/orderEvents.js';
import SellerProfileChange from '../models/SellerProfileChange.js';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Get seller dashboard metrics computed from REAL order & product data.
 * No fake counters or mock stats.
 */
export const getSellerDashboard = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;
  const { startDate, endDate } = req.query;

  // Build date filter if provided
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const matchStage = {
    paymentStatus: 'paid',
    'items.sellerId': sellerId,
  };
  if (startDate || endDate) {
    matchStage.createdAt = dateFilter;
  }

  // Aggregate paid sales metrics for this seller
  const salesAgg = await Order.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    { $match: { 'items.sellerId': sellerId } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        totalCommission: { $sum: '$items.commissionAmount' },
        sellerRevenue: { $sum: '$items.sellerRevenue' },
        productsSold: { $sum: '$items.quantity' },
        uniqueOrders: { $addToSet: '$_id' },
      },
    },
  ]);

  const stats = salesAgg[0] || {
    totalSales: 0,
    totalCommission: 0,
    sellerRevenue: 0,
    productsSold: 0,
    uniqueOrders: [],
  };

  // Count active products
  const [totalProducts, activeProducts, pendingProducts] = await Promise.all([
    Product.countDocuments({ sellerId }),
    Product.countDocuments({ sellerId, status: 'approved', isActive: true }),
    Product.countDocuments({ sellerId, status: 'pending' }),
  ]);

  // Recent 5 sales
  const recentOrders = await Order.find({
    paymentStatus: 'paid',
    'items.sellerId': sellerId,
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'name email');

  const recentSales = recentOrders.flatMap((order) =>
    order.items
      .filter((item) => item.sellerId && item.sellerId.toString() === sellerId.toString())
      .map((item) => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: order.userId?.name || 'Customer',
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
        commission: item.commissionAmount,
        netRevenue: item.sellerRevenue,
        status: order.orderStatus,
        date: order.createdAt,
      }))
  ).slice(0, 5);

  res.json({
    success: true,
    stats: {
      totalSales: stats.totalSales,
      totalCommission: stats.totalCommission,
      sellerRevenue: stats.sellerRevenue,
      productsSold: stats.productsSold,
      ordersCount: stats.uniqueOrders.length,
      totalProducts,
      activeProducts,
      pendingProducts,
    },
    recentSales,
  });
});

/**
 * Get products owned by the authenticated seller.
 */
export const getSellerProducts = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;
  const { page = 1, limit = 20, search, status, category, stockStatus } = req.query;

  const filter = { sellerId };
  if (status && status !== 'all') filter.status = status;
  if (category) filter.category = category;
  if (stockStatus === 'inStock') filter.stock = { $gte: 5 };
  else if (stockStatus === 'lowStock') filter.stock = { $gt: 0, $lt: 5 };
  else if (stockStatus === 'outOfStock') filter.stock = { $lte: 0 };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    products,
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit),
  });
});

export const updateSellerProductStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stock, variants } = req.body;

  const product = await Product.findOne({ _id: id, sellerId: req.user._id });
  if (!product) throw new ApiError(404, 'Product not found or access denied.');

  if (variants && Array.isArray(variants)) {
    product.variants = variants;
    product.stock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  } else if (stock !== undefined) {
    const numStock = Number(stock);
    if (isNaN(numStock) || numStock < 0) {
      throw new ApiError(400, 'Stock must be a non-negative number.');
    }
    product.stock = numStock;
  }

  await product.save();
  res.json({ success: true, product, message: 'Stock updated successfully.' });
});

/**
 * Get orders containing the authenticated seller's products.
 * Only returns line items belonging to this seller.
 */
export const getSellerOrders = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;
  const { page = 1, limit = 20, status } = req.query;

  // Sellers only see orders that are confirmed (paid, UPI-verified or COD) — never unpaid checkouts.
  const filter = { 'items.sellerId': sellerId, orderStatus: { $ne: 'pending_payment' } };
  if (status) filter['items.fulfillmentStatus'] = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  // Sanitize orders so seller only sees their own items
  const sanitizedOrders = orders.map((order) => {
    const sellerItems = order.items.filter(
      (item) => item.sellerId && item.sellerId.toString() === sellerId.toString()
    );
    const sellerSubtotal = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const sellerRevenueTotal = sellerItems.reduce((sum, item) => sum + (item.sellerRevenue || 0), 0);
    const sellerCommissionTotal = sellerItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0);

    return {
      _id: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      customer: {
        name: order.shippingAddress?.name || order.userId?.name,
        city: order.shippingAddress?.city,
        state: order.shippingAddress?.state,
      },
      items: sellerItems,
      sellerSubtotal,
      sellerCommissionTotal,
      sellerRevenueTotal,
    };
  });

  res.json({
    success: true,
    orders: sanitizedOrders,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
});

export const updateSellerOrderItem = asyncHandler(async (req, res) => {
  // Spec §4 & §10: Sellers must never change order or shipment status. Only platform administrators control order status transitions.
  throw new ApiError(403, 'Sellers are not permitted to change order or shipping status. Order status transitions are controlled exclusively by platform administrators.', 'SELLER_STATUS_CHANGE_FORBIDDEN');
});

/**
 * Get itemized sales history for seller with date range support.
 */
export const getSellerSales = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;
  const { page = 1, limit = 30, startDate, endDate } = req.query;

  const matchFilter = {
    paymentStatus: 'paid',
    'items.sellerId': sellerId,
  };
  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
    if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
  }

  const orders = await Order.find(matchFilter)
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });

  const allSales = orders.flatMap((order) =>
    order.items
      .filter((item) => item.sellerId && item.sellerId.toString() === sellerId.toString())
      .map((item) => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        grossSale: item.price * item.quantity,
        commissionRate: item.commissionRate || 10,
        commissionAmount: item.commissionAmount || 0,
        netRevenue: item.sellerRevenue || 0,
        date: order.createdAt,
        status: order.orderStatus,
      }))
  );

  const skip = (Number(page) - 1) * Number(limit);
  const paginatedSales = allSales.slice(skip, skip + Number(limit));

  res.json({
    success: true,
    sales: paginatedSales,
    total: allSales.length,
    page: Number(page),
    pages: Math.ceil(allSales.length / Number(limit)),
  });
});

/**
 * Update seller's own business profile.
 */
export const updateSellerProfile = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;
  const { businessName, businessAddress, gstNumber, sellerDescription, phone } = req.body;

  const updateData = {};
  if (businessName !== undefined) updateData.businessName = businessName.trim();
  if (businessAddress !== undefined) updateData.businessAddress = businessAddress;
  if (gstNumber !== undefined) updateData.gstNumber = gstNumber;
  if (sellerDescription !== undefined) updateData.sellerDescription = sellerDescription;
  if (phone !== undefined) updateData.phone = phone;

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, 'Provide at least one business profile field to change.', 'VALIDATION_ERROR');
  }

  await SellerProfileChange.findOneAndUpdate(
    { sellerId, status: 'pending' },
    { changes: updateData, status: 'pending', reviewReason: '', reviewedBy: null, reviewedAt: null },
    { upsert: true, new: true, runValidators: true }
  );

  res.json({
    success: true,
    message: 'Your profile changes were submitted for admin approval.',
  });
});

export const getSellerNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ success: true, notifications });
});

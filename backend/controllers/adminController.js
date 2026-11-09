import User from '../models/User.js';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import CreditBalance from '../models/CreditBalance.js';
import CreditTransaction from '../models/CreditTransaction.js';
import CreditPackage from '../models/CreditPackage.js';
import VirtualTryOnGeneration from '../models/VirtualTryOnGeneration.js';
import PlatformSettings from '../models/PlatformSettings.js';
import SellerProfileChange from '../models/SellerProfileChange.js';
import Session from '../models/Session.js';
import Cart from '../models/Cart.js';
import Avatar from '../models/Avatar.js';
import Wardrobe from '../models/Wardrobe.js';
import AuditLog from '../models/AuditLog.js';
import { createNotification } from '../services/notificationService.js';
import { pushHistory, notifyCustomer, recomputeOrderStatus } from '../services/orderEvents.js';
import { markOrderPaid } from './orderController.js';
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from '../services/orderEmailService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import {
  generateExcelTemplate,
  parseAndValidateExcel,
  executeBulkImport,
} from '../services/excelImportService.js';
import { getDefaultCreditsForRole } from '../services/creditService.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const [userCount, sellerCount, productCount, orderCount, vtoCount, revenueAgg, commissionAgg] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ role: 'seller' }),
    Product.countDocuments(),
    Order.countDocuments(),
    VirtualTryOnGeneration.countDocuments({ status: 'COMPLETED' }),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $group: { _id: null, totalCommission: { $sum: '$items.commissionAmount' } } },
    ]),
  ]);

  res.json({
    success: true,
    stats: {
      users: userCount,
      sellers: sellerCount,
      products: productCount,
      orders: orderCount,
      vtoGenerations: vtoCount,
      totalRevenue: revenueAgg[0]?.total || 0,
      totalCommission: commissionAgg[0]?.totalCommission || 0,
    },
  });
});

const logAdminAction = async ({ req, action, targetId, targetModel = 'User', details = {} }) => {
  try {
    await AuditLog.create({
      action,
      performedBy: req.user._id,
      performerRole: req.user.isRootAdmin ? 'root-admin' : 'admin',
      targetId,
      targetModel,
      details,
      ip: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || '',
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
};

export const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role } = req.query;
  const filter = { isDeleted: { $ne: true } };
  if (role && role !== 'all') {
    filter.role = role;
  } else if (!role) {
    filter.role = { $in: ['user', 'admin'] };
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);
  const userIds = users.map((u) => u._id);
  const balances = await CreditBalance.find({ userId: { $in: userIds } });
  const balanceMap = Object.fromEntries(balances.map((b) => [b.userId.toString(), b.balance]));
  const result = users.map((u) => ({
    ...u.toObject(),
    credits: balanceMap[u._id.toString()] !== undefined ? balanceMap[u._id.toString()] : getDefaultCreditsForRole(u.role),
  }));
  res.json({ success: true, users: result, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.isDeleted) throw new ApiError(404, 'User not found.');
  const credits = await CreditBalance.findOne({ userId: user._id });
  const currentCredits = credits !== null && credits !== undefined ? credits.balance : getDefaultCreditsForRole(user.role);
  const orders = await Order.find({ userId: user._id }).sort({ createdAt: -1 }).limit(5);
  res.json({ success: true, user, credits: currentCredits, recentOrders: orders });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  // Only root admin can manage administrator roles and promotions
  if (!req.user.isRootAdmin) {
    throw new ApiError(403, 'Access denied. Only the Root Administrator can change user roles.', 'ROOT_ADMIN_REQUIRED');
  }

  const { role, isRootAdmin } = req.body;
  if (role && !['user', 'seller', 'admin'].includes(role)) {
    throw new ApiError(400, 'Role must be "user", "seller", or "admin".');
  }

  const target = await User.findById(req.params.id);
  if (!target || target.isDeleted) throw new ApiError(404, 'User not found.');

  // Safeguard: Safeguard against removing or demoting the last root admin
  if (target.isRootAdmin && (role !== 'admin' || isRootAdmin === false)) {
    const rootAdminCount = await User.countDocuments({ isRootAdmin: true, isDeleted: { $ne: true }, isBlocked: { $ne: true } });
    if (rootAdminCount <= 1) {
      throw new ApiError(400, 'Cannot demote or remove the last active Root Administrator.', 'LAST_ROOT_ADMIN_PROTECTED');
    }
  }

  // Prevent self-demotion if last root admin
  if (req.params.id === req.user._id.toString() && isRootAdmin === false) {
    const rootAdminCount = await User.countDocuments({ isRootAdmin: true, isDeleted: { $ne: true }, isBlocked: { $ne: true } });
    if (rootAdminCount <= 1) {
      throw new ApiError(400, 'Cannot demote yourself as the only remaining Root Administrator.', 'LAST_ROOT_ADMIN_PROTECTED');
    }
  }

  const prevRole = target.role;
  const prevIsRootAdmin = target.isRootAdmin;

  if (role) target.role = role;
  if (typeof isRootAdmin === 'boolean') {
    target.isRootAdmin = isRootAdmin;
  } else if (role !== 'admin') {
    target.isRootAdmin = false;
  }

  await target.save();

  // Audit log
  await logAdminAction({
    req,
    action: 'USER_ROLE_UPDATED',
    targetId: target._id,
    details: {
      old: { role: prevRole, isRootAdmin: prevIsRootAdmin },
      new: { role: target.role, isRootAdmin: target.isRootAdmin },
    },
  });

  res.json({ success: true, user: target, message: `Role updated to "${target.role}"${target.isRootAdmin ? ' (Root Admin)' : ''}.` });
});

export const blockUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const target = await User.findById(req.params.id);
  if (!target || target.isDeleted) throw new ApiError(404, 'User not found.');

  // Cannot block a root admin
  if (target.isRootAdmin) {
    throw new ApiError(400, 'Root administrators cannot be blocked.', 'CANNOT_BLOCK_ROOT_ADMIN');
  }

  // Cannot block yourself
  if (target._id.toString() === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot block your own account.', 'CANNOT_BLOCK_SELF');
  }

  target.isBlocked = true;
  target.blockedReason = reason || 'Account blocked by administration';
  target.blockedAt = new Date();
  await target.save();

  // Immediately revoke all sessions
  await Session.deleteMany({ userId: target._id });

  // If seller, deactivate their products immediately
  if (target.role === 'seller') {
    await Product.updateMany({ sellerId: target._id }, { isActive: false });
    await Seller.findOneAndUpdate({ userId: target._id }, { sellerStatus: 'suspended', suspensionReason: target.blockedReason });
  }

  await logAdminAction({
    req,
    action: 'USER_BLOCKED',
    targetId: target._id,
    details: { reason: target.blockedReason },
  });

  res.json({ success: true, message: `User "${target.name}" has been blocked and sessions revoked.`, user: target });
});

export const unblockUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target || target.isDeleted) throw new ApiError(404, 'User not found.');

  target.isBlocked = false;
  target.blockedReason = '';
  target.blockedAt = null;
  await target.save();

  // If seller was active prior, reactivate their approved products
  if (target.role === 'seller') {
    const seller = await Seller.findOne({ userId: target._id });
    if (seller && seller.sellerStatus === 'active') {
      await Product.updateMany({ sellerId: target._id, status: 'approved' }, { isActive: true });
    }
  }

  await logAdminAction({
    req,
    action: 'USER_UNBLOCKED',
    targetId: target._id,
  });

  res.json({ success: true, message: `User "${target.name}" has been unblocked.`, user: target });
});

export const deleteUserAccount = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target || target.isDeleted) throw new ApiError(404, 'User not found.');

  if (target.isRootAdmin) {
    throw new ApiError(400, 'Root administrators cannot be deleted.', 'CANNOT_DELETE_ROOT_ADMIN');
  }

  if (target._id.toString() === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot delete your own account.', 'CANNOT_DELETE_SELF');
  }

  // Revoke all active sessions immediately
  await Session.deleteMany({ userId: target._id });

  // Clean up non-financial transient data
  await Cart.deleteOne({ userId: target._id });
  await Avatar.deleteMany({ userId: target._id });
  await Wardrobe.deleteMany({ userId: target._id });

  // If seller: deactivate listings
  if (target.role === 'seller') {
    await Product.updateMany({ sellerId: target._id }, { isActive: false, status: 'inactive' });
    await Seller.findOneAndUpdate({ userId: target._id }, { sellerStatus: 'suspended' });
  }

  // Soft-delete user: mark deleted, scrub password and sensitive contact while keeping ID
  // to preserve required financial, order, credit, and audit history!
  target.isDeleted = true;
  target.deletedAt = new Date();
  target.isBlocked = true;
  target.blockedReason = 'Account deleted by administrator';
  target.name = `[Deleted User ${target._id.toString().slice(-4)}]`;
  target.email = `deleted_${target._id}@deleted.svara.internal`;
  target.phone = undefined;
  target.phoneVerified = false;
  target.emailVerified = false;
  target.password = 'DELETED_ACCOUNT_NOLOGIN';
  target.addresses = [];
  await target.save();

  await logAdminAction({
    req,
    action: 'USER_DELETED',
    targetId: target._id,
    details: { originalRole: target.role },
  });

  res.json({ success: true, message: 'Account deleted safely. Financial, order, and audit history preserved.' });
});

export const createAdminUser = asyncHandler(async (req, res) => {
  if (!req.user.isRootAdmin) {
    throw new ApiError(403, 'Access denied. Only the Root Administrator can create administrators.', 'ROOT_ADMIN_REQUIRED');
  }

  const { name, email, password, isRootAdmin = false } = req.body;
  if (!name?.trim() || !email?.trim() || !password) {
    throw new ApiError(400, 'Name, email, and password are required.', 'VALIDATION_ERROR');
  }

  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long.', 'VALIDATION_ERROR');
  }

  const normEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normEmail });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.', 'EMAIL_EXISTS');
  }

  const newAdmin = await User.create({
    name: name.trim(),
    email: normEmail,
    password,
    role: 'admin',
    isRootAdmin: Boolean(isRootAdmin),
    emailVerified: true,
    sellerStatus: 'none',
  });

  const defaultAdminCredits = getDefaultCreditsForRole('admin');
  await CreditBalance.findOneAndUpdate(
    { userId: newAdmin._id },
    { $setOnInsert: { balance: defaultAdminCredits, reservedBalance: 0 } },
    { upsert: true }
  );

  await logAdminAction({
    req,
    action: 'ADMIN_CREATED',
    targetId: newAdmin._id,
    details: { email: newAdmin.email, isRootAdmin: newAdmin.isRootAdmin },
  });

  res.status(201).json({
    success: true,
    admin: {
      _id: newAdmin._id,
      name: newAdmin.name,
      email: newAdmin.email,
      role: newAdmin.role,
      isRootAdmin: newAdmin.isRootAdmin,
      createdAt: newAdmin.createdAt,
    },
    message: `Admin account created successfully for ${newAdmin.email}.`,
  });
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const [logs, total] = await Promise.all([
    AuditLog.find()
      .populate('performedBy', 'name email isRootAdmin role')
      .populate('targetId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    AuditLog.countDocuments(),
  ]);

  res.json({
    success: true,
    logs,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
});

// --- SELLER MANAGEMENT ---

export const getSellers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, status } = req.query;
  const filter = { role: 'seller' };
  if (status) filter.sellerStatus = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { businessName: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [sellers, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  // Aggregate product counts and sales metrics for each seller
  const sellerIds = sellers.map(s => s._id);

  const [productCounts, salesAgg] = await Promise.all([
    Product.aggregate([
      { $match: { sellerId: { $in: sellerIds } } },
      { $group: { _id: '$sellerId', count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', 'items.sellerId': { $in: sellerIds } } },
      { $unwind: '$items' },
      { $match: { 'items.sellerId': { $in: sellerIds } } },
      {
        $group: {
          _id: '$items.sellerId',
          totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          totalCommission: { $sum: '$items.commissionAmount' },
          sellerRevenue: { $sum: '$items.sellerRevenue' },
        },
      },
    ]),
  ]);

  const prodCountMap = Object.fromEntries(productCounts.map(p => [p._id.toString(), p.count]));
  const salesMap = Object.fromEntries(salesAgg.map(s => [s._id.toString(), s]));

  const enrichedSellers = sellers.map(seller => {
    const sId = seller._id.toString();
    const salesData = salesMap[sId] || { totalSales: 0, totalCommission: 0, sellerRevenue: 0 };
    return {
      ...seller.toObject(),
      productsCount: prodCountMap[sId] || 0,
      totalSales: salesData.totalSales,
      totalCommission: salesData.totalCommission,
      sellerRevenue: salesData.sellerRevenue,
    };
  });

  res.json({
    success: true,
    sellers: enrichedSellers,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
});

export const getSellerDetails = asyncHandler(async (req, res) => {
  const seller = await User.findOne({ _id: req.params.id, role: 'seller' });
  if (!seller) throw new ApiError(404, 'Seller not found.');

  const [products, salesAgg] = await Promise.all([
    Product.find({ sellerId: seller._id }).populate('category', 'name slug'),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', 'items.sellerId': seller._id } },
      { $unwind: '$items' },
      { $match: { 'items.sellerId': seller._id } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          totalCommission: { $sum: '$items.commissionAmount' },
          sellerRevenue: { $sum: '$items.sellerRevenue' },
          itemsSold: { $sum: '$items.quantity' },
        },
      },
    ]),
  ]);

  res.json({
    success: true,
    seller,
    products,
    analytics: salesAgg[0] || { totalSales: 0, totalCommission: 0, sellerRevenue: 0, itemsSold: 0 },
  });
});

export const updateSellerStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const allowedStatuses = ['active', 'pending', 'suspended', 'rejected'];
  if (!allowedStatuses.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${allowedStatuses.join(', ')}.`);
  }

  const updateFields = { sellerStatus: status };
  if (status === 'rejected') {
    updateFields.rejectionReason = reason || 'Application did not meet seller criteria';
  } else if (status === 'suspended') {
    updateFields.suspensionReason = reason || 'Account suspended for policy review';
  }

  const sellerUser = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'seller' },
    updateFields,
    { new: true }
  );
  if (!sellerUser) throw new ApiError(404, 'Seller not found.');

  await Seller.findOneAndUpdate(
    { userId: req.params.id },
    updateFields,
    { new: true }
  );
  await createNotification(
    sellerUser._id,
    'seller_status',
    'Seller account status updated',
    reason || `Your seller account is now ${status}.`,
    { referenceType: 'seller', referenceId: sellerUser._id }
  );

  // If seller is suspended or rejected, automatically hide their products from public catalog (Rule 6)
  if (status === 'suspended' || status === 'rejected') {
    await Product.updateMany(
      { sellerId: req.params.id },
      { isActive: false }
    );
  } else if (status === 'active') {
    // When reactivated, restore approved products
    await Product.updateMany(
      { sellerId: req.params.id, status: 'approved' },
      { isActive: true }
    );
  }

  res.json({
    success: true,
    seller: sellerUser,
    message: `Seller status updated to ${status}.`,
  });
});

export const getSellerProfileChanges = asyncHandler(async (req, res) => {
  const { status = 'pending' } = req.query;
  const filter = status === 'all' ? {} : { status };
  const requests = await SellerProfileChange.find(filter)
    .populate('sellerId', 'name email businessName sellerStatus')
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 });
  res.json({ success: true, requests });
});

export const reviewSellerProfileChange = asyncHandler(async (req, res) => {
  const { status, reason = '' } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Status must be approved or rejected.', 'VALIDATION_ERROR');
  }
  if (status === 'rejected' && !reason.trim()) {
    throw new ApiError(400, 'A reason is required when rejecting a profile change.', 'REJECTION_REASON_REQUIRED');
  }

  const request = await SellerProfileChange.findOne({ _id: req.params.id, status: 'pending' });
  if (!request) throw new ApiError(404, 'Pending seller profile change not found.');

  if (status === 'approved') {
    await Promise.all([
      User.findByIdAndUpdate(request.sellerId, request.changes, { runValidators: true }),
      Seller.findOneAndUpdate({ userId: request.sellerId }, request.changes, { runValidators: true }),
    ]);
  }
  request.status = status;
  request.reviewReason = reason.trim();
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  await request.save();
  await createNotification(
    request.sellerId,
    'seller_profile_change',
    `Profile change ${status}`,
    status === 'approved' ? 'Your business profile changes are now live.' : `Your profile change was rejected: ${reason.trim()}`,
    { referenceType: 'seller_profile_change', referenceId: request._id }
  );
  res.json({ success: true, request, message: `Profile change ${status}.` });
});


// --- COMMISSION SETTINGS ---

export const getCommissionSettings = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.getSettings();
  res.json({ success: true, settings });
});

export const updateCommissionSettings = asyncHandler(async (req, res) => {
  const { commissionRate } = req.body;
  const rate = Number(commissionRate);
  if (isNaN(rate) || rate < 0 || rate > 100) {
    throw new ApiError(400, 'Commission rate must be a number between 0 and 100.');
  }

  let settings = await PlatformSettings.findOne();
  if (!settings) {
    settings = await PlatformSettings.create({ commissionRate: rate, updatedBy: req.user._id });
  } else {
    settings.commissionRate = rate;
    settings.updatedBy = req.user._id;
    await settings.save();
  }

  res.json({ success: true, settings, message: `Platform commission rate set to ${rate}%.` });
});

// --- PRODUCT CATALOG & APPROVALS ---

export const getAdminProducts = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 100, category, status, search, sellerId, ownerType, stockStatus, sort = 'newest'
  } = req.query;

  const filter = {};
  if (status && status !== 'all') {
    filter.status = status;
  }
  if (ownerType && ownerType !== 'all') {
    filter.ownerType = ownerType;
  }
  if (sellerId) {
    filter.sellerId = sellerId;
  }
  if (stockStatus === 'inStock') {
    filter.stock = { $gte: 5 };
  } else if (stockStatus === 'lowStock') {
    filter.stock = { $gt: 0, $lt: 5 };
  } else if (stockStatus === 'outOfStock') {
    filter.stock = { $lte: 0 };
  }
  if (category) {
    if (category.match(/^[0-9a-fA-F]{24}$/)) {
      filter.category = category;
    } else {
      const cat = await Category.findOne({ slug: category });
      if (cat) filter.category = cat._id;
    }
  }
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
    ];
  }

  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
  };
  const sortBy = sortOptions[sort] || { createdAt: -1 };

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total, pendingCount, sellerProductsCount] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('sellerId', 'name email businessName phone profileImage')
      .sort(sortBy)
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
    Product.countDocuments({ status: 'pending' }),
    Product.countDocuments({ ownerType: 'seller' }),
  ]);

  res.json({
    success: true,
    products,
    total,
    pendingCount,
    sellerProductsCount,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
});

export const updateAdminProductStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stock, variants } = req.body;

  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, 'Product not found.');

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
  res.json({ success: true, product, message: 'Product stock updated successfully.' });
});

export const approveProduct = asyncHandler(async (req, res) => {
  const { shippingFee } = req.body;
  const existing = await Product.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Product not found.');

  let assignedFee = existing.shippingFee;
  if (shippingFee !== undefined && shippingFee !== null && shippingFee !== '') {
    const parsedFee = Number(shippingFee);
    if (isNaN(parsedFee) || parsedFee < 0) {
      throw new ApiError(400, 'Shipping fee must be a valid non-negative number.', 'INVALID_SHIPPING_FEE');
    }
    assignedFee = parsedFee;
  }

  // Spec §7: "Products without a valid shipping-fee assignment must not be published or checked out"
  if (assignedFee === null || assignedFee === undefined) {
    throw new ApiError(400, 'A shipping fee must be assigned before approving and publishing this product.', 'SHIPPING_FEE_REQUIRED');
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    {
      status: 'approved',
      isActive: true,
      shippingFee: assignedFee,
      moderation: { action: 'approved', reason: '', actedBy: req.user._id, actedAt: new Date() },
    },
    { new: true }
  ).populate('category', 'name slug').populate('sellerId', 'name businessName email');

  if (product.sellerId?._id) {
    await createNotification(
      product.sellerId._id,
      'product_moderation',
      'Product approved',
      `${product.name} is now approved with ₹${assignedFee} shipping fee and listed in the marketplace.`,
      { referenceType: 'product', referenceId: product._id }
    );
  }

  res.json({ success: true, product, message: `Product approved with ₹${assignedFee} shipping fee.` });
});

export const assignShippingFee = asyncHandler(async (req, res) => {
  const { shippingFee } = req.body;
  const parsedFee = Number(shippingFee);
  if (isNaN(parsedFee) || parsedFee < 0) {
    throw new ApiError(400, 'Shipping fee must be a valid non-negative number.', 'INVALID_SHIPPING_FEE');
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { shippingFee: parsedFee },
    { new: true }
  ).populate('sellerId', 'name businessName');

  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ success: true, product, message: `Shipping fee updated to ₹${parsedFee}.` });
});

export const batchApproveProducts = asyncHandler(async (req, res) => {
  const { approvals } = req.body; // Array of { id, shippingFee }
  if (!Array.isArray(approvals) || approvals.length === 0) {
    throw new ApiError(400, 'Approvals list must be a non-empty array of { id, shippingFee } objects.');
  }

  const results = [];
  for (const item of approvals) {
    try {
      const fee = Number(item.shippingFee);
      if (isNaN(fee) || fee < 0) {
        results.push({ id: item.id, success: false, error: 'Valid non-negative shipping fee is required.' });
        continue;
      }
      const product = await Product.findByIdAndUpdate(
        item.id,
        {
          status: 'approved',
          isActive: true,
          shippingFee: fee,
          moderation: { action: 'approved', reason: '', actedBy: req.user._id, actedAt: new Date() },
        },
        { new: true }
      );
      if (!product) {
        results.push({ id: item.id, success: false, error: 'Product not found.' });
      } else {
        results.push({ id: item.id, success: true, name: product.name, shippingFee: fee });
      }
    } catch (err) {
      results.push({ id: item.id, success: false, error: err.message });
    }
  }

  res.json({ success: true, results });
});

export const downloadProductPhoto = asyncHandler(async (req, res) => {
  const { id, photoIndex = 0 } = req.params;
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, 'Product not found.');

  const idx = Number(photoIndex);
  const image = product.images?.[idx];
  if (!image || !image.url) {
    throw new ApiError(404, 'Photo not found for this product.');
  }

  let downloadUrl = image.url;
  if (downloadUrl.includes('/upload/')) {
    downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/');
  }

  res.json({
    success: true,
    downloadUrl,
    filename: `${product.slug || 'product'}-photo-${idx + 1}.jpg`,
    originalUrl: image.url,
  });
});

export const rejectProduct = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) throw new ApiError(400, 'A correction reason is required when rejecting a product.', 'REJECTION_REASON_REQUIRED');
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { status: 'rejected', isActive: false, moderation: { action: 'rejected', reason: reason.trim(), actedBy: req.user._id, actedAt: new Date() } },
    { new: true }
  ).populate('sellerId', 'name');
  if (!product) throw new ApiError(404, 'Product not found.');
  if (product.sellerId?._id) {
    await createNotification(product.sellerId._id, 'product_moderation', 'Product needs correction', `${product.name} was rejected: ${reason.trim()}`, { referenceType: 'product', referenceId: product._id });
  }
  res.json({ success: true, product, message: 'Product listing rejected.' });
});

export const deactivateProduct = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) throw new ApiError(400, 'A reason is required when removing a product.', 'REMOVAL_REASON_REQUIRED');
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { status: 'inactive', isActive: false, moderation: { action: 'removed', reason: reason.trim(), actedBy: req.user._id, actedAt: new Date() } },
    { new: true }
  ).populate('sellerId', 'name');
  if (!product) throw new ApiError(404, 'Product not found.');
  if (product.sellerId?._id) {
    await createNotification(product.sellerId._id, 'product_moderation', 'Product removed from marketplace', `${product.name} was removed: ${reason.trim()}`, { referenceType: 'product', referenceId: product._id });
  }
  res.json({ success: true, product, message: 'Product removed from the marketplace.' });
});

// --- CATEGORY ORDERING ---

export const updateCategoryOrder = asyncHandler(async (req, res) => {
  const { orderList } = req.body; // Array of { id, order }
  if (!Array.isArray(orderList)) throw new ApiError(400, 'orderList must be an array of { id, order } objects.');

  const updatePromises = orderList.map(item =>
    Category.findByIdAndUpdate(item.id, { order: Number(item.order) })
  );
  await Promise.all(updatePromises);

  const categories = await Category.find().sort({ order: 1 });
  res.json({ success: true, categories, message: 'Category order updated successfully.' });
});

// --- ALL ORDERS & SALES (ADMIN VIEW) ---

export const getAllOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, paymentStatus } = req.query;
  const filter = {};
  if (status) filter.orderStatus = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'name email phone')
      .populate('items.productId', 'name slug images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    orders,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
});

export const getAllSales = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, startDate, endDate } = req.query;
  const matchFilter = { paymentStatus: 'paid' };
  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
    if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
  }

  const orders = await Order.find(matchFilter)
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });

  const sales = orders.flatMap(order =>
    order.items.map(item => ({
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerName: order.userId?.name || 'Customer',
      sellerName: item.sellerNameSnapshot || 'SVARA Direct',
      productName: item.name,
      quantity: item.quantity,
      price: item.price,
      grossSale: item.price * item.quantity,
      commissionRate: item.commissionRate || 0,
      commissionAmount: item.commissionAmount || 0,
      sellerRevenue: item.sellerRevenue || (item.price * item.quantity),
      orderStatus: order.orderStatus,
      date: order.createdAt,
    }))
  );

  const skip = (Number(page) - 1) * Number(limit);
  const paginatedSales = sales.slice(skip, skip + Number(limit));

  res.json({
    success: true,
    sales: paginatedSales,
    total: sales.length,
    page: Number(page),
    pages: Math.ceil(sales.length / Number(limit)),
  });
});

// --- EXCEL BULK IMPORT (ADMIN ONLY) ---

export const downloadExcelTemplate = asyncHandler(async (req, res) => {
  const buffer = generateExcelTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="svara_products_template.xlsx"');
  res.send(buffer);
});

export const previewExcelImport = asyncHandler(async (req, res) => {
  const excelFile = req.files?.excel?.[0];
  if (!excelFile) throw new ApiError(400, 'Excel file is required.');

  const imageFiles = req.files?.images || [];
  const previewResult = await parseAndValidateExcel(excelFile.buffer, imageFiles);

  res.json({ success: true, ...previewResult });
});

export const executeExcelImport = asyncHandler(async (req, res) => {
  const excelFile = req.files?.excel?.[0];
  if (!excelFile) throw new ApiError(400, 'Excel file is required.');

  const imageFiles = req.files?.images || [];
  const parsed = await parseAndValidateExcel(excelFile.buffer, imageFiles);

  const importResult = await executeBulkImport(parsed.preview, req.user._id);

  res.json({ success: true, result: importResult });
});

// --- EXISTING VTO, TRANSACTIONS, PACKAGES ---

export const getVtoGenerations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const [generations, total] = await Promise.all([
    VirtualTryOnGeneration.find()
      .populate('userId', 'name email')
      .populate('productId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    VirtualTryOnGeneration.countDocuments(),
  ]);
  res.json({ success: true, generations, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

export const getAdminTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const [transactions, total] = await Promise.all([
    CreditTransaction.find().populate('userId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    CreditTransaction.countDocuments(),
  ]);
  res.json({ success: true, transactions, total });
});

export const getAdminPackages = asyncHandler(async (req, res) => {
  const packages = await CreditPackage.find().sort({ order: 1 });
  res.json({ success: true, packages });
});

export const createPackage = asyncHandler(async (req, res) => {
  const pkg = await CreditPackage.create(req.body);
  res.status(201).json({ success: true, package: pkg });
});

export const updatePackage = asyncHandler(async (req, res) => {
  const pkg = await CreditPackage.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!pkg) throw new ApiError(404, 'Package not found.');
  res.json({ success: true, package: pkg });
});


// --- ORDER MANAGEMENT (ADMIN) ---

/** Approve or reject a customer-submitted UPI payment reference. */
export const verifyUpiPayment = asyncHandler(async (req, res) => {
  const { approve, reason = '' } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order || order.paymentMethod !== 'upi') throw new ApiError(404, 'UPI order not found.');
  if (!order.upi?.utr) throw new ApiError(400, 'The customer has not submitted a UPI reference yet.', 'NO_UTR');
  if (order.paymentStatus === 'paid') throw new ApiError(409, 'This payment is already verified.', 'ALREADY_PAID');

  if (approve) {
    order.upi.verifiedBy = req.user._id;
    order.upi.verifiedAt = new Date();
    await markOrderPaid(order, { note: `UPI payment verified (UTR ${order.upi.utr})`, by: req.user._id });
    return res.json({ success: true, order, message: 'Payment verified and order confirmed.' });
  }
  if (!reason.trim()) throw new ApiError(400, 'Give a reason so the customer can correct it.', 'VALIDATION_ERROR');
  order.upi.rejectionReason = reason.trim();
  order.upi.utr = '';
  order.upi.submittedAt = null;
  pushHistory(order, 'pending_payment', `UPI payment could not be verified: ${reason.trim()}`, req.user._id);
  await order.save();
  notifyCustomer(order, `UPI payment not verified — ${order.orderNumber}`, `${reason.trim()} Open the order to submit the correct reference.`, 'order_payment').catch(() => {});
  res.json({ success: true, order, message: 'Payment rejected; customer notified.' });
});

/**
 * Update order status — Exactly three values: Ordered -> Shipped -> Delivered (§10).
 * Only administrators can perform these transitions.
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note = '', trackingNumber = '', courier = '' } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');

  const normalizedCurrent = (order.orderStatus || '').toLowerCase();
  const normalizedTarget = (status || '').toLowerCase();

  // Validate allowed transitions (§10)
  // Transition 1: ordered -> shipped
  if (normalizedTarget === 'shipped') {
    if (normalizedCurrent !== 'ordered') {
      throw new ApiError(400, `Cannot ship an order that is currently "${order.orderStatus}". Orders must be in "Ordered" state to ship.`, 'INVALID_STATUS_TRANSITION');
    }

    order.orderStatus = 'Shipped';
    order.items.forEach((item) => {
      item.fulfillmentStatus = 'Shipped';
      if (trackingNumber) item.trackingNumber = trackingNumber.trim();
      if (courier) item.courier = courier.trim();
    });

    const shipNote = note || (trackingNumber ? `Shipped via ${courier || 'courier'} (${trackingNumber})` : 'Order shipped');
    pushHistory(order, 'Shipped', shipNote, req.user._id);
    await order.save();

    // Async customer notifications & email (§12)
    notifyCustomer(order, `Order ${order.orderNumber} Shipped`, shipNote, 'order_status', { email: false }).catch(() => {});
    sendOrderShippedEmail(order._id, { trackingNumber, courier }).catch(() => {});

    return res.json({ success: true, order, message: `Order status updated to Shipped.` });
  }

  // Transition 2: shipped -> delivered
  if (normalizedTarget === 'delivered') {
    if (normalizedCurrent !== 'shipped') {
      throw new ApiError(400, `Cannot deliver an order that is currently "${order.orderStatus}". Orders must be in "Shipped" state to deliver.`, 'INVALID_STATUS_TRANSITION');
    }

    order.orderStatus = 'Delivered';
    order.items.forEach((item) => {
      item.fulfillmentStatus = 'Delivered';
      item.fulfilledAt = new Date();
    });

    const deliverNote = note || 'Order delivered to customer';
    pushHistory(order, 'Delivered', deliverNote, req.user._id);
    await order.save();

    // Async customer notifications & email (§12)
    notifyCustomer(order, `Order ${order.orderNumber} Delivered`, 'Your order has been delivered! Thank you for shopping with SVARA.', 'order_status', { email: false }).catch(() => {});
    sendOrderDeliveredEmail(order._id).catch(() => {});

    return res.json({ success: true, order, message: `Order status updated to Delivered.` });
  }

  throw new ApiError(400, `Invalid order status "${status}". Allowed status transitions are Ordered -> Shipped and Shipped -> Delivered.`, 'INVALID_STATUS_TRANSITION');
});

/**
 * Record COD payment collection by administrator (§10, §11).
 * Allows payment status to be tracked independently from order status.
 */
export const recordCodPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.paymentMethod !== 'cod') {
    throw new ApiError(400, 'This action is only applicable to Cash on Delivery (COD) orders.', 'NOT_COD_ORDER');
  }

  if (order.paymentStatus === 'paid') {
    return res.json({ success: true, order, message: 'COD payment has already been recorded as collected.' });
  }

  order.paymentStatus = 'paid';
  pushHistory(order, 'paid', `COD payment of ₹${order.totalAmount} collected by administrator`, req.user._id);
  await order.save();

  res.json({ success: true, order, message: `COD payment of ₹${order.totalAmount} recorded as collected successfully.` });
});

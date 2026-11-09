import express from 'express';
import multer from 'multer';
import {
  getDashboardStats, getUsers, getUser, updateUserRole,
  blockUser, unblockUser, deleteUserAccount, createAdminUser, getAuditLogs,
  getVtoGenerations, getAdminTransactions,
  getAdminPackages, createPackage, updatePackage,
  getSellers, getSellerDetails, updateSellerStatus,
  getCommissionSettings, updateCommissionSettings,
  approveProduct, rejectProduct, deactivateProduct, updateCategoryOrder,
  assignShippingFee, batchApproveProducts, downloadProductPhoto, updateAdminProductStock,
  getSellerProfileChanges, reviewSellerProfileChange,
  getAllOrders, getAllSales, getAdminProducts, verifyUpiPayment, updateOrderStatus, recordCodPayment,
  downloadExcelTemplate, previewExcelImport, executeExcelImport,
} from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { adminOnly, rootAdminOnly } from '../middleware/admin.js';

// Multer memory storage configuration for Excel bulk import (accepts xlsx and images)
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB total payload limit for bulk batches
}).fields([
  { name: 'excel', maxCount: 1 },
  { name: 'images', maxCount: 200 },
]);

const router = express.Router();

// Strict security: all endpoints require authentication and admin role
router.use(protect, adminOnly);

// Overview & Analytics
router.get('/stats', getDashboardStats);
router.get('/sales', getAllSales);
router.get('/orders', getAllOrders);
router.patch('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/collect-cod', recordCodPayment);
router.post('/orders/:id/upi-verify', verifyUpiPayment);

// Users & Customers & Role Management
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id/role', rootAdminOnly, updateUserRole);
router.post('/users/:id/block', blockUser);
router.patch('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);
router.patch('/users/:id/unblock', unblockUser);
router.delete('/users/:id', deleteUserAccount);

// Root Admin role & admin account creation
router.post('/admins', rootAdminOnly, createAdminUser);
router.post('/create-admin', rootAdminOnly, createAdminUser);
router.get('/audit-logs', rootAdminOnly, getAuditLogs);

// Seller Management
router.get('/sellers', getSellers);
router.get('/sellers/:id', getSellerDetails);
router.patch('/sellers/:id/status', updateSellerStatus);
router.get('/seller-profile-changes', getSellerProfileChanges);
router.patch('/seller-profile-changes/:id', reviewSellerProfileChange);

// Commission Settings
router.get('/commission', getCommissionSettings);
router.put('/commission', updateCommissionSettings);

// Product Management, Approvals & Category Reordering
router.get('/products', getAdminProducts);
router.post('/products/batch-approve', batchApproveProducts);
router.patch('/products/:id/approve', approveProduct);
router.patch('/products/:id/shipping-fee', assignShippingFee);
router.patch('/products/:id/stock', updateAdminProductStock);
router.get('/products/:id/photos/:photoIndex/download', downloadProductPhoto);
router.patch('/products/:id/reject', rejectProduct);
router.patch('/products/:id/deactivate', deactivateProduct);
router.put('/categories/reorder', updateCategoryOrder);

// Excel Bulk Import (Admin-Only)
router.get('/import-products/template', downloadExcelTemplate);
router.post('/import-products/preview', excelUpload, previewExcelImport);
router.post('/import-products/execute', excelUpload, executeExcelImport);

// AI VTO Logs & Credits
router.get('/vto', getVtoGenerations);
router.get('/transactions', getAdminTransactions);
router.get('/packages', getAdminPackages);
router.post('/packages', createPackage);
router.put('/packages/:id', updatePackage);

export default router;

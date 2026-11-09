import express from 'express';
import { protect } from '../middleware/auth.js';
import { sellerOnly, activeSellerOnly } from '../middleware/seller.js';
import { uploadProductFields } from '../middleware/upload.js';
import { createProduct, updateProduct, deleteProduct } from '../controllers/productController.js';
import * as sellerController from '../controllers/sellerController.js';

const router = express.Router();

// Enforce authentication and seller role for all routes in this router
router.use(protect, sellerOnly);

// Dashboard (pending sellers can view status)
router.get('/dashboard', sellerController.getSellerDashboard);

// Products: viewing own products is allowed, but publishing/modifying requires ACTIVE status
router.get('/products', sellerController.getSellerProducts);
router.post('/products', activeSellerOnly, uploadProductFields, createProduct);
router.put('/products/:id', activeSellerOnly, uploadProductFields, updateProduct);
router.patch('/products/:id/stock', activeSellerOnly, sellerController.updateSellerProductStock);
router.delete('/products/:id', activeSellerOnly, deleteProduct);

// Orders & Sales
router.get('/orders', sellerController.getSellerOrders);
router.patch('/orders/:orderId/items/:itemId', sellerController.updateSellerOrderItem);
router.get('/sales', sellerController.getSellerSales);
router.get('/notifications', sellerController.getSellerNotifications);

// Profile
router.put('/profile', sellerController.updateSellerProfile);

export default router;

import express from 'express';
import {
  getCurateCategories,
  getCurateCategory,
  getCurateCategoryProducts,
  createCurateCategory,
  updateCurateCategory,
  deleteCurateCategory,
  reorderCurateCategories,
} from '../controllers/curateCategoryController.js';
import { protect } from '../middleware/auth.js';
import { adminOnly } from '../middleware/admin.js';
import { uploadSingle } from '../middleware/upload.js';

const router = express.Router();

// Public routes
router.get('/', getCurateCategories);
router.get('/:slug/products', getCurateCategoryProducts);
router.get('/:slug', getCurateCategory);

// Admin-protected routes
router.post('/', protect, adminOnly, uploadSingle, createCurateCategory);
router.put('/reorder', protect, adminOnly, reorderCurateCategories);
router.put('/:id', protect, adminOnly, uploadSingle, updateCurateCategory);
router.delete('/:id', protect, adminOnly, deleteCurateCategory);

export default router;

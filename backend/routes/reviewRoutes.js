import express from 'express';
import {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
  voteHelpful,
  adminModerateReview,
  getAdminReviews,
} from '../controllers/reviewController.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/admin.js';
import { uploadMultiple } from '../middleware/upload.js';

const router = express.Router();

// Public / optionally authenticated reviews per product
router.get('/product/:productId', optionalAuth, getProductReviews);

// Customer review actions
router.post('/product/:productId', protect, uploadMultiple, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.post('/:id/vote', protect, voteHelpful);

// Admin moderation actions
router.get('/admin/all', protect, adminOnly, getAdminReviews);
router.patch('/:id/moderate', protect, adminOnly, adminModerateReview);

export default router;

import express from 'express';
import {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct, searchProducts
} from '../controllers/productController.js';
import { protect } from '../middleware/auth.js';
import { sellerOrAdmin } from '../middleware/seller.js';
import { uploadProductFields } from '../middleware/upload.js';

const router = express.Router();

router.get('/search', searchProducts);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', protect, sellerOrAdmin, uploadProductFields, createProduct);
router.put('/:id', protect, sellerOrAdmin, uploadProductFields, updateProduct);
router.delete('/:id', protect, sellerOrAdmin, deleteProduct);

export default router;

import express from 'express';
import {
  createOrder,
  verifyOrderPayment,
  handleRazorpayWebhook,
  cancelOrder,
  submitUpiPayment,
  getUpiDetails,
  getOrders,
  getOrder,
  getShippingConfigHandler,
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public shipping configuration
router.get('/shipping-config', getShippingConfigHandler);

// Razorpay webhook — no auth, uses HMAC signature verification
// Raw body is needed for signature verification; express.json() already parses it
router.post('/webhook/razorpay', webhookLimiter, handleRazorpayWebhook);

// Authenticated routes
router.use(protect);
router.post('/', createOrder);
router.get('/', getOrders);
router.get('/:id', getOrder);
router.post('/:id/verify-payment', verifyOrderPayment);
router.post('/:id/cancel', cancelOrder);
router.get('/:id/upi', getUpiDetails);
router.post('/:id/upi', submitUpiPayment);

export default router;

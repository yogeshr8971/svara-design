import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  image: { type: String, default: '' },
  price: { type: Number, required: true }, // Server-authoritative snapshot price at time of order
  size: { type: String, default: '' },
  color: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sellerNameSnapshot: { type: String, default: 'SVARA Direct' },
  commissionRate: { type: Number, default: 0 },
  commissionAmount: { type: Number, default: 0 },
  sellerRevenue: { type: Number, default: 0 },
  fulfillmentStatus: {
    type: String,
    // Canonical values only after migrateOrderStatuses migration (§10)
    enum: ['Ordered', 'Shipped', 'Delivered', 'pending_payment', 'cancelled'],
    default: 'Ordered',
  },
  // Snapshot of per-product shipping fee at time of order
  shippingFee: { type: Number, default: 0 },
  // Snapshot of original/compare-at price for discount display
  originalPrice: { type: Number, default: null },
  trackingNumber: { type: String, default: '' },
  courier: { type: String, default: '' },
  fulfilledAt: { type: Date, default: null },
});

const shippingAddressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' },
});

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber: { type: String, unique: true },
    items: [orderItemSchema],
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentMethod: { type: String, enum: ['razorpay', 'upi', 'cod'], default: 'razorpay' },
    // pending   -> online payment not completed yet
    // confirmed -> Cash on Delivery order accepted (money collected on delivery)
    // paid      -> money received (gateway captured / UPI verified / COD cash collected)
    paymentStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    upi: {
      payeeVpa: { type: String, default: '' },
      utr: { type: String, default: '' }, // 12-digit UPI reference submitted by the customer
      submittedAt: { type: Date, default: null },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      verifiedAt: { type: Date, default: null },
      rejectionReason: { type: String, default: '' },
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        note: { type: String, default: '' },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        at: { type: Date, default: Date.now },
      },
    ],
    orderStatus: {
      type: String,
      // Exactly 5 canonical values after migrateOrderStatuses migration (§10)
      enum: ['Ordered', 'Shipped', 'Delivered', 'pending_payment', 'cancelled'],
      default: 'pending_payment',
    },
    subtotal: { type: Number, required: true },
    shippingAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    isInventoryDeducted: { type: Boolean, default: false },
    webhookProcessedEvents: [{ type: String }], // Idempotency: logs event IDs
    confirmationEmailSent: { type: Boolean, default: false },
    shippedEmailSent: { type: Boolean, default: false },
    deliveredEmailSent: { type: Boolean, default: false },
    cancelledReason: { type: String },
    notes: String,
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ 'items.sellerId': 1, paymentStatus: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentMethod: 1, paymentStatus: 1 });
orderSchema.index({ 'upi.utr': 1 }, { unique: true, partialFilterExpression: { 'upi.utr': { $type: 'string', $gt: '' } } });

orderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    this.orderNumber =
      'SVR' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase().padStart(2, '0');
  }
  next();
});

export default mongoose.model('Order', orderSchema);

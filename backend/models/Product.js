import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  sku: { type: String, trim: true },
  size: { type: String, trim: true },
  color: { type: String, trim: true },
  price: { type: Number, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  reservedStock: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    slug: { type: String, unique: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ownerType: { type: String, enum: ['admin', 'seller'], default: 'admin' },
    description: { type: String },
    shortDescription: { type: String },
    price: { type: Number, required: [true, 'Price is required'], min: 0 },
    compareAtPrice: { type: Number },
    // Per-product shipping fee assigned by admin during approval. null = not yet assigned.
    shippingFee: { type: Number, default: null, min: 0 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: [true, 'Product category is required'] },
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String, default: '' },
        public_id: { type: String, default: '' },
      },
    ],
    tryOnImage: {
      url: { type: String },
      public_id: { type: String },
    },
    colors: [{ name: String, hex: String }],
    sizes: [{ type: String }],
    variants: [variantSchema],
    stock: { type: Number, default: 0, min: 0 },
    brand: { type: String, default: 'SVARA' },
    material: { type: String },
    careInstructions: [{ type: String }],
    featured: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    tags: [{ type: String }],
    badges: [{ type: String, enum: ['SALE', 'TRENDING', 'NEW', 'FEATURED'] }],
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected', 'inactive'],
      default: 'approved',
    },
    isActive: { type: Boolean, default: true },
    moderation: {
      reason: { type: String, default: '' },
      action: { type: String, enum: ['', 'approved', 'rejected', 'deactivated', 'removed'], default: '' },
      actedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      actedAt: { type: Date, default: null },
    },
    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
      distribution: {
        5: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        1: { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/** Virtual discount percentage (§8) */
productSchema.virtual('discountPercentage').get(function () {
  if (this.compareAtPrice && this.compareAtPrice > this.price) {
    return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
  }
  return 0;
});

productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, status: 1, isActive: 1, price: 1 });
productSchema.index({ sellerId: 1, status: 1 });
productSchema.index({ status: 1, isActive: 1, createdAt: -1 });

// Ensure total stock reflects variants when provided
productSchema.pre('save', function (next) {
  if (this.variants && this.variants.length > 0) {
    this.stock = this.variants.reduce((total, v) => total + (v.stock || 0), 0);
  }
  next();
});

export default mongoose.model('Product', productSchema);

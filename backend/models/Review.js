import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    rating: {
      type: Number,
      required: [true, 'Rating (1 to 5) is required'],
      min: 1,
      max: 5,
    },
    title: { type: String, trim: true, maxlength: 120 },
    comment: { type: String, required: [true, 'Review comment is required'], trim: true, maxlength: 2000 },
    images: [
      {
        url: String,
        public_id: String,
      },
    ],
    isVerifiedPurchase: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: true }, // Default approved unless flagged
    moderationReason: { type: String, default: '' },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    isEdited: { type: Boolean, default: false },
    helpfulCount: { type: Number, default: 0 },
    helpfulVotes: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        vote: { type: String, enum: ['helpful', 'unhelpful'], default: 'helpful' },
      },
    ],
  },
  { timestamps: true }
);

// One review per customer per product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, isApproved: 1, createdAt: -1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ productId: 1, orderId: 1, userId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Review', reviewSchema);

import mongoose from 'mongoose';

const sellerProfileChangeSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    changes: {
      businessName: { type: String, trim: true },
      businessAddress: { type: String, trim: true },
      gstNumber: { type: String, trim: true },
      sellerDescription: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewReason: { type: String, trim: true, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sellerProfileChangeSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

export default mongoose.model('SellerProfileChange', sellerProfileChangeSchema);

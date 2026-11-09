import mongoose from 'mongoose';

const sellerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: [true, 'Contact representative name is required'], trim: true },
    email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    businessName: { type: String, required: [true, 'Store/Business name is required'], trim: true },
    businessAddress: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    sellerDescription: { type: String, default: '' },
    sellerStatus: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String, default: '' },
    suspensionReason: { type: String, default: '' },
    phone: { type: String, default: '' },
    profileImage: { type: String, default: '' },
    commissionRate: { type: Number, default: 10, min: 0, max: 100 },
    bankDetails: {
      accountHolderName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      bankName: { type: String, default: '' },
    },
    metrics: {
      totalSales: { type: Number, default: 0 },
      totalCommission: { type: Number, default: 0 },
      sellerRevenue: { type: Number, default: 0 },
      productsSold: { type: Number, default: 0 },
      ordersCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

sellerSchema.index({ businessName: 1 });
sellerSchema.index({ sellerStatus: 1 });

export default mongoose.model('Seller', sellerSchema);

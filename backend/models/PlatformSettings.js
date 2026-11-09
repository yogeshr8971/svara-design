import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema(
  {
    commissionRate: { type: Number, default: 10, min: 0, max: 100 },
    freeShippingThreshold: { type: Number, default: 2000, min: 0 },
    shippingCost: { type: Number, default: 99, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Ensure only one settings document exists (singleton pattern)
platformSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export default mongoose.model('PlatformSettings', platformSettingsSchema);

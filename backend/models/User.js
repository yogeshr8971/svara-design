import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true },
  country: { type: String, default: 'India' },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
    role: { type: String, enum: ['user', 'seller', 'admin'], default: 'user' },
    isRootAdmin: { type: Boolean, default: false },

    // Account blocking
    isBlocked: { type: Boolean, default: false },
    blockedReason: { type: String, default: '' },
    blockedAt: { type: Date, default: null },

    // Soft deletion for compliance and history preservation
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    // Customer profile fields
    phone: { type: String, trim: true }, // stored as E.164 (+91XXXXXXXXXX); collected but not SMS-verified
    emailVerified: { type: Boolean, default: false },
    // phoneVerified removed — verification is email-only now
    profileImage: { type: String },
    addresses: [addressSchema],

    // Seller profile fields (only relevant when role === 'seller')
    businessName: { type: String, trim: true },
    businessAddress: { type: String },
    gstNumber: { type: String },
    sellerDescription: { type: String },
    sellerStatus: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'rejected', 'none'],
      default: 'none',
    },
    rejectionReason: { type: String },
    suspensionReason: { type: String },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ isBlocked: 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ isRootAdmin: 1 });
// Partial phone uniqueness index removed (was tied to phoneVerified which is gone).
// See: npm run migrate:phone-index to drop the old index from existing collections.
userSchema.index({ sellerStatus: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);

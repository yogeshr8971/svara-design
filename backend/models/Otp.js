import mongoose from 'mongoose';

// One live OTP per (identifier, purpose). Auto-deleted by the TTL index after expiry.
const otpSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, index: true }, // lowercase email or E.164 phone
    channel: { type: String, enum: ['email', 'sms'], required: true },
    purpose: { type: String, enum: ['register', 'login', 'password-reset'], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ identifier: 1, purpose: 1 }, { unique: true });

export default mongoose.model('Otp', otpSchema);

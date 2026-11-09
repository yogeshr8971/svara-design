import mongoose from 'mongoose';

// Server-side session so "stay signed in until logout" is real and logout truly revokes access.
const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sid: { type: String, required: true, unique: true },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }, // sliding window, see middleware/auth.js
  },
  { timestamps: true }
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Session', sessionSchema);

// One-off: users created before OTP verification existed are grandfathered as email-verified.
// Run once after deploying:  npm run migrate:verification
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

await mongoose.connect(process.env.MONGODB_URI);
const r = await User.updateMany({ emailVerified: { $ne: true } }, { $set: { emailVerified: true } });
console.log(`Marked ${r.modifiedCount} existing user(s) as email-verified.`);
await mongoose.disconnect();

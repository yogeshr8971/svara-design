/**
 * migrate:phone-index
 * One-time script: drops the old `phone_1` unique partial index (phoneVerified: true)
 * from the users collection. Safe to run multiple times (idempotent).
 *
 * Usage: npm run migrate:phone-index
 */
import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Fix Node.js Windows SRV query ECONNREFUSED bug on mongodb+srv://
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore fallback
}

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

mongoose.connect(MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection('users');
  const indexes = await col.indexes();
  const target = indexes.find((i) => i.name === 'phone_1');
  if (!target) {
    console.log('✅  phone_1 index not found — nothing to drop (already clean).');
  } else {
    await col.dropIndex('phone_1');
    console.log('✅  Dropped phone_1 unique index from users collection.');
  }
  await mongoose.disconnect();
  process.exit(0);
}).catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

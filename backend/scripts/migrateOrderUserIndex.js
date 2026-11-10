/**
 * migrate:order-index
 * One-time script: drops any stale unique index on { userId: 1 } from the
 * orders collection. A unique index on userId prevents the same user from
 * placing more than one order. Safe to run multiple times (idempotent).
 *
 * Usage: npm run migrate:order-index
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
  const col = db.collection('orders');
  const indexes = await col.indexes();

  console.log('Current indexes on orders collection:');
  indexes.forEach((idx) => {
    console.log(`  name=${idx.name}  key=${JSON.stringify(idx.key)}  unique=${!!idx.unique}`);
  });

  // Find any index that is unique AND whose key is exactly { userId: 1 }
  const targets = indexes.filter((idx) => {
    if (!idx.unique) return false;
    const keys = Object.keys(idx.key);
    return keys.length === 1 && keys[0] === 'userId' && idx.key.userId === 1;
  });

  if (targets.length === 0) {
    console.log('✅  No stale unique userId index found on orders — nothing to drop (already clean).');
  } else {
    for (const target of targets) {
      await col.dropIndex(target.name);
      console.log(`✅  Dropped unique userId index "${target.name}" from orders collection.`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}).catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

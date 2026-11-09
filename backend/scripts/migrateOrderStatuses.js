/**
 * migrateOrderStatuses.js
 * One-off migration: normalise legacy order/item statuses to the canonical 3-stage set.
 *
 * Run (dry-run first!):
 *   npm run migrate:orders -- --dry-run
 *   npm run migrate:orders
 *
 * Idempotent — safe to run multiple times; only touches documents that still need changing.
 * Logs counts at the end.
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Order from '../models/Order.js';

// Fix Node.js Windows SRV query ECONNREFUSED bug
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore fallback
}

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Map a legacy orderStatus to the canonical value.
 * Returns null when no change is needed (already correct).
 *
 * Rules:
 *  - placed / processing / confirmed / paid  →  "Ordered" (if paid or COD) else "pending_payment"
 *  - lowercase ordered/shipped/delivered     →  capitalised variant
 *  - pending_payment / cancelled             →  leave as-is (null)
 *  - Ordered / Shipped / Delivered           →  leave as-is (null)
 */
function mapOrderStatus(status, paymentStatus, paymentMethod) {
  const s = (status || '').toLowerCase();

  // Already canonical — only fix capitalisation for lowercase variants
  if (s === 'pending_payment' || s === 'cancelled') return null; // correct, leave
  if (status === 'Ordered')   return null;
  if (status === 'Shipped')   return null;
  if (status === 'Delivered') return null;

  // Capitalise correct but lowercase values
  if (status === 'ordered')   return 'Ordered';
  if (status === 'shipped')   return 'Shipped';
  if (status === 'delivered') return 'Delivered';

  // Legacy values → canonical
  if (['placed', 'processing', 'confirmed', 'paid'].includes(s)) {
    const isEffectivelyPaid = paymentStatus === 'paid' || paymentMethod === 'cod';
    return isEffectivelyPaid ? 'Ordered' : 'pending_payment';
  }

  return null; // unknown — leave untouched
}

/**
 * Map a legacy item fulfillmentStatus to canonical value.
 * Returns null when no change is needed.
 */
function mapItemStatus(status) {
  const s = (status || '').toLowerCase();

  if (status === 'Ordered')   return null;
  if (status === 'Shipped')   return null;
  if (status === 'Delivered') return null;
  if (status === 'cancelled') return null;
  if (status === 'pending_payment') return null; // keep as-is per spec

  if (status === 'ordered')   return 'Ordered';
  if (status === 'shipped')   return 'Shipped';
  if (status === 'delivered') return 'Delivered';

  // Legacy item statuses → Ordered (item was accepted)
  if (['placed', 'processing', 'confirmed', 'paid'].includes(s)) return 'Ordered';

  return null; // unknown — leave untouched
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[migrate:orders] Connected to MongoDB. DRY_RUN=${DRY_RUN}\n`);

  // Fetch all orders (use lean() for fast read; re-fetch with model for writes)
  const orders = await Order.find({}).lean();
  let checked = 0, changed = 0, skipped = 0, errors = 0;

  for (const raw of orders) {
    checked++;
    const newOrderStatus = mapOrderStatus(raw.orderStatus, raw.paymentStatus, raw.paymentMethod);
    const itemNewStatuses = (raw.items || []).map((item) => mapItemStatus(item.fulfillmentStatus));
    const needsChange = newOrderStatus !== null || itemNewStatuses.some((c) => c !== null);

    if (!needsChange) { skipped++; continue; }

    if (DRY_RUN) {
      const itemSummary = itemNewStatuses.map((c, i) => c ? `item[${i}]: ${raw.items[i].fulfillmentStatus}→${c}` : null).filter(Boolean).join('; ');
      console.log(
        `  [DRY] ${raw.orderNumber || raw._id}: orderStatus ${raw.orderStatus}→${newOrderStatus ?? '(unchanged)'}${itemSummary ? ' | ' + itemSummary : ''}`
      );
      changed++;
      continue;
    }

    // Write: re-fetch the live document so Mongoose validators run
    try {
      const doc = await Order.findById(raw._id);
      if (!doc) { errors++; continue; }

      if (newOrderStatus) doc.orderStatus = newOrderStatus;
      doc.items.forEach((item, i) => {
        if (itemNewStatuses[i]) item.fulfillmentStatus = itemNewStatuses[i];
      });
      doc.statusHistory.push({ status: 'normalised', note: 'Status normalised', at: new Date() });

      await doc.save();
      changed++;
      console.log(`  [MIGRATED] ${doc.orderNumber}: ${raw.orderStatus} → ${doc.orderStatus}`);
    } catch (err) {
      errors++;
      console.error(`  [ERROR] ${raw.orderNumber || raw._id}:`, err.message);
    }
  }

  console.log(
    `\n[migrate:orders] Done.` +
    ` checked=${checked}, changed=${changed}, skipped=${skipped}, errors=${errors}`
  );
  if (DRY_RUN) console.log('[migrate:orders] Dry run — no documents were written.');
  await mongoose.disconnect();
}

run().catch((err) => { console.error('[migrate:orders] Fatal:', err); process.exit(1); });

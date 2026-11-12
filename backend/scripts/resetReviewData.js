import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { updateProductRatingStats } from '../controllers/reviewController.js';

// Fix Node.js Windows SRV query ECONNREFUSED bug on mongodb+srv://
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore fallback
}

const APPLY = process.argv.includes('--apply');

async function run() {
  const MONGO_URI = process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log(`[resetReviewData] Connected to MongoDB. Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  // (a) Reviews with no orderId or isVerifiedPurchase !== true are dummy
  const dummyFilter = {
    $or: [
      { orderId: null },
      { orderId: { $exists: false } },
      { isVerifiedPurchase: { $ne: true } },
    ],
  };

  const dummyReviews = await Review.find(dummyFilter, '_id').lean();
  console.log(`Found ${dummyReviews.length} dummy review(s):`);
  dummyReviews.forEach((r) => {
    console.log(`  - ${r._id}`);
  });

  if (APPLY) {
    if (dummyReviews.length > 0) {
      const result = await Review.deleteMany({ _id: { $in: dummyReviews.map((r) => r._id) } });
      console.log(`\nDeleted ${result.deletedCount} dummy review(s).`);
    } else {
      console.log('\nNo dummy reviews to delete.');
    }
  } else {
    console.log(`\n[DRY RUN] Would delete ${dummyReviews.length} dummy review(s). Use --apply to execute.`);
  }

  // (b) For every Product call the exported updateProductRatingStats(product._id)
  const products = await Product.find({}, '_id name').lean();
  console.log(`\nRecalculating ratings for ${products.length} product(s)...`);

  if (APPLY) {
    for (const p of products) {
      const stats = await updateProductRatingStats(p._id);
      console.log(`  Updated ${p._id} (${p.name}): avg=${stats.average}, count=${stats.count}`);
    }
    console.log(`\n✅ Finished updating rating stats for ${products.length} product(s).`);
  } else {
    console.log(`[DRY RUN] Would update rating stats for ${products.length} product(s). Use --apply to execute.`);
  }

  await mongoose.disconnect();
  console.log('\n[resetReviewData] Complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[resetReviewData] Fatal error:', err);
  process.exit(1);
});

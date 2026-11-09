import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Category from '../models/Category.js';
import CurateCategory from '../models/CurateCategory.js';
import Product from '../models/Product.js';

const OFFICIAL_CATEGORIES = [
  {
    name: 'Dress',
    slug: 'dress',
    description: 'Designer dresses, gowns, and bespoke apparel silhouettes',
    displayOrder: 1,
    order: 1,
    image: { url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800' },
    curateLook: {
      enabled: true,
      displayName: 'Dress',
      rules: { requiresColor: true, requiresSize: true },
    },
  },
  {
    name: 'Handbag',
    slug: 'handbag',
    description: 'Luxury handbags, totes, and artisanal clutches',
    displayOrder: 2,
    order: 2,
    image: { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800' },
    curateLook: {
      enabled: true,
      displayName: 'Handbag',
      rules: { requiresColor: true, requiresSize: false },
    },
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    description: 'Designer heels, flats, and luxury footwear',
    displayOrder: 3,
    order: 3,
    image: { url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800' },
    curateLook: {
      enabled: true,
      displayName: 'Footwear',
      rules: { requiresColor: false, requiresSize: true },
    },
  },
  {
    name: 'Earrings',
    slug: 'earrings',
    description: 'Statement drop earrings, polki studs, and fine jewelry',
    displayOrder: 4,
    order: 4,
    image: { url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800' },
    curateLook: {
      enabled: true,
      displayName: 'Earrings',
      rules: { requiresColor: false, requiresSize: false },
    },
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Belts, scarves, and signature fashion accessories',
    displayOrder: 5,
    order: 5,
    image: { url: 'https://images.unsplash.com/photo-1611591475819-79b8b7322e39?w=800' },
    curateLook: {
      enabled: true,
      displayName: 'Accessories',
      rules: { requiresColor: false, requiresSize: false },
    },
  },
];

async function runMigration() {
  await connectDB();
  console.log('🔄 Starting category cleanup and product re-linking...');

  // 1. Upsert official 5 categories
  const catDocMap = {};
  for (const def of OFFICIAL_CATEGORIES) {
    let cat = await Category.findOne({ slug: def.slug });
    if (!cat) {
      cat = await Category.create({
        name: def.name,
        slug: def.slug,
        description: def.description,
        displayOrder: def.displayOrder,
        order: def.order,
        image: def.image,
        isActive: true,
        active: true,
        curateLook: def.curateLook,
      });
      console.log(` Created category: ${def.name} (${def.slug})`);
    } else {
      cat.name = def.name;
      cat.description = def.description;
      cat.displayOrder = def.displayOrder;
      cat.order = def.order;
      cat.isActive = true;
      cat.active = true;
      cat.curateLook = def.curateLook;
      if (def.image?.url && (!cat.image?.url || cat.image.url === '')) {
        cat.image = def.image;
      }
      await cat.save();
      console.log(` Updated category: ${def.name} (${def.slug})`);
    }
    catDocMap[def.slug] = cat;
  }

  // 2. Re-assign all products to the 5 official categories
  const products = await Product.find({}).populate('category');
  console.log(` Found ${products.length} products to verify/re-link`);

  for (const p of products) {
    const oldSlug = p.category?.slug || '';
    const nameLower = (p.name || '').toLowerCase();
    let newSlug = 'dress';

    if (nameLower.includes('earring') || nameLower.includes('drop earring') || nameLower.includes('chandrika')) {
      newSlug = 'earrings';
    } else if (
      nameLower.includes('tote') ||
      nameLower.includes('bag') ||
      nameLower.includes('clutch') ||
      nameLower.includes('minaudière') ||
      oldSlug === 'handbags' ||
      oldSlug === 'hand-bag'
    ) {
      newSlug = 'handbag';
    } else if (
      nameLower.includes('heel') ||
      nameLower.includes('mule') ||
      nameLower.includes('shoe') ||
      nameLower.includes('boot') ||
      oldSlug === 'footwear' ||
      oldSlug === 'foot-wear'
    ) {
      newSlug = 'footwear';
    } else if (
      nameLower.includes('choker') ||
      nameLower.includes('scarf') ||
      nameLower.includes('belt') ||
      oldSlug === 'accessories'
    ) {
      newSlug = 'accessories';
    } else {
      // Apparel (dresses, tops, jackets, skirts, jeans, co-ords) all link to Dress
      newSlug = 'dress';
    }

    const targetCat = catDocMap[newSlug];
    if (targetCat) {
      p.category = targetCat._id;
      // Ensure product is approved & active so it displays in Curate Look & Shop All
      p.status = 'approved';
      p.isActive = true;
      await p.save();
      console.log(`   Product "${p.name}" -> ${targetCat.name} (${targetCat.slug})`);
    }
  }

  // 3. Delete legacy categories
  const legacySlugs = [
    'ethnic-wear',
    'tops',
    'jeans',
    'skirts',
    'jackets',
    'coord-sets',
    'dresses',
    'handbags',
    'hand-bag',
    'foot-wear',
  ];
  const deleteResult = await Category.deleteMany({ slug: { $in: legacySlugs } });
  console.log(`🗑️ Deleted ${deleteResult.deletedCount} legacy categories from categories collection.`);

  // 4. Clean up and synchronize CurateCategory collection
  await CurateCategory.deleteMany({});
  for (const def of OFFICIAL_CATEGORIES) {
    const cat = catDocMap[def.slug];
    await CurateCategory.create({
      name: def.name,
      slug: def.slug,
      categoryId: cat._id,
      displayName: def.curateLook.displayName,
      description: def.description,
      sortOrder: def.displayOrder,
      image: def.image,
      isActive: true,
    });
    console.log(` Synced CurateCategory: ${def.name}`);
  }

  console.log('✅ Migration finished successfully! Categories and Curate Look stages are 100% in sync.');
  await mongoose.disconnect();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

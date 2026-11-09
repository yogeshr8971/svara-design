import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('DNS warning:', e.message);
}

const { default: User } = await import('../models/User.js');
const { default: Seller } = await import('../models/Seller.js');
const { default: Category } = await import('../models/Category.js');
const { default: Product } = await import('../models/Product.js');
const { default: PlatformSettings } = await import('../models/PlatformSettings.js');

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGODB_URI not found in .env');
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log('✅ Connected to MongoDB');

// 1. Ensure Platform Settings
let settings = await PlatformSettings.findOne();
if (!settings) {
  settings = await PlatformSettings.create({ commissionRate: 10 });
  console.log('✅ Created PlatformSettings with 10% commission');
} else {
  console.log(`ℹ️ PlatformSettings exists with ${settings.commissionRate}% commission`);
}

// 2. Ensure / Sync Seller in Users and Sellers Collections
let sellerUser = await User.findOne({ email: 'seller@svara.in' });
if (!sellerUser) {
  sellerUser = await User.create({
    name: 'Priya Sharma',
    email: 'seller@svara.in',
    password: 'Seller@123',
    role: 'seller',
    businessName: 'Silk & Stone Atelier',
    businessAddress: 'Bandra West, Mumbai, Maharashtra',
    gstNumber: '27AABCS1429B1Z8',
    sellerDescription: 'Contemporary Indian couture, luxury leather handbags, and handcrafted bespoke accessories.',
    sellerStatus: 'active',
    phone: '+91 98765 43210',
  });
  console.log('✅ Created demo seller in users collection (seller@svara.in / Seller@123)');
} else {
  sellerUser.role = 'seller';
  sellerUser.businessName = sellerUser.businessName || 'Silk & Stone Atelier';
  sellerUser.sellerStatus = sellerUser.sellerStatus || 'active';
  await sellerUser.save();
  console.log('ℹ️ Demo seller user exists in users collection');
}

// Sync all users with role 'seller' into the 'sellers' collection
const allSellerUsers = await User.find({ role: 'seller' });
for (const sUser of allSellerUsers) {
  await Seller.findOneAndUpdate(
    { userId: sUser._id },
    {
      userId: sUser._id,
      name: sUser.name,
      email: sUser.email,
      businessName: sUser.businessName || sUser.name,
      businessAddress: sUser.businessAddress || 'Mumbai, Maharashtra',
      gstNumber: sUser.gstNumber || '27AABCS1429B1Z8',
      sellerDescription: sUser.sellerDescription || 'Designer Atelier Partner',
      sellerStatus: sUser.sellerStatus || 'active',
      phone: sUser.phone || '+91 98765 43210',
      commissionRate: 10,
    },
    { upsert: true, new: true }
  );
}
console.log(`✅ Synchronized ${allSellerUsers.length} seller(s) into MongoDB 'sellers' collection`);

// 3. Ensure Primary Sequential Shopping Categories
const targetCategories = [
  {
    name: 'Dress',
    slug: 'dress',
    description: 'Signature haute couture gowns and elegant day dresses',
    order: 1,
    displayOrder: 1,
    active: true,
    isActive: true,
    image: { url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80' },
  },
  {
    name: 'Handbag',
    slug: 'handbag',
    description: 'Designer leather handbags, clutches, and structured totes',
    order: 2,
    displayOrder: 2,
    active: true,
    isActive: true,
    image: { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80' },
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    description: 'Artisanal stiletto heels, luxury mules, and embellished sandals',
    order: 3,
    displayOrder: 3,
    active: true,
    isActive: true,
    image: { url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80' },
  },
  {
    name: 'Earrings',
    slug: 'earrings',
    description: 'Statement drop earrings, polki studs, and fine jewelry',
    order: 4,
    displayOrder: 4,
    active: true,
    isActive: true,
    image: { url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80' },
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Bespoke statement jewelry, belts, and delicate scarves',
    order: 5,
    displayOrder: 5,
    active: true,
    isActive: true,
    image: { url: 'https://images.unsplash.com/photo-1611591475819-79b8b7322e39?w=800&q=80' },
  },
];

for (const cat of targetCategories) {
  await Category.findOneAndUpdate(
    { slug: cat.slug },
    { $set: cat },
    { upsert: true, new: true }
  );
}
console.log('✅ Updated all sequential shopping categories in MongoDB');

// Retrieve all categories map
const allCats = await Category.find();
const catMap = Object.fromEntries(allCats.map(c => [c.slug, c._id]));

// 4. Update ALL existing products in MongoDB with schema defaults
const existingUpdateResult = await Product.updateMany(
  {
    $or: [
      { status: { $exists: false } },
      { isActive: { $exists: false } },
      { ownerType: { $exists: false } },
      { badges: { $exists: false } },
    ]
  },
  {
    $set: {
      status: 'approved',
      isActive: true,
      ownerType: 'admin',
      sellerId: null,
    }
  }
);
console.log(`✅ Updated existing products with approved status and active flags (modified: ${existingUpdateResult.modifiedCount})`);

// Ensure badges array is populated based on featured/trending
const allProds = await Product.find({ badges: { $size: 0 } });
for (const p of allProds) {
  const badges = [];
  if (p.featured) badges.push('FEATURED');
  if (p.trending) badges.push('TRENDING');
  if (badges.length === 0) badges.push('NEW');
  p.badges = badges;
  await p.save();
}

// 5. Seed Handbags, Footwear, and Accessories products if missing
const sampleMarketplaceProducts = [
  // --- HANDBAGS (STAGE 2) ---
  {
    name: 'Palermo Saffiano Leather Tote',
    slug: 'palermo-saffiano-leather-tote',
    category: catMap['handbags'],
    subcategory: 'Totes',
    price: 3499,
    compareAtPrice: 4999,
    stock: 25,
    sizes: ['One Size'],
    colors: [{ name: 'Caramel', hex: '#8B5A2B' }, { name: 'Black', hex: '#1C1C1C' }],
    material: 'Saffiano Leather',
    brand: 'Silk & Stone Atelier',
    ownerType: 'seller',
    sellerId: sellerUser._id,
    status: 'approved',
    isActive: true,
    badges: ['FEATURED', 'TRENDING'],
    images: [
      { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80', alt: 'Palermo Leather Tote', public_id: '' },
      { url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80', alt: 'Palermo Tote Detail', public_id: '' },
    ],
    tryOnImage: { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80', public_id: '' },
    description: 'Handcrafted Italian Saffiano leather tote with polished brass hardware and roomy compartmentalized interior.',
    shortDescription: 'Luxurious Saffiano leather structured tote with dual carry handles.',
    tags: ['handbag', 'tote', 'leather', 'luxury'],
  },
  {
    name: 'Aura Quilted Chain Shoulder Bag',
    slug: 'aura-quilted-chain-shoulder-bag',
    category: catMap['handbags'],
    subcategory: 'Crossbody',
    price: 2799,
    compareAtPrice: 3899,
    stock: 30,
    sizes: ['One Size'],
    colors: [{ name: 'Champagne', hex: '#F7E7CE' }, { name: 'Noir', hex: '#000000' }],
    material: 'Quilted Vegan Leather',
    brand: 'SVARA',
    ownerType: 'admin',
    sellerId: null,
    status: 'approved',
    isActive: true,
    badges: ['SALE', 'NEW'],
    images: [
      { url: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&q=80', alt: 'Aura Quilted Bag', public_id: '' },
    ],
    tryOnImage: { url: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&q=80', public_id: '' },
    description: 'Chic quilted crossbody with an intertwined champagne gold chain strap and magnetic lock clasp.',
    shortDescription: 'Everyday glamour with a diamond-quilted finish and gleaming chain strap.',
    tags: ['handbag', 'crossbody', 'quilted', 'chain'],
  },
  {
    name: 'Ophelia Silk Minaudière Evening Clutch',
    slug: 'ophelia-silk-minaudiere-evening-clutch',
    category: catMap['handbags'],
    subcategory: 'Clutches',
    price: 2199,
    stock: 20,
    sizes: ['One Size'],
    colors: [{ name: 'Emerald', hex: '#046307' }, { name: 'Gold', hex: '#D4AF37' }],
    material: 'Mulberry Raw Silk',
    brand: 'Silk & Stone Atelier',
    ownerType: 'seller',
    sellerId: sellerUser._id,
    status: 'approved',
    isActive: true,
    badges: ['NEW'],
    images: [
      { url: 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800&q=80', alt: 'Silk Evening Clutch', public_id: '' },
    ],
    tryOnImage: { url: 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800&q=80', public_id: '' },
    description: 'Structured evening box clutch lined in handwoven mulberry silk with mother-of-pearl push lock.',
    shortDescription: 'The quintessential evening box clutch for red carpet gala events.',
    tags: ['clutch', 'evening', 'silk', 'handbag'],
  },

  // --- FOOTWEAR (STAGE 3) ---
  {
    name: 'Siren Pointed Strappy Heels',
    slug: 'siren-pointed-strappy-heels',
    category: catMap['footwear'],
    subcategory: 'Heels',
    price: 2999,
    compareAtPrice: 4299,
    stock: 40,
    sizes: ['36', '37', '38', '39', '40'],
    colors: [{ name: 'Metallic Gold', hex: '#D4AF37' }, { name: 'Black Velvet', hex: '#111111' }],
    material: 'Nappa Leather & Satin',
    brand: 'Silk & Stone Atelier',
    ownerType: 'seller',
    sellerId: sellerUser._id,
    status: 'approved',
    isActive: true,
    badges: ['FEATURED'],
    images: [
      { url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80', alt: 'Pointed Strappy Heels', public_id: '' },
    ],
    tryOnImage: { url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80', public_id: '' },
    description: 'Sculpted 85mm stiletto heel featuring delicate wrap-around ankle ties and padded insole cushioning.',
    shortDescription: 'Striking pointed toe silhouette with delicate ankle wrap ribbons.',
    tags: ['heels', 'shoes', 'footwear', 'strappy'],
  },
  {
    name: 'Celeste Crystal Embellished Mules',
    slug: 'celeste-crystal-embellished-mules',
    category: catMap['footwear'],
    subcategory: 'Mules',
    price: 3699,
    stock: 25,
    sizes: ['36', '37', '38', '39', '40'],
    colors: [{ name: 'Silver Sheen', hex: '#C0C0C0' }],
    material: 'Satin & Swarovski Crystals',
    brand: 'SVARA',
    ownerType: 'admin',
    sellerId: null,
    status: 'approved',
    isActive: true,
    badges: ['TRENDING', 'NEW'],
    images: [
      { url: 'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=800&q=80', alt: 'Crystal Mules', public_id: '' },
    ],
    tryOnImage: { url: 'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=800&q=80', public_id: '' },
    description: 'Slip-on satin mules adorned with hand-set crystal floral brooches on the vamp.',
    shortDescription: 'Couture slip-on mules featuring dazzling crystal embellishments.',
    tags: ['mules', 'crystals', 'footwear', 'luxury'],
  },

  // --- ACCESSORIES (STAGE 4) ---
  {
    name: 'Chandrika Royal Kundan Drop Earrings',
    slug: 'chandrika-royal-kundan-drop-earrings',
    category: catMap['accessories'],
    subcategory: 'Earrings',
    price: 1899,
    compareAtPrice: 2699,
    stock: 50,
    sizes: ['One Size'],
    colors: [{ name: 'Gold & Pearl', hex: '#EEDC82' }],
    material: '22K Gold Plated Brass & Freshwater Pearls',
    brand: 'Silk & Stone Atelier',
    ownerType: 'seller',
    sellerId: sellerUser._id,
    status: 'approved',
    isActive: true,
    badges: ['FEATURED', 'TRENDING'],
    images: [
      { url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80', alt: 'Kundan Drop Earrings', public_id: '' },
    ],
    tryOnImage: { url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80', public_id: '' },
    description: 'Traditional royal Kundan chandelier earrings with cascading natural seed pearls.',
    shortDescription: 'Intricate 22k gold plated Kundan earrings for festive glamour.',
    tags: ['accessories', 'earrings', 'jewelry', 'kundan'],
  },
  {
    name: 'Solis Geometric Pearl Choker',
    slug: 'solis-geometric-pearl-choker',
    category: catMap['accessories'],
    subcategory: 'Necklaces',
    price: 2499,
    stock: 35,
    sizes: ['One Size'],
    colors: [{ name: 'Ivory Gold', hex: '#FAF0E6' }],
    material: 'Baroque Pearls & 18K Gold Vermeil',
    brand: 'SVARA',
    ownerType: 'admin',
    sellerId: null,
    status: 'approved',
    isActive: true,
    badges: ['NEW'],
    images: [
      { url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80', alt: 'Pearl Choker', public_id: '' },
    ],
    tryOnImage: { url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80', public_id: '' },
    description: 'Contemporary asymmetric choker combining genuine baroque pearls and brushed gold sculptural links.',
    shortDescription: 'Sculptural modern choker handcrafted with organic baroque pearls.',
    tags: ['accessories', 'choker', 'pearls', 'necklace'],
  },
];

for (const prod of sampleMarketplaceProducts) {
  await Product.findOneAndUpdate(
    { slug: prod.slug },
    { $set: prod },
    { upsert: true, new: true }
  );
}
console.log(`✅ Seeded ${sampleMarketplaceProducts.length} curated marketplace products (Handbags, Footwear, Accessories, Seller Products)`);

const totalProductsCount = await Product.countDocuments();
const totalSellersCount = await Seller.countDocuments();
const totalCategoriesCount = await Category.countDocuments();

console.log('\n=========================================');
console.log('🎉 MONGODB MARKETPLACE SYNC COMPLETED!');
console.log(`📦 Total Products in DB : ${totalProductsCount}`);
console.log(`🏪 Total Sellers in DB  : ${totalSellersCount}`);
console.log(`📂 Total Categories     : ${totalCategoriesCount}`);
console.log('=========================================\n');

await mongoose.disconnect();
process.exit(0);

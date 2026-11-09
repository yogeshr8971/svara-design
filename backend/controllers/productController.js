import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { generateSlug } from '../utils/generateSlug.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinaryService.js';
import { createNotification, notifyAdmins } from '../services/notificationService.js';
import { getRecommendations } from '../services/recommendationService.js';
import { validateProductData, validateImageCount, validateImageUrl, MAX_IMAGES } from '../utils/productValidation.js';
import { validateFileType } from '../utils/validateFileType.js';
import { buildCatalogFilter, getSortOption, getPaging } from '../utils/productQuery.js';

export const getProducts = asyncHandler(async (req, res) => {
  const { page, limit, category, sort, seller, status } = req.query;

  // Price, size, colour, brand, stock, search... are shared with Curate Look (utils/productQuery.js).
  const filter = buildCatalogFilter(req.query);

  // Security (Rule 30): public visitors and customers must ONLY receive approved & active products.
  // Never allow public ?status=pending or ?status=draft to leak unpublished products.
  const isAdmin = req.user?.role === 'admin';
  const isSeller = req.user?.role === 'seller';

  if (isAdmin) {
    if (status && status !== 'all') filter.status = status;
  } else if (isSeller && seller && seller === req.user._id.toString()) {
    if (status) filter.status = status;
    filter.sellerId = req.user._id;
  } else {
    filter.status = 'approved';
    filter.isActive = true;
  }

  if (category) {
    // Support category slug or ObjectId
    const cat = category.match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findById(category)
      : await Category.findOne({ slug: category.toLowerCase().trim() });
    filter.category = cat ? cat._id : null;
  }

  if (seller && (isAdmin || (isSeller && seller === req.user._id.toString()))) {
    filter.sellerId = seller;
  }

  const { safePage, safeLimit, skip } = getPaging(page, limit, 12);
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug curateLook')
      .populate('sellerId', 'name businessName')
      .sort(getSortOption(sort))
      .skip(skip)
      .limit(safeLimit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    products,
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit),
  });
});

export const getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findOne(
    id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { slug: id }
  )
    .populate('category', 'name slug')
    .populate('sellerId', 'name businessName sellerDescription');

  if (!product) throw new ApiError(404, 'Product not found.');

  // Security check (Rule 30): only admin or the owning seller can view unpublished product
  const canViewUnpublished =
    req.user?.role === 'admin' ||
    (req.user?.role === 'seller' &&
      product.sellerId?._id?.toString() === req.user._id?.toString());

  if ((product.status !== 'approved' || product.isActive === false) && !canViewUnpublished) {
    throw new ApiError(404, 'Product not found or currently unavailable.');
  }

  const recommendations = await getRecommendations(product._id, product.category?._id);
  res.json({ success: true, product, recommendations });
});

export const createProduct = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  // Parse JSON fields if strings
  if (data.colors && typeof data.colors === 'string') {
    try { data.colors = JSON.parse(data.colors); } catch { data.colors = []; }
  }
  if (data.sizes && typeof data.sizes === 'string') {
    try { data.sizes = JSON.parse(data.sizes); } catch { data.sizes = data.sizes.split(',').map(s => s.trim()); }
  }
  if (data.variants && typeof data.variants === 'string') {
    try { data.variants = JSON.parse(data.variants); } catch { data.variants = []; }
  }
  if (data.badges && typeof data.badges === 'string') {
    try { data.badges = JSON.parse(data.badges); } catch { data.badges = data.badges.split(',').map(b => b.trim().toUpperCase()); }
  }

  // If variants provided, recalculate total stock
  if (data.variants && Array.isArray(data.variants)) {
    data.stock = data.variants.reduce((total, v) => total + (Number(v.stock) || 0), 0);
  } else if (data.stock !== undefined && data.stock !== null) {
    data.stock = Math.max(0, Number(data.stock) || 0);
  }

  if (data.category) {
    const resolvedCat = data.category.toString().match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findById(data.category)
      : await Category.findOne({ slug: data.category.toLowerCase().trim() });
    if (resolvedCat) {
      data.category = resolvedCat._id;
    }
  }
  if (data.careInstructions && typeof data.careInstructions === 'string') {
    try { data.careInstructions = JSON.parse(data.careInstructions); } catch { data.careInstructions = []; }
  }

  // Category validation & resolution
  if (!data.category) {
    throw new ApiError(400, 'Product category is required.', 'CATEGORY_REQUIRED');
  }
  const resolvedCategory = data.category.toString().match(/^[0-9a-fA-F]{24}$/)
    ? await Category.findById(data.category)
    : await Category.findOne({ slug: data.category.toLowerCase().trim() });
  if (!resolvedCategory) {
    throw new ApiError(400, 'Invalid category selected.', 'INVALID_CATEGORY');
  }
  data.category = resolvedCategory._id;

  const catSlug = (resolvedCategory.slug || '').toLowerCase();
  const isSizeCategory = catSlug === 'dress' || catSlug === 'footwear';

  // For Dress and Footwear: require size variants
  if (isSizeCategory && (!data.sizes || data.sizes.length === 0) && (!data.variants || data.variants.length === 0)) {
    throw new ApiError(400, `${resolvedCategory.name} requires size options with separate stock per size.`, 'SIZES_REQUIRED');
  }

  // Generate variants from sizes if variants not explicitly provided
  if ((!data.variants || data.variants.length === 0) && Array.isArray(data.sizes) && data.sizes.length > 0) {
    const totalStock = Number(data.stock) || 0;
    const perVariantStock = Math.max(0, Math.floor(totalStock / data.sizes.length));
    data.variants = data.sizes.map((sz, idx) => ({
      sku: `SVR-${sz}-${idx + 1}-${Date.now().toString(36).slice(-4)}`.toUpperCase(),
      size: sz,
      color: data.colors?.[0]?.name || 'Standard',
      price: Number(data.price),
      stock: perVariantStock,
      isActive: true,
    }));
  }

  // If variants are provided, calculate total stock from sum of variants
  if (data.variants && data.variants.length > 0) {
    data.stock = data.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }

  // Validate basic product data (including required initial stock)
  const validationErrors = validateProductData(data);
  if (validationErrors.length > 0) {
    throw new ApiError(400, validationErrors.join(' '));
  }

  // Set ownership from authenticated user (NEVER trust frontend body for ownership)
  if (req.user.role === 'seller') {
    data.ownerType = 'seller';
    data.sellerId = req.user._id;
    data.status = 'pending'; // Seller products require admin approval
  } else if (req.user.role === 'admin') {
    data.ownerType = 'admin';
    data.sellerId = null;
    data.status = 'approved'; // Admin products are auto-approved
  }

  data.slug = generateSlug(data.name);

  // Collect all images (uploaded files + URL inputs)
  const images = [];

  // 1. Process uploaded files
  if (req.files?.images) {
    for (const file of req.files.images) {
      const mime = validateFileType(file.buffer);
      if (!mime) {
        throw new ApiError(400, 'Invalid image format detected. Only genuine JPEG, PNG, or WEBP image files are allowed.', 'INVALID_FILE_TYPE');
      }
      const result = await uploadToCloudinary(file.buffer, 'products', 'prod');
      images.push({ url: result.secure_url, public_id: result.public_id, alt: data.name });
    }
  }

  // 2. Process image URLs
  let imageUrls = [];
  if (data.imageUrls) {
    if (typeof data.imageUrls === 'string') {
      try { imageUrls = JSON.parse(data.imageUrls); } catch { imageUrls = data.imageUrls.split(',').map(u => u.trim()); }
    } else if (Array.isArray(data.imageUrls)) {
      imageUrls = data.imageUrls;
    }
  } else if (data.imageUrl) {
    imageUrls = [data.imageUrl];
  }

  for (const url of imageUrls) {
    const trimmed = typeof url === 'string' ? url.trim() : '';
    if (trimmed) {
      if (!validateImageUrl(trimmed)) {
        throw new ApiError(400, `Invalid image URL: ${trimmed}`);
      }
      images.push({ url: trimmed, alt: data.name, public_id: '' });
    }
  }

  // Enforce image limit (1-4 images)
  const imageCountError = validateImageCount(images.length);
  if (imageCountError) {
    throw new ApiError(400, imageCountError);
  }

  if (images.length > 0) {
    data.images = images;
  }

  // Handle try-on image
  if (req.files?.tryOnImage?.[0]) {
    const result = await uploadToCloudinary(req.files.tryOnImage[0].buffer, 'garments', 'garm');
    data.tryOnImage = { url: result.secure_url, public_id: result.public_id };
  } else if (data.tryOnImageUrl) {
    if (!validateImageUrl(data.tryOnImageUrl)) {
      throw new ApiError(400, `Invalid try-on image URL: ${data.tryOnImageUrl}`);
    }
    data.tryOnImage = { url: data.tryOnImageUrl, public_id: '' };
  } else if (images.length) {
    data.tryOnImage = { url: images[0].url, public_id: images[0].public_id || '' };
  }

  const product = await Product.create(data);

  // Email + push: seller gets a submission receipt, admins get a review task.
  if (req.user.role === 'seller') {
    createNotification(req.user._id, 'product_submitted', 'Product submitted for review', `"${product.name}" was added and is awaiting admin approval.`, { referenceType: 'product', referenceId: product._id, link: '/seller/dashboard?tab=products' }).catch(() => {});
    notifyAdmins('product_submitted', 'New product awaiting approval', `${req.user.businessName || req.user.name} submitted "${product.name}" (₹${product.price}).`, { referenceType: 'product', referenceId: product._id, link: '/admin' }).catch(() => {});
  }
  res.status(201).json({ success: true, product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found.');

  // Security: Check seller ownership
  if (req.user.role === 'seller') {
    if (!product.sellerId || product.sellerId.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'Access denied. You can only modify your own products.');
    }
  }

  const data = { ...req.body };

  // Protected fields: seller cannot change ownership or approval status
  if (req.user.role === 'seller') {
    delete data.ownerType;
    delete data.sellerId;
    delete data.status; // Sellers cannot approve their own products
  }

  // Parse JSON fields
  if (data.colors && typeof data.colors === 'string') {
    try { data.colors = JSON.parse(data.colors); } catch { /* keep existing */ }
  }
  if (data.sizes && typeof data.sizes === 'string') {
    try { data.sizes = JSON.parse(data.sizes); } catch { data.sizes = data.sizes.split(',').map(s => s.trim()); }
  }
  if (data.variants && typeof data.variants === 'string') {
    try { data.variants = JSON.parse(data.variants); } catch { /* keep existing */ }
  }
  if (data.badges && typeof data.badges === 'string') {
    try { data.badges = JSON.parse(data.badges); } catch { data.badges = data.badges.split(',').map(b => b.trim().toUpperCase()); }
  }

  // If variants provided, recalculate total stock
  if (data.variants && Array.isArray(data.variants)) {
    data.stock = data.variants.reduce((total, v) => total + (Number(v.stock) || 0), 0);
  } else if (data.stock !== undefined && data.stock !== null) {
    data.stock = Math.max(0, Number(data.stock) || 0);
  }

  if (data.category) {
    const resolvedCat = data.category.toString().match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findById(data.category)
      : await Category.findOne({ slug: data.category.toLowerCase().trim() });
    if (resolvedCat) {
      data.category = resolvedCat._id;
    }
  }


  // Start with existing images (minus any requested deletions)
  let currentImages = [...(product.images || [])];

  // Handle deleted images
  if (data.deleteImageIds) {
    let toDelete = [];
    if (typeof data.deleteImageIds === 'string') {
      try { toDelete = JSON.parse(data.deleteImageIds); } catch { toDelete = data.deleteImageIds.split(',').map(id => id.trim()); }
    } else if (Array.isArray(data.deleteImageIds)) {
      toDelete = data.deleteImageIds;
    }

    for (const pubId of toDelete) {
      if (pubId) {
        await deleteFromCloudinary(pubId);
        currentImages = currentImages.filter(img => img.public_id !== pubId);
      }
    }
  }

  // If client sent an explicit existing images list, use that
  if (data.existingImages) {
    try {
      const parsedExisting = typeof data.existingImages === 'string' ? JSON.parse(data.existingImages) : data.existingImages;
      if (Array.isArray(parsedExisting)) {
        currentImages = parsedExisting;
      }
    } catch { /* use currentImages */ }
  }

  // Upload new image files
  if (req.files?.images) {
    for (const file of req.files.images) {
      const mime = validateFileType(file.buffer);
      if (!mime) {
        throw new ApiError(400, 'Invalid image format detected. Only genuine JPEG, PNG, or WEBP image files are allowed.', 'INVALID_FILE_TYPE');
      }
      const result = await uploadToCloudinary(file.buffer, 'products', 'prod');
      currentImages.push({ url: result.secure_url, public_id: result.public_id, alt: data.name || product.name });
    }
  }

  // Add new image URLs
  if (data.newImageUrls) {
    let newUrls = [];
    if (typeof data.newImageUrls === 'string') {
      try { newUrls = JSON.parse(data.newImageUrls); } catch { newUrls = data.newImageUrls.split(',').map(u => u.trim()); }
    } else if (Array.isArray(data.newImageUrls)) {
      newUrls = data.newImageUrls;
    }
    for (const url of newUrls) {
      const trimmed = typeof url === 'string' ? url.trim() : '';
      if (trimmed) {
        if (!validateImageUrl(trimmed)) {
          throw new ApiError(400, `Invalid image URL: ${trimmed}`);
        }
        currentImages.push({ url: trimmed, alt: data.name || product.name, public_id: '' });
      }
    }
  }

  // Enforce max 4 images
  if (currentImages.length > MAX_IMAGES) {
    throw new ApiError(400, `Maximum ${MAX_IMAGES} product images are allowed. Got ${currentImages.length}.`);
  }

  data.images = currentImages;

  // Handle tryOnImage
  if (req.files?.tryOnImage?.[0]) {
    if (product.tryOnImage?.public_id) await deleteFromCloudinary(product.tryOnImage.public_id);
    const result = await uploadToCloudinary(req.files.tryOnImage[0].buffer, 'garments', 'garm');
    data.tryOnImage = { url: result.secure_url, public_id: result.public_id };
  } else if (data.tryOnImageUrl) {
    if (!validateImageUrl(data.tryOnImageUrl)) {
      throw new ApiError(400, `Invalid try-on image URL: ${data.tryOnImageUrl}`);
    }
    data.tryOnImage = { url: data.tryOnImageUrl, public_id: '' };
  }

  const updated = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
    .populate('category', 'name slug')
    .populate('sellerId', 'name businessName');

  res.json({ success: true, product: updated });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found.');

  // Security: Check seller ownership
  if (req.user.role === 'seller') {
    if (!product.sellerId || product.sellerId.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'Access denied. You can only delete your own products.');
    }
  }

  // Clean up Cloudinary assets
  for (const img of product.images) {
    if (img.public_id) await deleteFromCloudinary(img.public_id);
  }
  if (product.tryOnImage?.public_id) await deleteFromCloudinary(product.tryOnImage.public_id);

  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted.' });
});

export const searchProducts = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ success: true, products: [] });

  const products = await Product.find({
    status: 'approved',
    isActive: { $ne: false },
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } },
      { brand: { $regex: q, $options: 'i' } },
    ],
  })
    .populate('category', 'name slug')
    .limit(10)
    .select('name slug price images category badges');

  res.json({ success: true, products });
});

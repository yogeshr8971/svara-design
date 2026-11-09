import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import slugify from 'slugify';
import { buildCatalogFilter, getSortOption, getPaging } from '../utils/productQuery.js';

const DEFAULT_RULES = { requiresColor: false, requiresSize: false };

/** The shape the storefront receives for one Curate Look stage. */
const toStage = (cat) => ({
  _id: cat._id,
  name: cat.name,
  displayName: cat.curateLook?.displayName || cat.name,
  slug: cat.slug,
  description: cat.description || '',
  rules: cat.curateLook?.rules || DEFAULT_RULES,
  image: cat.image || { url: '', public_id: '' },
  sortOrder: cat.displayOrder || cat.order || 0,
  isActive: cat.isActive,
});

/** A stage is simply a Category that is active and switched on for Curate Look. */
const findActiveStage = (slug) =>
  Category.findOne({
    slug: String(slug || '').toLowerCase().trim(),
    isActive: { $ne: false },
    'curateLook.enabled': { $ne: false },
  });

// GET /api/curate-categories (Public)
// The ordered list of Curate Look stages.
export const getCurateCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: { $ne: false }, 'curateLook.enabled': { $ne: false } })
    .sort({ displayOrder: 1, order: 1, name: 1 });

  const stages = categories.map(toStage);
  res.json({ success: true, categories: stages, curateCategories: stages });
});

// GET /api/curate-categories/:slug/products (Public)
// Products for one stage. This is the same list Shop All shows for that category
// (same visibility rules, filters, sorting and paging - see utils/productQuery.js).
export const getCurateCategoryProducts = asyncHandler(async (req, res) => {
  const stage = await findActiveStage(req.params.slug);
  if (!stage) {
    throw new ApiError(404, `Curate stage "${req.params.slug}" not found.`, 'CATEGORY_NOT_FOUND');
  }

  const filter = {
    ...buildCatalogFilter(req.query),
    status: 'approved', // only approved & active products are ever public
    isActive: true,
    category: stage._id, // the one rule that makes this a stage
  };

  const { safePage, safeLimit, skip } = getPaging(req.query.page, req.query.limit, 36);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug curateLook')
      .populate('sellerId', 'name businessName')
      .sort(getSortOption(req.query.sort))
      .skip(skip)
      .limit(safeLimit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    stage: toStage(stage),
    products,
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit),
  });
});

// GET /api/curate-categories/:slug
export const getCurateCategory = asyncHandler(async (req, res) => {
  const cat = await findActiveStage(req.params.slug);
  if (!cat) {
    throw new ApiError(404, 'Curate category not found.', 'CATEGORY_NOT_FOUND');
  }
  res.json({ success: true, category: toStage(cat) });
});

// POST /api/curate-categories (Admin only)
export const createCurateCategory = asyncHandler(async (req, res) => {
  const { name, displayName, description, sortOrder, rules } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Category name is required.', 'VALIDATION_ERROR');
  }

  const slug = slugify(name, { lower: true, strict: true });
  let cat = await Category.findOne({ slug });

  if (cat) {
    cat.curateLook = {
      enabled: true,
      displayName: displayName?.trim() || name.trim(),
      rules: rules || DEFAULT_RULES,
    };
    cat.isActive = true;
    cat.active = true;
    if (sortOrder !== undefined) cat.displayOrder = Number(sortOrder);
    await cat.save();
    return res.status(200).json({ success: true, category: cat, message: 'Curate stage updated.' });
  }

  cat = await Category.create({
    name: name.trim(),
    slug,
    description: description || '',
    displayOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
    order: sortOrder !== undefined ? Number(sortOrder) : 0,
    isActive: true,
    active: true,
    curateLook: {
      enabled: true,
      displayName: displayName?.trim() || name.trim(),
      rules: rules || DEFAULT_RULES,
    },
  });

  res.status(201).json({ success: true, category: cat, message: 'Curate stage created.' });
});

// PUT /api/curate-categories/:id (Admin only)
export const updateCurateCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found.', 'NOT_FOUND');

  const { name, displayName, description, sortOrder, isActive, rules } = req.body;

  if (name !== undefined) {
    cat.name = name.trim();
    cat.slug = slugify(name, { lower: true, strict: true });
  }
  if (description !== undefined) cat.description = description.trim();
  if (sortOrder !== undefined) {
    cat.displayOrder = Number(sortOrder);
    cat.order = Number(sortOrder);
  }
  if (isActive !== undefined) {
    cat.isActive = Boolean(isActive);
    cat.active = Boolean(isActive);
  }

  cat.curateLook = {
    ...cat.curateLook?.toObject?.() || {},
    enabled: isActive !== undefined ? Boolean(isActive) : cat.curateLook?.enabled,
    displayName: displayName !== undefined ? displayName.trim() : cat.curateLook?.displayName || cat.name,
    rules: rules !== undefined ? rules : cat.curateLook?.rules || DEFAULT_RULES,
  };

  await cat.save();

  res.json({ success: true, category: cat, message: 'Curate stage updated.' });
});

// DELETE /api/curate-categories/:id (Admin only)
export const deleteCurateCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found.', 'NOT_FOUND');

  const refCount = await Product.countDocuments({ category: cat._id });
  if (refCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete category "${cat.name}". It is currently referenced by ${refCount} product(s). Please reassign or delete the products first.`,
      'CATEGORY_IN_USE'
    );
  }

  cat.curateLook.enabled = false;
  await cat.save();

  res.json({ success: true, message: `Category "${cat.name}" removed from Curate Look stages.` });
});

// PUT /api/curate-categories/reorder (Admin only)
export const reorderCurateCategories = asyncHandler(async (req, res) => {
  const { orderList } = req.body; // Array of { id, sortOrder }
  if (!Array.isArray(orderList)) {
    throw new ApiError(400, 'orderList must be an array of { id, sortOrder } objects.', 'VALIDATION_ERROR');
  }

  const updates = orderList.map((item) =>
    Category.findByIdAndUpdate(item.id, { displayOrder: Number(item.sortOrder), order: Number(item.sortOrder) })
  );
  await Promise.all(updates);

  const categories = await Category.find({ isActive: { $ne: false } }).sort({ displayOrder: 1, order: 1 });
  res.json({ success: true, categories, message: 'Curate categories reordered successfully.' });
});

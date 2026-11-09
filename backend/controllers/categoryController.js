import Category from '../models/Category.js';
import Product from '../models/Product.js';
import CurateCategory from '../models/CurateCategory.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';
import { syncCategoryWithCurateStage } from '../services/categorySyncService.js';
import slugify from 'slugify';

export const getCategories = asyncHandler(async (req, res) => {
  const filter = {};
  if (!req.query.includeInactive || req.query.includeInactive !== 'true') {
    filter.isActive = { $ne: false };
  }
  const categories = await Category.find(filter).sort({ displayOrder: 1, order: 1, name: 1 });
  res.json({ success: true, categories });
});

export const getCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findOne({ slug: req.params.slug.toLowerCase().trim() });
  if (!cat) throw new ApiError(404, 'Category not found.');
  res.json({ success: true, category: cat });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, curateLook, displayOrder, order } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Category name is required.', 'VALIDATION_ERROR');
  }

  const slug = slugify(name, { lower: true, strict: true });
  const existing = await Category.findOne({ slug });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      existing.active = true;
      if (description) existing.description = description;
      await existing.save();
      await syncCategoryWithCurateStage(existing);
      return res.json({ success: true, category: existing, message: 'Category reactivated.' });
    }
    throw new ApiError(409, `Category with slug "${slug}" already exists.`, 'DUPLICATE_CATEGORY');
  }

  const highestCat = await Category.findOne().sort({ displayOrder: -1 });
  const nextOrder = (highestCat?.displayOrder || 0) + 1;

  const data = {
    name: name.trim(),
    slug,
    description: description || '',
    displayOrder: displayOrder !== undefined ? Number(displayOrder) : nextOrder,
    order: order !== undefined ? Number(order) : nextOrder,
    isActive: true,
    active: true,
  };

  if (curateLook) {
    data.curateLook = curateLook;
  }

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'categories', 'cat');
    data.image = { url: result.secure_url, public_id: result.public_id };
  } else if (req.body.imageUrl) {
    data.image = { url: req.body.imageUrl, public_id: '' };
  }

  const category = await Category.create(data);
  await syncCategoryWithCurateStage(category);

  res.status(201).json({ success: true, category, message: 'Category created successfully.' });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found.');

  const { name, description, curateLook, displayOrder, order, isActive } = req.body;

  if (name !== undefined) {
    category.name = name.trim();
    category.slug = slugify(name, { lower: true, strict: true });
  }
  if (description !== undefined) category.description = description;
  if (displayOrder !== undefined) category.displayOrder = Number(displayOrder);
  if (order !== undefined) category.order = Number(order);
  if (isActive !== undefined) {
    category.isActive = Boolean(isActive);
    category.active = Boolean(isActive);
  }
  if (curateLook !== undefined) {
    category.curateLook = {
      ...category.curateLook?.toObject?.() || {},
      ...curateLook,
    };
  }

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'categories', 'cat');
    category.image = { url: result.secure_url, public_id: result.public_id };
  } else if (req.body.imageUrl) {
    category.image = { url: req.body.imageUrl, public_id: '' };
  }

  await category.save();
  await syncCategoryWithCurateStage(category);

  res.json({ success: true, category, message: 'Category updated successfully.' });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found.');

  // Prevent unsafe deletion of referenced categories/stages
  const refCount = await Product.countDocuments({ category: category._id });
  if (refCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete category "${category.name}". It is currently referenced by ${refCount} product(s). Please reassign or delete the products first.`,
      'CATEGORY_IN_USE'
    );
  }

  // Also remove from CurateCategory
  await CurateCategory.deleteOne({ categoryId: category._id });
  await category.deleteOne();

  res.json({ success: true, message: `Category "${category.name}" deleted successfully.` });
});

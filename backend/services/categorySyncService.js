import Category from '../models/Category.js';
import CurateCategory from '../models/CurateCategory.js';

export const DEFAULT_CATEGORIES = [
  {
    name: 'Dress',
    slug: 'dress',
    description: 'Designer dresses and evening gowns',
    displayOrder: 1,
    curateLook: {
      enabled: true,
      displayName: 'Dress',
      rules: { requiresColor: true, requiresSize: true },
    },
  },
  {
    name: 'Handbag',
    slug: 'handbag',
    description: 'Luxury handbags, totes, and clutches',
    displayOrder: 2,
    curateLook: {
      enabled: true,
      displayName: 'Handbag',
      rules: { requiresColor: true, requiresSize: false },
    },
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    description: 'Heels, flats, and luxury footwear',
    displayOrder: 3,
    curateLook: {
      enabled: true,
      displayName: 'Footwear',
      rules: { requiresColor: false, requiresSize: true },
    },
  },
  {
    name: 'Earrings',
    slug: 'earrings',
    description: 'Statement earrings and fine jewelry',
    displayOrder: 4,
    curateLook: {
      enabled: true,
      displayName: 'Earrings',
      rules: { requiresColor: false, requiresSize: false },
    },
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Belts, scarves, and fashion accessories',
    displayOrder: 5,
    curateLook: {
      enabled: true,
      displayName: 'Accessories',
      rules: { requiresColor: false, requiresSize: false },
    },
  },
];

/**
 * Ensures the default categories exist and keeps Category and CurateCategory in sync.
 */
export const syncDefaultCategories = async () => {
  try {
    for (const def of DEFAULT_CATEGORIES) {
      let cat = await Category.findOne({ slug: def.slug });
      if (!cat) {
        cat = await Category.create({
          name: def.name,
          slug: def.slug,
          description: def.description,
          displayOrder: def.displayOrder,
          order: def.displayOrder,
          isActive: true,
          active: true,
          curateLook: def.curateLook,
        });
      } else {
        // Ensure curateLook rules and displayOrder match
        cat.curateLook = {
          ...def.curateLook,
          ...(cat.curateLook?.toObject ? cat.curateLook.toObject() : cat.curateLook),
          rules: def.curateLook.rules,
        };
        if (!cat.displayOrder) cat.displayOrder = def.displayOrder;
        cat.isActive = true;
        cat.active = true;
        await cat.save();
      }

      // Synchronize with CurateCategory collection
      await CurateCategory.findOneAndUpdate(
        { slug: def.slug },
        {
          name: def.name,
          slug: def.slug,
          categoryId: cat._id,
          displayName: def.curateLook.displayName,
          description: def.description,
          sortOrder: def.displayOrder,
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Clean up any obsolete legacy categories
    const legacySlugs = ['ethnic-wear', 'tops', 'jeans', 'skirts', 'jackets', 'coord-sets', 'dresses', 'handbags', 'hand-bag', 'foot-wear'];
    await Category.deleteMany({ slug: { $in: legacySlugs } });
    await CurateCategory.deleteMany({ slug: { $in: legacySlugs } });
  } catch (err) {
    console.error('⚠️ Category synchronization failed:', err.message);
  }
};

/**
 * Synchronizes an individual Category document with CurateCategory.
 */
export const syncCategoryWithCurateStage = async (category) => {
  if (!category) return;
  try {
    if (category.isActive === false) {
      await CurateCategory.findOneAndUpdate({ categoryId: category._id }, { isActive: false });
    } else {
      await CurateCategory.findOneAndUpdate(
        { categoryId: category._id },
        {
          name: category.name,
          slug: category.slug,
          categoryId: category._id,
          displayName: category.curateLook?.displayName || category.name,
          description: category.description || '',
          sortOrder: category.displayOrder || category.order || 0,
          image: category.image || { url: '', public_id: '' },
          isActive: category.isActive !== false,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Clean up any obsolete legacy categories
    const legacySlugs = ['ethnic-wear', 'tops', 'jeans', 'skirts', 'jackets', 'coord-sets', 'dresses', 'handbags', 'hand-bag', 'foot-wear'];
    await Category.deleteMany({ slug: { $in: legacySlugs } });
    await CurateCategory.deleteMany({ slug: { $in: legacySlugs } });
  } catch (err) {
    console.error(`⚠️ Failed to sync category ${category.name} to curate category:`, err.message);
  }
};

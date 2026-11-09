/**
 * Shared product-listing rules.
 *
 * Shop All (GET /api/products) and Curate Look (GET /api/curate-categories/:slug/products)
 * both build their MongoDB query from these helpers, so a filter, sort or search
 * behaves identically in both places. Change a rule here and both pages follow.
 */

export const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Sort options a shopper can pick (value comes from ?sort=). */
const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { 'ratings.count': -1, trending: -1 },
};

export const getSortOption = (sort) => SORT_OPTIONS[sort] || SORT_OPTIONS.newest;

/** Turns ?page and ?limit into safe numbers (limit is capped at 100). */
export const getPaging = (page, limit, defaultLimit = 12) => {
  const safeLimit = Math.min(Math.max(1, Number(limit) || defaultLimit), 100);
  const safePage = Math.max(1, Number(page) || 1);
  return { safePage, safeLimit, skip: (safePage - 1) * safeLimit };
};

/**
 * Builds the shopper-facing filters (price, size, colour, brand, stock, search...).
 * It does NOT decide who may see what (approved/active/seller) or which category -
 * the calling controller adds that.
 */
export const buildCatalogFilter = (query = {}) => {
  const {
    minPrice, maxPrice, size, color, featured, trending, search,
    brand, material, availability, stockStatus, badges,
  } = query;

  const filter = {};
  const and = [];

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  if (size) {
    and.push({ $or: [{ sizes: size }, { 'variants.size': size }] });
  }

  if (color) {
    const safeColor = escapeRegex(color);
    and.push({
      $or: [
        { 'colors.name': { $regex: safeColor, $options: 'i' } },
        { 'variants.color': { $regex: safeColor, $options: 'i' } },
      ],
    });
  }

  if (brand) filter.brand = { $regex: escapeRegex(brand), $options: 'i' };
  if (material) filter.material = { $regex: escapeRegex(material), $options: 'i' };

  // Stock: inStock (>= 5), lowStock (1-4), outOfStock (0)
  const stock = stockStatus || availability;
  if (stock === 'inStock') filter.stock = { $gte: 5 };
  else if (stock === 'lowStock') filter.stock = { $gt: 0, $lt: 5 };
  else if (stock === 'outOfStock') filter.stock = { $lte: 0 };

  if (badges) {
    const badgeList = Array.isArray(badges) ? badges : badges.split(',').map((b) => b.trim().toUpperCase());
    filter.badges = { $in: badgeList };
  }

  if (featured === 'true') and.push({ $or: [{ featured: true }, { badges: 'FEATURED' }] });
  if (trending === 'true') and.push({ $or: [{ trending: true }, { badges: 'TRENDING' }] });

  if (search) {
    const term = escapeRegex(search.trim());
    if (term) {
      and.push({
        $or: [
          { name: { $regex: term, $options: 'i' } },
          { description: { $regex: term, $options: 'i' } },
          { tags: { $regex: term, $options: 'i' } },
          { brand: { $regex: term, $options: 'i' } },
          { material: { $regex: term, $options: 'i' } },
        ],
      });
    }
  }

  if (and.length > 0) filter.$and = and;
  return filter;
};

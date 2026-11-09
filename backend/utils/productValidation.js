import { ApiError } from './apiError.js';

const ALLOWED_BADGES = ['SALE', 'TRENDING', 'NEW', 'FEATURED'];
const MAX_IMAGES = 4;

// Validates product data common to both manual and Excel import
export function validateProductData(data) {
  const errors = [];
  
  if (!data.name || !data.name.trim()) {
    errors.push('Product name is required.');
  }
  
  const price = Number(data.price);
  if (isNaN(price) || price < 0) {
    errors.push('Valid price is required.');
  }
  
  if (data.stock === undefined || data.stock === null || data.stock === '') {
    const hasVariantStock = Array.isArray(data.variants) && data.variants.length > 0 && data.variants.some(v => v.stock !== undefined && !isNaN(Number(v.stock)));
    if (!hasVariantStock) {
      errors.push('Initial stock is required.');
    }
  } else {
    const stock = Number(data.stock);
    if (isNaN(stock) || stock < 0) {
      errors.push('Stock must be a non-negative number.');
    }
  }
  
  if (data.badges && Array.isArray(data.badges)) {
    const invalidBadges = data.badges.filter(b => !ALLOWED_BADGES.includes(b));
    if (invalidBadges.length > 0) {
      errors.push(`Invalid badges: ${invalidBadges.join(', ')}. Allowed: ${ALLOWED_BADGES.join(', ')}`);
    }
  }

  if (data.compareAtPrice !== undefined && data.compareAtPrice !== null && data.compareAtPrice !== '') {
    const compareAt = Number(data.compareAtPrice);
    if (isNaN(compareAt) || compareAt < 0) {
      errors.push('Original price (compareAtPrice) must be a non-negative number.');
    }
  }
  
  return errors;
}

/**
 * Calculates genuine discount percentage (§8).
 * Discount % = ((Original Price - Selling Price) / Original Price) * 100
 * Returns 0 if there is no genuine discount.
 */
export function calculateDiscount(originalPrice, sellingPrice) {
  const orig = Number(originalPrice);
  const sell = Number(sellingPrice);
  if (!orig || !sell || isNaN(orig) || isNaN(sell) || orig <= sell) {
    return 0;
  }
  return Math.round(((orig - sell) / orig) * 100);
}

// Validates image count
export function validateImageCount(imageCount) {
  if (imageCount > MAX_IMAGES) {
    return `Maximum ${MAX_IMAGES} product images are allowed. Got ${imageCount}.`;
  }
  return null;
}

// Validates an image URL format
export function validateImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export { ALLOWED_BADGES, MAX_IMAGES };

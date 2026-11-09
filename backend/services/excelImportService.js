import * as XLSX from 'xlsx';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { generateSlug } from '../utils/generateSlug.js';
import { uploadToCloudinary } from './cloudinaryService.js';
import { validateProductData, validateImageUrl, ALLOWED_BADGES, MAX_IMAGES } from '../utils/productValidation.js';

/**
 * Generate a downloadable Excel template workbook.
 */
export function generateExcelTemplate() {
  const headers = [
    'Product Name',
    'Description',
    'Price',
    'Category',
    'Stock',
    'Sizes',
    'Colors',
    'Material',
    'Brand',
    'Badges',
    'Image 1',
    'Image 2',
    'Image 3',
    'Image 4',
    'TryOn Image',
    'isActive',
  ];

  const exampleRow = [
    'Ivory Silk Evening Gown',
    'Handcrafted mulberry silk gown with delicate embroidery',
    2499,
    'Dress',
    15,
    'XS, S, M, L, XL',
    'Ivory, Gold',
    'Mulberry Silk',
    'SVARA Atelier',
    'SALE, TRENDING',
    'gown_front.jpg',
    'gown_back.jpg',
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800',
    '',
    'gown_tryon.jpg',
    'TRUE',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  
  // Set column widths for comfortable editing
  ws['!cols'] = [
    { wch: 28 }, // Product Name
    { wch: 45 }, // Description
    { wch: 10 }, // Price
    { wch: 15 }, // Category
    { wch: 10 }, // Stock
    { wch: 18 }, // Sizes
    { wch: 16 }, // Colors
    { wch: 16 }, // Material
    { wch: 16 }, // Brand
    { wch: 18 }, // Badges
    { wch: 20 }, // Image 1
    { wch: 20 }, // Image 2
    { wch: 20 }, // Image 3
    { wch: 20 }, // Image 4
    { wch: 20 }, // TryOn Image
    { wch: 10 }, // isActive
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products Template');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Parse and validate uploaded Excel file rows without saving to DB.
 * Supports image filenames matched against uploaded image files OR direct image URLs.
 */
export async function parseAndValidateExcel(fileBuffer, uploadedFiles = []) {
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('The uploaded Excel file contains no sheets.');
  }

  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The uploaded Excel file is empty.');
  }

  // Pre-fetch all categories to validate and map IDs
  const allCategories = await Category.find({ active: true });
  const categoryMap = new Map();
  allCategories.forEach(c => {
    categoryMap.set(c.name.toLowerCase().trim(), c);
    categoryMap.set(c.slug.toLowerCase().trim(), c);
  });

  // Map of uploaded file names (lowercase) to their buffer
  const fileMap = new Map();
  uploadedFiles.forEach(f => {
    fileMap.set(f.originalname.toLowerCase().trim(), f);
  });

  const previewRows = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rowNumber = idx + 2; // Row 1 is header
    const errors = [];

    // 1. Extract values
    const name = String(row['Product Name'] || row['name'] || '').trim();
    const description = String(row['Description'] || row['description'] || '').trim();
    const rawPrice = row['Price'] || row['price'];
    const price = Number(rawPrice);
    const categoryInput = String(row['Category'] || row['category'] || '').trim();
    const rawStock = row['Stock'] || row['stock'];
    const stock = rawStock !== '' ? Number(rawStock) : 0;
    const rawSizes = String(row['Sizes'] || row['sizes'] || '').trim();
    const rawColors = String(row['Colors'] || row['colors'] || '').trim();
    const material = String(row['Material'] || row['material'] || '').trim();
    const brand = String(row['Brand'] || row['brand'] || 'SVARA').trim();
    const rawBadges = String(row['Badges'] || row['badges'] || '').trim();
    const isActiveVal = String(row['isActive'] || row['active'] || 'TRUE').toUpperCase();
    const isActive = isActiveVal === 'TRUE' || isActiveVal === '1' || isActiveVal === 'YES';

    // 2. Validate product name
    if (!name) {
      errors.push('Missing product name.');
    }

    // 3. Validate price
    if (isNaN(price) || price < 0 || rawPrice === '') {
      errors.push('Invalid price.');
    }

    // 4. Validate stock
    if (isNaN(stock) || stock < 0) {
      errors.push('Invalid stock count.');
    }

    // 5. Validate category
    let matchedCategory = null;
    if (categoryInput) {
      matchedCategory = categoryMap.get(categoryInput.toLowerCase());
      if (!matchedCategory) {
        errors.push(`Category "${categoryInput}" not found.`);
      }
    } else {
      errors.push('Category is required.');
    }

    // 6. Validate Badges
    const badges = [];
    if (rawBadges) {
      const parts = rawBadges.split(',').map(b => b.trim().toUpperCase()).filter(Boolean);
      for (const badge of parts) {
        if (ALLOWED_BADGES.includes(badge)) {
          badges.push(badge);
        } else {
          errors.push(`Invalid badge "${badge}". Allowed: ${ALLOWED_BADGES.join(', ')}`);
        }
      }
    }

    // 7. Parse sizes & colors
    const sizes = rawSizes ? rawSizes.split(',').map(s => s.trim()).filter(Boolean) : [];
    const colors = rawColors ? rawColors.split(',').map(c => ({ name: c.trim() })).filter(Boolean) : [];

    // 8. Collect & validate up to 4 images
    const rawImageInputs = [
      row['Image 1'] || row['image1'] || row['image 1'],
      row['Image 2'] || row['image2'] || row['image 2'],
      row['Image 3'] || row['image3'] || row['image 3'],
      row['Image 4'] || row['image4'] || row['image 4'],
    ].map(img => String(img || '').trim()).filter(Boolean);

    if (rawImageInputs.length > MAX_IMAGES) {
      errors.push(`More than ${MAX_IMAGES} images provided.`);
    }

    const resolvedImages = [];
    for (const input of rawImageInputs) {
      if (validateImageUrl(input)) {
        resolvedImages.push({ type: 'url', value: input });
      } else {
        // Must match an uploaded image file
        const matchedFile = fileMap.get(input.toLowerCase());
        if (matchedFile) {
          resolvedImages.push({ type: 'file', value: input, file: matchedFile });
        } else {
          errors.push(`Image file "${input}" was not found in uploaded image files.`);
        }
      }
    }

    // 9. TryOn Image
    const tryOnInput = String(row['TryOn Image'] || row['tryon_image'] || row['tryOnImage'] || '').trim();
    let resolvedTryOn = null;
    if (tryOnInput) {
      if (validateImageUrl(tryOnInput)) {
        resolvedTryOn = { type: 'url', value: tryOnInput };
      } else {
        const matchedFile = fileMap.get(tryOnInput.toLowerCase());
        if (matchedFile) {
          resolvedTryOn = { type: 'file', value: tryOnInput, file: matchedFile };
        } else {
          errors.push(`Try-on image file "${tryOnInput}" was not found in uploaded image files.`);
        }
      }
    }

    const isValid = errors.length === 0;

    previewRows.push({
      rowNumber,
      isValid,
      errors,
      data: {
        name,
        description,
        price,
        categoryId: matchedCategory?._id,
        categoryName: matchedCategory?.name || categoryInput,
        stock,
        sizes,
        colors,
        material,
        brand,
        badges,
        isActive,
        images: resolvedImages,
        tryOnImage: resolvedTryOn,
      },
    });
  }

  const validCount = previewRows.filter(r => r.isValid).length;
  const invalidCount = previewRows.length - validCount;

  return {
    totalRows: previewRows.length,
    validCount,
    invalidCount,
    preview: previewRows,
  };
}

/**
 * Execute bulk import for validated rows.
 * Uploads images to Cloudinary and creates Product records.
 */
export async function executeBulkImport(validatedPreviewRows, adminUserId) {
  const results = {
    totalRows: validatedPreviewRows.length,
    successful: 0,
    failed: 0,
    createdProducts: [],
    errors: [],
  };

  for (const item of validatedPreviewRows) {
    if (!item.isValid) {
      results.failed++;
      results.errors.push({
        rowNumber: item.rowNumber,
        productName: item.data?.name || 'Unknown',
        reasons: item.errors,
      });
      continue;
    }

    try {
      const { data } = item;
      const images = [];

      // Upload/process images
      for (const img of data.images) {
        if (img.type === 'file' && img.file) {
          const uploadRes = await uploadToCloudinary(img.file.buffer, 'products', 'bulk_prod');
          images.push({
            url: uploadRes.secure_url,
            public_id: uploadRes.public_id,
            alt: data.name,
          });
        } else if (img.type === 'url') {
          images.push({
            url: img.value,
            public_id: '',
            alt: data.name,
          });
        }
      }

      // Upload/process tryOnImage
      let tryOnImage = null;
      if (data.tryOnImage) {
        if (data.tryOnImage.type === 'file' && data.tryOnImage.file) {
          const uploadRes = await uploadToCloudinary(data.tryOnImage.file.buffer, 'garments', 'bulk_garm');
          tryOnImage = { url: uploadRes.secure_url, public_id: uploadRes.public_id };
        } else if (data.tryOnImage.type === 'url') {
          tryOnImage = { url: data.tryOnImage.value, public_id: '' };
        }
      } else if (images.length > 0) {
        tryOnImage = { url: images[0].url, public_id: images[0].public_id || '' };
      }

      // Create Product using the shared Product model
      const newProduct = await Product.create({
        name: data.name,
        slug: generateSlug(data.name),
        description: data.description,
        price: data.price,
        category: data.categoryId,
        stock: data.stock,
        sizes: data.sizes,
        colors: data.colors,
        material: data.material,
        brand: data.brand || 'SVARA',
        badges: data.badges || [],
        isActive: data.isActive,
        status: 'approved', // Admin bulk import products are approved
        ownerType: 'admin',
        sellerId: null,
        images,
        tryOnImage,
      });

      results.successful++;
      results.createdProducts.push({
        _id: newProduct._id,
        name: newProduct.name,
        slug: newProduct.slug,
        price: newProduct.price,
      });
    } catch (err) {
      results.failed++;
      results.errors.push({
        rowNumber: item.rowNumber,
        productName: item.data?.name || 'Unknown',
        reasons: [err.message || 'Database insert failed.'],
      });
    }
  }

  return results;
}

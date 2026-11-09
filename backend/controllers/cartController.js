import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import PlatformSettings from '../models/PlatformSettings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

export const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id }).populate(
    'items.productId',
    'name images price stock shippingFee isActive status'
  );

  const items = cart?.items || [];
  const settings = await PlatformSettings.getSettings();
  const freeThreshold = settings.freeShippingThreshold ?? 2000;

  const subtotal = items.reduce((sum, item) => {
    const currentPrice = item.productId?.price ?? item.price;
    return sum + currentPrice * item.quantity;
  }, 0);

  const itemShippingSum = items.reduce((sum, item) => {
    const fee = item.productId?.shippingFee ?? 0;
    return sum + fee * item.quantity;
  }, 0);

  const shippingAmount = subtotal >= freeThreshold || items.length === 0 ? 0 : itemShippingSum;
  const totalAmount = subtotal + shippingAmount;

  res.json({
    success: true,
    cart: cart || { userId: req.user._id, items: [] },
    pricing: {
      subtotal,
      shippingAmount,
      totalAmount,
      freeShippingThreshold: freeThreshold,
    },
  });
});

export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, size, color } = req.body;
  if (!productId) throw new ApiError(400, 'Product ID is required.');
  const requestedQuantity = Number(quantity);
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > 20) {
    throw new ApiError(400, 'Quantity must be a whole number between 1 and 20.', 'INVALID_QUANTITY');
  }

  const product = await Product.findOne({ _id: productId, status: 'approved', isActive: true });
  if (!product) throw new ApiError(404, 'Product is not available.');
  const selectedVariant = product.variants?.length
    ? product.variants.find((variant) => variant.isActive !== false && variant.size === (size || '') && variant.color === (color || ''))
    : null;
  if (product.variants?.length && !selectedVariant) {
    throw new ApiError(400, 'Select an available product variant.', 'VARIANT_NOT_FOUND');
  }
  const available = selectedVariant
    ? selectedVariant.stock - (selectedVariant.reservedStock || 0)
    : product.stock - (product.reservedStock || 0);

  let cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) cart = new Cart({ userId: req.user._id, items: [] });

  const existingIndex = cart.items.findIndex(
    (i) => i.productId.toString() === productId && i.size === size && i.color === color
  );

  const finalQuantity = requestedQuantity + (existingIndex > -1 ? cart.items[existingIndex].quantity : 0);
  if (finalQuantity > available) {
    throw new ApiError(409, 'The requested quantity is no longer available.', 'INSUFFICIENT_STOCK');
  }

  if (existingIndex > -1) {
    cart.items[existingIndex].quantity = finalQuantity;
  } else {
    cart.items.push({
      productId,
      name: product.name,
      image: product.images[0]?.url || '',
      price: selectedVariant?.price ?? product.price,
      size: size || '',
      color: color || '',
      quantity: requestedQuantity,
    });
  }
  cart.updatedAt = new Date();
  await cart.save();
  res.json({ success: true, cart });
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const requestedQuantity = Number(quantity);
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > 20) throw new ApiError(400, 'Quantity must be a whole number between 1 and 20.');

  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) throw new ApiError(404, 'Cart not found.');

  const item = cart.items.id(req.params.itemId);
  if (!item) throw new ApiError(404, 'Cart item not found.');

  const product = await Product.findOne({ _id: item.productId, status: 'approved', isActive: true });
  if (!product) throw new ApiError(409, 'This product is no longer available.', 'PRODUCT_UNAVAILABLE');
  const selectedVariant = product.variants?.length
    ? product.variants.find((variant) => variant.isActive !== false && variant.size === item.size && variant.color === item.color)
    : null;
  if (product.variants?.length && !selectedVariant) throw new ApiError(409, 'This variant is no longer available.', 'VARIANT_UNAVAILABLE');
  const available = selectedVariant ? selectedVariant.stock - (selectedVariant.reservedStock || 0) : product.stock - (product.reservedStock || 0);
  if (requestedQuantity > available) throw new ApiError(409, 'The requested quantity is no longer available.', 'INSUFFICIENT_STOCK');
  item.quantity = requestedQuantity;
  cart.updatedAt = new Date();
  await cart.save();
  res.json({ success: true, cart });
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) throw new ApiError(404, 'Cart not found.');

  cart.items = cart.items.filter((i) => i._id.toString() !== req.params.itemId);
  cart.updatedAt = new Date();
  await cart.save();
  res.json({ success: true, cart });
});

export const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndUpdate({ userId: req.user._id }, { items: [], updatedAt: new Date() });
  res.json({ success: true, message: 'Cart cleared.' });
});

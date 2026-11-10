/**
 * calcShipping — shipping is ALWAYS from admin-assigned product.shippingFee.
 * line fee = shippingFee × quantity; total = sum of line fees.
 * No free-shipping threshold, no flat rate.
 *
 * @param {Array<{ shippingFee?: number|string, quantity: number }>} items
 * @returns {number}
 */
export const calcShipping = (items) =>
  items.reduce((sum, i) => sum + Number(i.shippingFee || 0) * i.quantity, 0);

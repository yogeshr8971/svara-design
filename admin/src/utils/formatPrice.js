export const formatPrice = (price) => {
  const num = Number(price) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

export const calculateDiscount = (originalPrice, sellingPrice) => {
  const orig = Number(originalPrice);
  const sell = Number(sellingPrice);
  if (!orig || !sell || orig <= sell) return 0;
  return Math.round(((orig - sell) / orig) * 100);
};

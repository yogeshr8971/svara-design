export const VTO_CREDIT_COST = 1;
export const DEFAULT_USER_CREDITS =
  import.meta.env.VITE_DEFAULT_USER_CREDITS !== undefined && import.meta.env.VITE_DEFAULT_USER_CREDITS !== ''
    ? Number(import.meta.env.VITE_DEFAULT_USER_CREDITS)
    : 5;
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const DENIM_SIZES = ['24', '26', '28', '30', '32', '34'];
export const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Trending', value: 'popular' },
];
export const CATEGORIES = [
  { name: 'All', slug: '' },
  { name: 'Dress', slug: 'dress' },
  { name: 'Handbag', slug: 'handbag' },
  { name: 'Footwear', slug: 'footwear' },
  { name: 'Earrings', slug: 'earrings' },
  { name: 'Accessories', slug: 'accessories' },
];
export const AI_DISCLAIMER =
  'AI Preview — This visualization shows how the style may look on you. Actual fit may vary based on size, fabric, body measurements, and garment construction.';

export const PAYMENT_STATUSES = {
  pending: { label: 'Payment Pending', color: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Pay on Delivery', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Payment Failed', color: 'bg-red-100 text-red-700' },
  refunded: { label: 'Refunded', color: 'bg-ivory-300 text-charcoal-600' },
};

export const PAYMENT_METHOD_LABELS = {
  razorpay: 'Card / Netbanking (Razorpay)',
  upi: 'UPI',
  cod: 'Cash on Delivery',
};

// Customer-facing fulfillment statuses must be exactly: Ordered, Shipped, Delivered
export const ORDER_STATUSES = {
  Ordered: { label: 'Ordered', color: 'bg-champagne-200 text-charcoal-800', step: 1 },
  Shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800', step: 2 },
  Delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800', step: 3 },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', step: 0 },
  pending_payment: { label: 'Awaiting Payment', color: 'bg-amber-100 text-amber-700', step: 0 },
};

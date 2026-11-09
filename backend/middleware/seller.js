import { ApiError } from '../utils/apiError.js';

// Checks if user is a registered seller (for read-only dashboard access or status checking)
export const sellerOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'seller') {
    throw new ApiError(403, 'Access denied. Seller account required.', 'FORBIDDEN_NOT_SELLER');
  }
  next();
};

// Checks if user is an ACTIVE, approved seller (strictly required for creating/updating products, receiving payouts)
export const activeSellerOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'seller') {
    throw new ApiError(403, 'Access denied. Seller account required.', 'FORBIDDEN_NOT_SELLER');
  }

  const status = req.user.sellerStatus;
  if (status === 'pending') {
    throw new ApiError(
      403,
      'Your seller account application is currently pending admin review. Listing products will be enabled once approved.',
      'SELLER_PENDING_APPROVAL'
    );
  }

  if (status === 'suspended') {
    throw new ApiError(
      403,
      'Your seller account has been suspended. Please contact SVARA Marketplace support.',
      'SELLER_SUSPENDED'
    );
  }

  if (status === 'rejected') {
    throw new ApiError(
      403,
      `Your seller application was rejected${req.user.rejectionReason ? `: ${req.user.rejectionReason}` : '.'}`,
      'SELLER_REJECTED'
    );
  }

  if (status !== 'active') {
    throw new ApiError(403, 'Your seller account is not currently active.', 'SELLER_INACTIVE');
  }

  next();
};

// Checks if user is active seller or admin
export const sellerOrAdmin = (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required.', 'UNAUTHORIZED');
  }

  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.role === 'seller') {
    return activeSellerOnly(req, res, next);
  }

  throw new ApiError(403, 'Access denied. Active Seller or Admin privileges required.', 'FORBIDDEN');
};

// Customer-only middleware (e.g. for customer reviews or shopping cart actions)
export const customerOnly = (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Please sign in to continue.', 'UNAUTHORIZED');
  }
  // User or Admin can act as customer
  if (req.user.role === 'seller') {
    throw new ApiError(
      403,
      'This feature is reserved for customer accounts. Please use a customer profile.',
      'CUSTOMER_ONLY'
    );
  }
  next();
};

// Verifies seller owns the product
export const verifyProductOwnership = (product, user) => {
  if (!product || !user) return false;
  if (user.role === 'admin') return true;
  if (
    user.role === 'seller' &&
    product.sellerId &&
    product.sellerId.toString() === user._id.toString()
  ) {
    return true;
  }
  return false;
};

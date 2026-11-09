import { ApiError } from '../utils/apiError.js';

export const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Access denied. Admin privileges required.', 'FORBIDDEN_ADMIN_ONLY');
  }
  next();
};

export const rootAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin' || !req.user.isRootAdmin) {
    throw new ApiError(403, 'Access denied. Only the Root Administrator can perform this action.', 'FORBIDDEN_ROOT_ADMIN_ONLY');
  }
  next();
};

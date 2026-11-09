import { ApiError } from '../utils/apiError.js';

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let errors = err.errors || [];

  // Mongoose bad ObjectId (CastError)
  if (err.name === 'CastError') {
    message = 'Requested resource not found or invalid identifier format.';
    statusCode = 404;
    code = 'RESOURCE_NOT_FOUND';
  }

  // Mongoose duplicate key error (11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const capitalized = field.charAt(0).toUpperCase() + field.slice(1);
    message = `${capitalized} already exists. Please use a different value.`;
    statusCode = 409;
    code = 'DUPLICATE_KEY';
  }

  // Mongoose schema validation error
  if (err.name === 'ValidationError') {
    errors = Object.values(err.errors || {}).map((e) => e.message);
    message = errors.join(', ') || 'Validation error';
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid authentication token. Please sign in again.';
    statusCode = 401;
    code = 'AUTH_TOKEN_INVALID';
  }
  if (err.name === 'TokenExpiredError') {
    message = 'Your session has expired. Please log in again.';
    statusCode = 401;
    code = 'AUTH_TOKEN_EXPIRED';
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'Uploaded file is too large. Maximum allowed file size is 10MB.';
    statusCode = 400;
    code = 'FILE_TOO_LARGE';
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    message = 'Unexpected file field in upload payload.';
    statusCode = 400;
    code = 'FILE_UNEXPECTED';
  }

  // Log non-operational (server-side unexpected) errors for debugging, hiding stack from user
  if (statusCode >= 500) {
    console.error(`[CRITICAL ERROR] [${req.method} ${req.originalUrl}] [${new Date().toISOString()}]:`, {
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      user: req.user?._id,
      body: req.method !== 'GET' ? '(payload present)' : undefined,
    });
  }

  res.status(statusCode).json({
    success: false,
    code,
    message,
    ...(errors.length > 0 && { errors }),
  });
};

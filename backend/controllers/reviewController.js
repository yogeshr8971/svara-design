import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';
import { validateFileType } from '../utils/validateFileType.js';

// Helper to recalculate and persist averageRating, count, and distribution on Product
export const updateProductRatingStats = async (productId) => {
  const stats = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), isApproved: true } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 },
        star5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        star4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        star3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        star2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        star1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
      },
    },
  ]);

  const result = stats[0] || {
    average: 0,
    count: 0,
    star5: 0,
    star4: 0,
    star3: 0,
    star2: 0,
    star1: 0,
  };

  const roundedAvg = Math.round(result.average * 10) / 10;

  await Product.findByIdAndUpdate(productId, {
    ratings: {
      average: roundedAvg,
      count: result.count,
      distribution: {
        5: result.star5,
        4: result.star4,
        3: result.star3,
        2: result.star2,
        1: result.star1,
      },
    },
  });

  return {
    average: roundedAvg,
    count: result.count,
    distribution: {
      5: result.star5,
      4: result.star4,
      3: result.star3,
      2: result.star2,
      1: result.star1,
    },
  };
};

// GET /api/reviews/product/:productId
export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 10, sort = 'recent', rating } = req.query;

  const filter = {
    productId,
    isApproved: true,
  };
  if (rating) {
    filter.rating = Number(rating);
  }

  const sortOptions = {
    recent: { createdAt: -1 },
    highest: { rating: -1, createdAt: -1 },
    lowest: { rating: 1, createdAt: -1 },
    helpful: { helpfulCount: -1, createdAt: -1 },
  };
  const sortBy = sortOptions[sort] || sortOptions.recent;

  const skip = (Number(page) - 1) * Number(limit);

  const [reviews, total, product] = await Promise.all([
    Review.find(filter)
      .populate('userId', 'name profileImage')
      .sort(sortBy)
      .skip(skip)
      .limit(Number(limit)),
    Review.countDocuments(filter),
    Product.findById(productId).select('ratings name'),
  ]);

  // Check if current user has already reviewed and if they purchased
  let userReview = null;
  let canReview = false;
  let isVerified = false;

  if (req.user) {
    userReview = await Review.findOne({ productId, userId: req.user._id });
    const deliveredOrder = await Order.findOne({
      userId: req.user._id,
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      'items.productId': productId,
    });
    if (deliveredOrder) {
      isVerified = true;
      canReview = req.user.role === 'user' && !userReview;
    }
  }

  res.json({
    success: true,
    reviews,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    ratingsSummary: product?.ratings || {
      average: 0,
      count: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    },
    userReview,
    canReview,
    isVerified,
  });
});

// POST /api/reviews/product/:productId
export const createReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, title, comment } = req.body;

  if (req.user.role !== 'user') {
    throw new ApiError(403, 'Only customer accounts can submit product reviews.', 'CUSTOMER_ONLY');
  }

  if (!rating || Number(rating) < 1 || Number(rating) > 5) {
    throw new ApiError(400, 'Rating must be an integer between 1 and 5.', 'VALIDATION_ERROR');
  }
  if (!comment || !comment.trim()) {
    throw new ApiError(400, 'Review comment is required.', 'VALIDATION_ERROR');
  }

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found.', 'NOT_FOUND');

  // Check for duplicate review (Rule 40)
  const existingReview = await Review.findOne({ productId, userId: req.user._id });
  if (existingReview) {
    throw new ApiError(409, 'You have already submitted a review for this product.', 'DUPLICATE_REVIEW');
  }

  // Check verified purchase (Rule 39)
  const deliveredOrder = await Order.findOne({
    userId: req.user._id,
    paymentStatus: 'paid',
    orderStatus: 'delivered',
    'items.productId': productId,
  });
  if (!deliveredOrder) {
    throw new ApiError(403, 'You can review this product after it has been delivered.', 'DELIVERED_PURCHASE_REQUIRED');
  }
  const isVerifiedPurchase = true;

  // Process any uploaded review photos
  const images = [];
  if (req.files && Array.isArray(req.files)) {
    for (const file of req.files) {
      if (!validateFileType(file.buffer)) {
        throw new ApiError(400, 'Review images must be valid JPEG, PNG, or WEBP files.', 'INVALID_FILE_TYPE');
      }
      const uploadRes = await uploadToCloudinary(file.buffer, 'reviews', 'rev');
      images.push({ url: uploadRes.secure_url, public_id: uploadRes.public_id });
    }
  }

  const review = await Review.create({
    productId,
    userId: req.user._id,
    orderId: deliveredOrder._id,
    rating: Number(rating),
    title: title?.trim() || '',
    comment: comment.trim(),
    images,
    isVerifiedPurchase,
    isApproved: true,
  });

  // Automatically recalculate product rating stats (Rule 43)
  const updatedStats = await updateProductRatingStats(productId);

  res.status(201).json({
    success: true,
    review,
    ratingsSummary: updatedStats,
    message: isVerifiedPurchase
      ? 'Verified Purchase review posted successfully!'
      : 'Review posted successfully!',
  });
});

// PUT /api/reviews/:id
export const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, 'Review not found.', 'NOT_FOUND');

  if (review.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'You can only edit your own review.', 'FORBIDDEN');
  }

  const { rating, title, comment } = req.body;
  if (rating !== undefined) {
    const num = Number(rating);
    if (num < 1 || num > 5) throw new ApiError(400, 'Rating must be between 1 and 5.');
    review.rating = num;
  }
  if (title !== undefined) review.title = title.trim();
  if (comment !== undefined) review.comment = comment.trim();
  review.isEdited = true;
  await review.save();

  await updateProductRatingStats(review.productId);

  res.json({ success: true, review, message: 'Review updated successfully.' });
});

// DELETE /api/reviews/:id
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, 'Review not found.', 'NOT_FOUND');

  if (review.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'You can only delete your own review.', 'FORBIDDEN');
  }
  if (req.user.role === 'admin' && !req.body.reason?.trim()) {
    throw new ApiError(400, 'A moderation reason is required when an admin removes a review.', 'MODERATION_REASON_REQUIRED');
  }

  const prodId = review.productId;
  await review.deleteOne();
  await updateProductRatingStats(prodId);

  res.json({ success: true, message: 'Review deleted successfully.' });
});

// POST /api/reviews/:id/vote (Rule 42: Helpful / Unhelpful voting without unlimited spam)
export const voteHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, 'Review not found.', 'NOT_FOUND');

  const userIdStr = req.user._id.toString();
  const existingVoteIndex = review.helpfulVotes.findIndex(
    (v) => v.userId.toString() === userIdStr
  );

  let userVoteState = 'helpful';

  if (existingVoteIndex > -1) {
    // If clicked again, toggle/remove vote
    review.helpfulVotes.splice(existingVoteIndex, 1);
    userVoteState = 'none';
  } else {
    review.helpfulVotes.push({ userId: req.user._id, vote: 'helpful' });
    userVoteState = 'helpful';
  }

  review.helpfulCount = review.helpfulVotes.filter((v) => v.vote === 'helpful').length;
  await review.save();

  res.json({
    success: true,
    helpfulCount: review.helpfulCount,
    userVote: userVoteState,
  });
});

// PATCH /api/reviews/:id/moderate (Admin moderation: Rule 41)
export const adminModerateReview = asyncHandler(async (req, res) => {
  const { isApproved, reason = '' } = req.body;
  if (isApproved === undefined) {
    throw new ApiError(400, 'isApproved boolean flag is required.', 'VALIDATION_ERROR');
  }
  if (!Boolean(isApproved) && !reason.trim()) {
    throw new ApiError(400, 'A moderation reason is required when hiding a review.', 'MODERATION_REASON_REQUIRED');
  }

  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { isApproved: Boolean(isApproved), moderationReason: reason.trim(), moderatedBy: req.user._id, moderatedAt: new Date() },
    { new: true }
  );
  if (!review) throw new ApiError(404, 'Review not found.', 'NOT_FOUND');

  await updateProductRatingStats(review.productId);

  res.json({
    success: true,
    review,
    message: isApproved ? 'Review approved for public display.' : 'Review hidden from public catalog.',
  });
});

// GET /api/reviews/admin/all (Admin reviews management table)
export const getAdminReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isApproved, search } = req.query;
  const filter = {};
  if (isApproved !== undefined) filter.isApproved = isApproved === 'true';

  const skip = (Number(page) - 1) * Number(limit);
  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('userId', 'name email')
      .populate('productId', 'name slug images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Review.countDocuments(filter),
  ]);

  res.json({
    success: true,
    reviews,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
});

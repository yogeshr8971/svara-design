import api from './api';

/**
 * Fetch reviews for a specific product
 */
export const getProductReviews = async (productId, params = {}) => {
  const { data } = await api.get(`/reviews/product/${productId}`, { params });
  return data;
};

/**
 * Create a review for a purchased product
 */
export const createReview = async (productId, reviewData) => {
  const { data } = await api.post(`/reviews/product/${productId}`, reviewData);
  return data;
};

/**
 * Update an existing review
 */
export const updateReview = async (reviewId, reviewData) => {
  const { data } = await api.put(`/reviews/${reviewId}`, reviewData);
  return data;
};

/**
 * Delete a user review
 */
export const deleteReview = async (reviewId) => {
  const { data } = await api.delete(`/reviews/${reviewId}`);
  return data;
};

/**
 * Vote review helpful (toggle)
 */
export const voteReviewHelpful = async (reviewId) => {
  const { data } = await api.post(`/reviews/${reviewId}/vote`);
  return data;
};

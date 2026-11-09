import api from './api';

/**
 * Fetch all active categories from backend API (MongoDB source of truth)
 */
export const getCategories = async () => {
  const { data } = await api.get('/categories');
  return data;
};

/**
 * Fetch a single category by slug
 */
export const getCategory = async (slug) => {
  const { data } = await api.get(`/categories/${slug}`);
  return data;
};

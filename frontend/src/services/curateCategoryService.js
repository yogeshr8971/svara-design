import api from './api';

/**
 * Fetch active curate categories ordered by sortOrder
 */
export const getCurateCategories = async () => {
  const { data } = await api.get('/curate-categories');
  return data;
};

/**
 * Fetch a single curate category by slug
 */
export const getCurateCategory = async (slug) => {
  const { data } = await api.get(`/curate-categories/${slug}`);
  return data;
};

/**
 * Admin: Create curate category
 */
export const createCurateCategory = async (formData) => {
  const { data } = await api.post('/curate-categories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

/**
 * Admin: Update curate category
 */
export const updateCurateCategory = async (id, formData) => {
  const { data } = await api.put(`/curate-categories/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

/**
 * Admin: Delete curate category
 */
export const deleteCurateCategory = async (id) => {
  const { data } = await api.delete(`/curate-categories/${id}`);
  return data;
};

export const reorderCurateCategories = async (orderList) => {
  const { data } = await api.put('/curate-categories/reorder', { orderList });
  return data;
};

export const getStageProducts = async (slug, params = {}) => {
  const { data } = await api.get(`/curate-categories/${slug}/products`, { params });
  return data;
};

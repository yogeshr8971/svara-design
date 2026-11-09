import api from './api';

export const getSellerDashboard = async (params = {}) => {
  const res = await api.get('/seller/dashboard', { params });
  return res.data;
};

export const getSellerProducts = async (params = {}) => {
  const res = await api.get('/seller/products', { params });
  return res.data;
};

export const createSellerProduct = async (formData) => {
  const res = await api.post('/seller/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const updateSellerProduct = async (id, formData) => {
  const res = await api.put(`/seller/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deleteSellerProduct = async (id) => {
  const res = await api.delete(`/seller/products/${id}`);
  return res.data;
};

export const updateSellerProductStock = async (id, stock, variants = []) => {
  const res = await api.patch(`/seller/products/${id}/stock`, { stock, variants });
  return res.data;
};

export const getSellerOrders = async (params = {}) => {
  const res = await api.get('/seller/orders', { params });
  return res.data;
};

export const getSellerSales = async (params = {}) => {
  const res = await api.get('/seller/sales', { params });
  return res.data;
};

export const updateSellerProfile = async (data) => {
  const res = await api.put('/seller/profile', data);
  return res.data;
};

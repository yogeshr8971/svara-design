import api from './api';

// Authentication
export const adminLogin = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

export const verifyAdminOtp = async (email, otp) => {
  const { data } = await api.post('/auth/login/verify', { email, otp });
  return data;
};

export const getAdminMe = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

export const adminLogout = async () => {
  const { data } = await api.post('/auth/logout');
  return data;
};

// Overview & Analytics
export const getStats = async () => {
  const { data } = await api.get('/admin/stats');
  return data;
};

export const getAllSales = async (params = {}) => {
  const { data } = await api.get('/admin/sales', { params });
  return data;
};

// Users & Customers
export const getUsers = async (params = {}) => {
  const { data } = await api.get('/admin/users', { params });
  return data;
};

export const getUser = async (id) => {
  const { data } = await api.get(`/admin/users/${id}`);
  return data;
};

export const updateUserRole = async (id, role) => {
  const { data } = await api.patch(`/admin/users/${id}/role`, { role });
  return data;
};

export const blockUser = async (id, reason = '') => {
  const { data } = await api.patch(`/admin/users/${id}/block`, { reason });
  return data;
};

export const unblockUser = async (id) => {
  const { data } = await api.patch(`/admin/users/${id}/unblock`);
  return data;
};

export const deleteUser = async (id, reason = '') => {
  const { data } = await api.delete(`/admin/users/${id}`, { data: { reason } });
  return data;
};

export const createAdminUser = async (userData) => {
  const { data } = await api.post('/admin/create-admin', userData);
  return data;
};

export const getAuditLogs = async (params = {}) => {
  const { data } = await api.get('/admin/audit-logs', { params });
  return data;
};

export const updateAdminProductStock = async (id, stock, variants = []) => {
  const { data } = await api.patch(`/admin/products/${id}/stock`, { stock, variants });
  return data;
};

// Seller Management
export const getSellers = async (params = {}) => {
  const { data } = await api.get('/admin/sellers', { params });
  return data;
};

export const getSellerDetails = async (id) => {
  const { data } = await api.get(`/admin/sellers/${id}`);
  return data;
};

export const updateSellerStatus = async (id, status, reason = '') => {
  const { data } = await api.patch(`/admin/sellers/${id}/status`, { status, reason });
  return data;
};

export const getSellerProfileChanges = async (params = {}) => {
  const { data } = await api.get('/admin/seller-profile-changes', { params });
  return data;
};

export const reviewSellerProfileChange = async (id, status, reason = '') => {
  const { data } = await api.patch(`/admin/seller-profile-changes/${id}`, { status, reason });
  return data;
};

// Product Management & Approvals
export const getAdminProducts = async (params = {}) => {
  const { data } = await api.get('/admin/products', { params });
  return data;
};

export const approveProduct = async (id, shippingFee) => {
  const { data } = await api.patch(`/admin/products/${id}/approve`, { shippingFee });
  return data;
};

export const batchApproveProducts = async (approvals) => {
  const { data } = await api.post('/admin/products/batch-approve', { approvals });
  return data;
};

export const assignShippingFee = async (id, shippingFee) => {
  const { data } = await api.patch(`/admin/products/${id}/shipping-fee`, { shippingFee });
  return data;
};

export const downloadOriginalPhoto = async (id, photoIndex = 0) => {
  const { data } = await api.get(`/admin/products/${id}/photos/${photoIndex}/download`);
  return data;
};

export const rejectProduct = async (id, reason) => {
  const { data } = await api.patch(`/admin/products/${id}/reject`, { reason });
  return data;
};

export const deactivateProduct = async (id, reason) => {
  const { data } = await api.patch(`/admin/products/${id}/deactivate`, { reason });
  return data;
};

export const createProduct = async (formData) => {
  const { data } = await api.post('/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const updateProduct = async (id, formData) => {
  const { data } = await api.put(`/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteProduct = async (id) => {
  const { data } = await api.delete(`/products/${id}`);
  return data;
};

// Category Management
export const getCategories = async () => {
  const { data } = await api.get('/categories');
  return data;
};

export const reorderCategories = async (orderList) => {
  const { data } = await api.put('/admin/categories/reorder', { orderList });
  return data;
};

export const createCategory = async (payload) => {
  const headers = payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
  const { data } = await api.post('/categories', payload, { headers });
  return data;
};

export const updateCategory = async (id, payload) => {
  const headers = payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
  const { data } = await api.put(`/categories/${id}`, payload, { headers });
  return data;
};

export const deleteCategory = async (id) => {
  const { data } = await api.delete(`/categories/${id}`);
  return data;
};

// Orders & Order-Status Management (Exactly 3 values: Ordered, Shipped, Delivered)
export const getAllOrders = async (params = {}) => {
  const { data } = await api.get('/admin/orders', { params });
  return data;
};

export const updateOrderStatus = async (id, { status, note = '', trackingNumber = '', courier = '', expectedDelivery = '' }) => {
  const { data } = await api.patch(`/admin/orders/${id}/status`, { status, note, trackingNumber, courier, expectedDelivery });
  return data;
};

export const recordCodPayment = async (id) => {
  const { data } = await api.patch(`/admin/orders/${id}/collect-cod`);
  return data;
};

export const verifyUpiPayment = async (id, body) => {
  const { data } = await api.post(`/admin/orders/${id}/upi-verify`, body);
  return data;
};

// Platform Commission & Settings
export const getCommissionSettings = async () => {
  const { data } = await api.get('/admin/commission');
  return data;
};

export const updateCommissionSettings = async (commissionRate) => {
  const { data } = await api.put('/admin/commission', { commissionRate });
  return data;
};

// Excel Bulk Import
export const downloadExcelTemplate = async () => {
  const response = await api.get('/admin/import-products/template', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'svara_products_template.xlsx');
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const previewExcelImport = async (formData) => {
  const { data } = await api.post('/admin/import-products/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const executeExcelImport = async (formData) => {
  const { data } = await api.post('/admin/import-products/execute', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

// VTO Logs, Credits & Reviews
export const getVtoGenerations = async (params = {}) => {
  const { data } = await api.get('/admin/vto', { params });
  return data;
};

export const getAdminReviews = async (params = {}) => {
  const { data } = await api.get('/reviews/admin/all', { params });
  return data;
};

export const moderateReview = async (id, isApproved, reason = '') => {
  const { data } = await api.patch(`/reviews/${id}/moderate`, { isApproved, reason });
  return data;
};

export const deleteReview = async (id, reason) => {
  const { data } = await api.delete(`/reviews/${id}`, { data: { reason } });
  return data;
};

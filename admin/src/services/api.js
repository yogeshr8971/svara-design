import axios from 'axios';

// In production, uses the configured VITE_API_URL; in development, defaults to relative /api via Vite proxy
const rawBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '') : '';
const baseURL = rawBase
  ? (rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`)
  : '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('svara_admin_token') || localStorage.getItem('svara_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('svara_admin_user');
      localStorage.removeItem('svara_admin_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }

    const readableMessage =
      error.response?.data?.message ||
      (error.response?.status === 403
        ? 'Access denied. Administrator privileges required.'
        : error.response?.status === 429
        ? 'Too many requests. Please wait a moment.'
        : error.message || 'An unexpected error occurred.');

    error.readableMessage = readableMessage;
    return Promise.reject(error);
  }
);

export default api;

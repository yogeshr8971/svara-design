import axios from 'axios';

// Respect VITE_API_URL in production or default to relative /api
const baseURL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') + '/api'
  : '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 25000, // 25 second timeout to prevent indefinite hangs
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('svara_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Safe retry helper for read-only GET requests only (Rule 12)
const MAX_SAFE_RETRIES = 2;
const RETRYABLE_STATUS_CODES = [502, 503, 504];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    // Check if error is due to intentional cancellation (AbortController)
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    // Safe retry only for GET requests on network failures or temporary 502/503/504 server issues
    if (
      config &&
      config.method?.toLowerCase() === 'get' &&
      !config._isRetry &&
      (!response || RETRYABLE_STATUS_CODES.includes(response.status))
    ) {
      config._retryCount = config._retryCount || 0;
      if (config._retryCount < MAX_SAFE_RETRIES) {
        config._retryCount += 1;
        const delayMs = Math.pow(2, config._retryCount) * 500; // 1s, 2s backoff
        await new Promise((res) => setTimeout(res, delayMs));
        return api(config);
      }
    }

    // Handle 401 Unauthorized safely without hard-redirecting guests
    if (response?.status === 401) {
      localStorage.removeItem('svara_user');

      // Only redirect if the user was previously authenticated and was on a protected page
      const isPublicPath = [
        '/',
        '/shop',
        '/curate',
        '/contact',
        '/login',
        '/register',
        '/seller/login',
        '/seller/register',
      ].some((p) => window.location.pathname === p || window.location.pathname.startsWith('/product/'));

      if (!isPublicPath) {
        window.location.href = '/login?expired=true';
      }
    }

    // Standardize error message for components
    const readableMessage =
      response?.data?.message ||
      (response?.status === 429
        ? 'Too many requests. Please wait a moment and try again.'
        : response?.status >= 500
        ? 'SVARA is temporarily experiencing technical difficulties. Please try again.'
        : error.message || 'An unexpected error occurred.');

    error.readableMessage = readableMessage;

    return Promise.reject(error);
  }
);

export default api;

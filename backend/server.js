import 'dotenv/config';
import './models/index.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connectDB, isDbConnected } from './config/db.js';
import { validateEnv } from './config/validateEnv.js';
import { startOrderExpiryJob } from './services/orderExpiry.js';
import { ensureAdminUser } from './config/bootstrapAdmin.js';
import { syncDefaultCategories } from './services/categorySyncService.js';
import {
  catalogLimiter,
  authLimiter,
  registerLimiter,
  checkoutLimiter,
  vtoLimiter,
  adminLimiter,
  sellerLimiter,
  generalLimiter,
} from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import curateCategoryRoutes from './routes/curateCategoryRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import avatarRoutes from './routes/avatarRoutes.js';
import playgroundRoutes from './routes/playgroundRoutes.js';
import virtualTryOnRoutes from './routes/virtualTryOnRoutes.js';
import wardrobeRoutes from './routes/wardrobeRoutes.js';
import creditRoutes from './routes/creditRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import sellerRoutes from './routes/sellerRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

validateEnv();

const app = express();

// Trust reverse proxy for accurate IP rate limiting behind Vercel/Nginx/Render/Cloudflare
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const rawOrigins = [
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : ['http://localhost:5173']),
  ...(process.env.ADMIN_URL ? process.env.ADMIN_URL.split(',') : ['http://localhost:5174']),
  'http://localhost:5173',
  'http://localhost:5174',
];

const allowedOrigins = rawOrigins
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      // In development or local/LAN testing, permit any localhost, 127.0.0.1, or local subnet
      if (
        process.env.NODE_ENV !== 'production' ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.')
      ) {
        return callback(null, true);
      }
      if (
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith('.netlify.app') ||
        cleanOrigin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Body parsing with safe limits
// Razorpay signatures must be calculated from the exact, unparsed request body.
app.use('/api/orders/webhook/razorpay', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logger for production visibility
app.use(requestLogger);

// Database auto-connection middleware for serverless (Vercel) cold starts
app.use(async (req, res, next) => {
  if (!isDbConnected()) {
    try {
      await connectDB();
    } catch (e) {
      console.error('Serverless DB connection error:', e.message);
    }
  }
  next();
});

// ==========================================
// Health & Liveness / Readiness Checks
// ==========================================
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'SVARA API Server',
    version: '1.0.0',
    health: '/api/health',
  });
});

app.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'live',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/ready', (req, res) => {
  const ready = isDbConnected();
  if (ready) {
    return res.status(200).json({
      status: 'ready',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
  return res.status(503).json({
    status: 'unavailable',
    database: 'disconnected',
    message: 'Database connection is initializing or unavailable.',
    timestamp: new Date().toISOString(),
  });
});

// Backward compatible health check
app.get('/api/health', (req, res) => {
  const dbStatus = isDbConnected() ? 'connected' : 'disconnected';
  res.json({
    status: isDbConnected() ? 'ok' : 'degraded',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// API Routes with Granular Rate Limiting
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/products', catalogLimiter, productRoutes);
app.use('/api/categories', catalogLimiter, categoryRoutes);
app.use('/api/curate-categories', catalogLimiter, curateCategoryRoutes);
app.use('/api/reviews', catalogLimiter, reviewRoutes);
app.use('/api/cart', generalLimiter, cartRoutes);
app.use('/api/wishlist', generalLimiter, wishlistRoutes);
app.use('/api/avatar', generalLimiter, avatarRoutes);
app.use('/api/playground', generalLimiter, playgroundRoutes);
app.use('/api/virtual-tryon', vtoLimiter, virtualTryOnRoutes);
app.use('/api/wardrobe', generalLimiter, wardrobeRoutes);
app.use('/api/credits', generalLimiter, creditRoutes);
app.use('/api/orders', checkoutLimiter, orderRoutes);
app.use('/api/seller', sellerLimiter, sellerRoutes);
app.use('/api/notifications', generalLimiter, notificationRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    code: 'ROUTE_NOT_FOUND',
    message: `Endpoint ${req.method} ${req.originalUrl} not found.`,
  });
});

// Centralized error handler (must be last)
app.use(errorHandler);

// Database and bootstrap initialization helper
let isInitialized = false;
export const initApp = async () => {
  if (isInitialized) return;
  await connectDB();
  try {
    await ensureAdminUser();
    await syncDefaultCategories();
  } catch (err) {
    console.warn('Bootstrap warning:', err.message);
  }
  isInitialized = true;
};

// Start standalone HTTP server only when not running in serverless environment (e.g. Vercel)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  const start = async () => {
    await initApp();
    const stopExpiry = startOrderExpiryJob();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 SVARA Backend running on http://localhost:${PORT}`);
      console.log(`📦 VTO Provider: ${process.env.VTO_PROVIDER || 'gemini'}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('Shutting down gracefully...');
      stopExpiry();
      server.close(() => process.exit(0));
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  };

  start();
}

export default app;

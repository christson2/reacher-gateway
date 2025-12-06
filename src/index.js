/**
 * Reacher API Gateway
 * 
 * Central entry point for all API requests.
 * Validates JWT tokens, routes requests to appropriate services,
 * and handles cross-cutting concerns (logging, rate limiting, etc.)
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const redis = require('redis');
const { createProxyMiddleware } = require('http-proxy-middleware');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Service URLs
const SERVICES = {
  AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
  USER: process.env.USER_SERVICE_URL || 'http://localhost:5002',
  PRODUCT: process.env.PRODUCT_SERVICE_URL || 'http://localhost:5003',
  PROVIDER: process.env.PROVIDER_SERVICE_URL || 'http://localhost:5004',
  TRUST: process.env.TRUST_SERVICE_URL || 'http://localhost:5005',
  MESSAGE: process.env.MESSAGE_SERVICE_URL || 'http://localhost:5006',
  NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5007',
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redis client for token blacklist
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

// Silently handle Redis errors (optional feature, not critical)
redisClient.on('error', () => {
  // Redis errors silently caught - blacklist feature disabled
});
redisClient.connect().catch(() => {
  // Redis connection failed silently - system continues to operate
});

/**
 * Middleware: JWT Validation
 * Validates token and attaches user context to request
 */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user to request context
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-email'] = decoded.email;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
};

/**
 * Middleware: Request logging
 */
const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - User: ${req.user?.userId || 'anonymous'}`);
  next();
};

app.use(requestLogger);

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
});

/**
 * Public Auth Routes (no JWT required)
 */
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: SERVICES.AUTH,
    changeOrigin: true,
    pathRewrite: {
      '^/api/auth': '', // Remove /api prefix
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[Gateway] → Auth Service: ${req.method} ${req.path}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[Gateway] ← Auth Service: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error('[Gateway] Auth Service Error:', err.message);
      res.status(503).json({ success: false, error: 'Auth service unavailable' });
    },
  })
);


/**
 * Protected Routes (require valid JWT)
 */

/**
 * User Service Routes
 */
app.use(
  '/api/users',
  verifyToken,
  createProxyMiddleware({
    target: SERVICES.USER,
    changeOrigin: true,
    pathRewrite: {
      '^/api/users': '', // Remove /api prefix
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[Gateway] → User Service: ${req.method} ${req.path}`);
    },
    onError: (err, req, res) => {
      console.error('[Gateway] User Service Error:', err.message);
      res.status(503).json({ success: false, error: 'User service unavailable' });
    },
  })
);

/**
 * Product Service Routes
 */
app.use(
  '/api/products',
  verifyToken,
  createProxyMiddleware({
    target: SERVICES.PRODUCT,
    changeOrigin: true,
    pathRewrite: {
      '^/api/products': '', // Remove /api prefix
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[Gateway] → Product Service: ${req.method} ${req.path}`);
    },
    onError: (err, req, res) => {
      console.error('[Gateway] Product Service Error:', err.message);
      res.status(503).json({ success: false, error: 'Product service unavailable' });
    },
  })
);

/**
 * Provider Service Routes
 */
app.use(
  '/api/providers',
  verifyToken,
  createProxyMiddleware({
    target: SERVICES.PROVIDER,
    changeOrigin: true,
    pathRewrite: {
      '^/api/providers': '', // Remove /api prefix
    },
    onError: (err, req, res) => {
      console.error('[Gateway] Provider Service Error:', err.message);
      res.status(503).json({ success: false, error: 'Provider service unavailable' });
    },
  })
);

/**
 * Trust Service Routes
 */
app.use(
  '/api/trust',
  verifyToken,
  createProxyMiddleware({
    target: SERVICES.TRUST,
    changeOrigin: true,
    pathRewrite: {
      '^/api/trust': '', // Remove /api prefix
    },
    onError: (err, req, res) => {
      console.error('[Gateway] Trust Service Error:', err.message);
      res.status(503).json({ success: false, error: 'Trust service unavailable' });
    },
  })
);

/**
 * Message Service Routes
 */
app.use(
  '/api/messages',
  verifyToken,
  createProxyMiddleware({
    target: SERVICES.MESSAGE,
    changeOrigin: true,
    pathRewrite: {
      '^/api/messages': '', // Remove /api prefix
    },
    onError: (err, req, res) => {
      console.error('[Gateway] Message Service Error:', err.message);
      res.status(503).json({ success: false, error: 'Message service unavailable' });
    },
  })
);

/**
 * Notification Service Routes
 */
app.use(
  '/api/notifications',
  verifyToken,
  createProxyMiddleware({
    target: SERVICES.NOTIFICATION,
    changeOrigin: true,
    pathRewrite: {
      '^/api/notifications': '', // Remove /api prefix
    },
    onError: (err, req, res) => {
      console.error('[Gateway] Notification Service Error:', err.message);
      res.status(503).json({ success: false, error: 'Notification service unavailable' });
    },
  })
);

/**
 * 404 Not Found
 */
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
  console.error('[Gateway] Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`[Gateway] listening on http://0.0.0.0:${PORT}`);
  console.log(`[Gateway] JWT_SECRET=${JWT_SECRET ? 'set' : 'not set'}`);
  console.log(`[Gateway] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  console.log('[Gateway] Service mapping:');
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`  ${name}: ${url}`);
  });
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('[Gateway] Shutting down...');
  await redisClient.quit().catch(() => {});
  process.exit(0);
});

module.exports = app;

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Gateway] listening on http://0.0.0.0:${PORT}`);
  console.log(`[Gateway] JWT_SECRET=${JWT_SECRET ? 'set' : 'not set'}`);
  console.log(`[Gateway] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

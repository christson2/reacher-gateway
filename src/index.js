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
// Do NOT parse JSON/urlencoded bodies globally here — let proxied services
// (e.g. auth-service) receive the raw request stream so their body parsers
// can handle the payload. Parsing here consumes the stream and requires
// re-streaming logic which can lead to malformed or aborted requests.

// Redis client for token blacklist
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

// Silently handle Redis errors (optional feature, not critical)
redisClient.on('error', () => {});
redisClient.connect().catch(() => {});

/**
 * Middleware: JWT Validation
 */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-email'] = decoded.email;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
};

const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - User: ${req.user?.userId || 'anonymous'}`);
  next();
};

app.use(requestLogger);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
});

app.use(
  '/api/auth',
  createProxyMiddleware({
    target: SERVICES.AUTH,
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '' },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[Gateway] → Auth Service: ${req.method} ${req.path}`);
      // If the incoming request has already been parsed by express (e.g. via
      // `express.json()`), the original request stream will be consumed and
      // the proxy won't forward the body. Re-serialize and write the body to
      // the proxied request so upstream services receive the expected payload.
      try {
        if (req.body && Object.keys(req.body).length) {
          const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          // Ensure headers reflect the forwarded body
          proxyReq.setHeader('Content-Type', proxyReq.getHeader('Content-Type') || 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
          proxyReq.end();
        }
      } catch (e) {
        console.error('[Gateway] Error streaming body to auth service:', e.message);
      }
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

// Protected proxies (require JWT)
app.use(
  '/api/users',
  verifyToken,
  createProxyMiddleware({ target: SERVICES.USER, changeOrigin: true, pathRewrite: { '^/api/users': '' } })
);
app.use(
  '/api/products',
  verifyToken,
  createProxyMiddleware({ target: SERVICES.PRODUCT, changeOrigin: true, pathRewrite: { '^/api/products': '' } })
);
app.use(
  '/api/providers',
  verifyToken,
  createProxyMiddleware({ target: SERVICES.PROVIDER, changeOrigin: true, pathRewrite: { '^/api/providers': '' } })
);
app.use(
  '/api/trust',
  verifyToken,
  createProxyMiddleware({ target: SERVICES.TRUST, changeOrigin: true, pathRewrite: { '^/api/trust': '' } })
);
app.use(
  '/api/messages',
  verifyToken,
  createProxyMiddleware({ target: SERVICES.MESSAGE, changeOrigin: true, pathRewrite: { '^/api/messages': '' } })
);
app.use(
  '/api/notifications',
  verifyToken,
  createProxyMiddleware({ target: SERVICES.NOTIFICATION, changeOrigin: true, pathRewrite: { '^/api/notifications': '' } })
);

// Root
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'gateway', routes: ['/api/health', '/api/auth', '/api/users', '/api/products'] });
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error('[Gateway] Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[Gateway] listening on http://0.0.0.0:${PORT}`);
  console.log(`[Gateway] JWT_SECRET=${JWT_SECRET ? 'set' : 'not set'}`);
  console.log(`[Gateway] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  console.log('[Gateway] Service mapping:');
  Object.entries(SERVICES).forEach(([name, url]) => console.log(`  ${name}: ${url}`));
});

process.on('SIGINT', async () => {
  console.log('[Gateway] Shutting down...');
  await redisClient.quit().catch(() => {});
  process.exit(0);
});

module.exports = app;

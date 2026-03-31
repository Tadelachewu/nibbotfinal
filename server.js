const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const crypto = require('crypto');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 9002;

// Initialize Next.js engine directly from our custom wrapper
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Redis. Uses environment variable REDIS_URL or defaults to localhost
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);
const prisma = require('./src/lib/prisma').default;

redis.on('error', (err) => {
  console.warn('[Redis] Connection warning. Make sure Redis is running locally or REDIS_URL is correctly set in .env', err.message);
});

app.prepare().then(async () => {
  const defaultConnectSrc = ["'self'", "https://www.google.com"];
  if (dev) {
    defaultConnectSrc.push("http://localhost:3000", "http://localhost:3001");
  }
  const dynamicConnectSrcs = new Set();
  const allowedOrigins = new Set(
    String(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );
  if (dev) {
    allowedOrigins.add(`http://${hostname}:${port}`);
    allowedOrigins.add('http://localhost:9002');
    allowedOrigins.add('http://127.0.0.1:9002');
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://localhost:3001');
  }

  try {
    const menuItems = await prisma.menuItem.findMany({
      select: {
        apiConfig: true,
      },
      where: {
        apiConfig: {
          path: ["endpoint"],
          not: null,
        },
      },
    });

    for (const item of menuItems) {
      if (item.apiConfig && item.apiConfig.endpoint) {
        // Resolve templates in the endpoint URL if any
        let endpoint = item.apiConfig.endpoint;
        // Basic template resolution for common placeholders. This might need to be more robust.
        endpoint = endpoint.replace(/{{[^{}]+}}/g, "example"); // Replace {{...}} with 'example' to make it a valid URL for origin extraction

        // Only add absolute URLs to the CSP connect-src
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
          try {
            const url = new URL(endpoint);
            dynamicConnectSrcs.add(url.origin);
          } catch (error) {
            console.warn(`Invalid API endpoint URL "${endpoint}" for CSP:`, error.message);
          }
        }
        // Relative URLs (e.g., /api/...) are implicitly covered by 'self' in defaultConnectSrc
      }
    }
  } catch (error) {
    console.error("Error fetching menu items for CSP:", error);
  }

  const combinedConnectSrc = [...defaultConnectSrc, ...Array.from(dynamicConnectSrcs)];

  function isHttpsRequest(req) {
    if (req.socket && req.socket.encrypted) return true;
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (typeof forwardedProto === 'string') {
      return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
    }
    if (Array.isArray(forwardedProto) && forwardedProto.length > 0) {
      return String(forwardedProto[0]).split(',')[0].trim().toLowerCase() === 'https';
    }
    return false;
  }

  function buildContentSecurityPolicy({ nonce }) {
    const extraConnectSrcSchemes = dev ? ['ws:', 'wss:'] : ['wss:'];
    const connectSrc = Array.from(new Set([...combinedConnectSrc, ...extraConnectSrcSchemes])).join(' ');

    const directives = [
      "default-src 'self'",
      `connect-src ${connectSrc}`,
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
      `style-src 'self' 'nonce-${nonce}'`,
      `img-src 'self' data: blob: https://placehold.co https://images.unsplash.com https://picsum.photos`,
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src 'none'",
      ...(!dev ? ['upgrade-insecure-requests', 'block-all-mixed-content'] : []),
    ];

    return directives.join('; ');
  }

  const httpServer = createServer(async (req, res) => {
    try {
      const maxRequestBodyBytes = Number(process.env.MAX_REQUEST_BODY_BYTES || 1024 * 1024);
      const method = String(req.method || 'GET').toUpperCase();
      const pathname = String(req.url || '/').split('?')[0] || '/';
      const hasBodyMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      const isApiRoute = pathname.startsWith('/api');
      const shouldLimitBody = hasBodyMethod && (isApiRoute || method === 'POST');
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
      if (origin && allowedOrigins.size && !allowedOrigins.has(origin)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }

      if (shouldLimitBody) {
        const contentLength = Number(req.headers['content-length'] || 0);
        if (Number.isFinite(contentLength) && contentLength > maxRequestBodyBytes) {
          res.statusCode = 413;
          res.end('Payload Too Large');
          return;
        }

        // If Content-Length is missing we cannot safely pre-consume the stream
        // without interfering with Next's request handling. We therefore only
        // enforce the maximum size when Content-Length is provided above.

        if (isApiRoute && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          const contentType = String(req.headers['content-type'] || '').toLowerCase();
          const isJson = contentType.includes('application/json');
          const isForm = contentType.includes('application/x-www-form-urlencoded');
          const isMultipart = contentType.includes('multipart/form-data');
          if (contentType && !isJson && !isForm && !isMultipart) {
            res.statusCode = 415;
            res.end('Unsupported Media Type');
            return;
          }
        }
      }

      const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
      const cspHeader = buildContentSecurityPolicy({ nonce });
      req.headers['x-nonce'] = nonce;
      req.headers['content-security-policy'] = cspHeader;
      res.setHeader('Content-Security-Policy', cspHeader);
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (!dev && isHttpsRequest(req)) {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
      }
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      // Remove X-Powered-By header (Express adds this by default)
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), fullscreen=(self)');
      if (isApiRoute) {
        res.setHeader('Cache-Control', 'no-store');
      }
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      if (res.writableEnded || res.headersSent) return;
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Attach Socket.io directly to the Next.js HTTP listener!
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (!allowedOrigins.size || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Forbidden'));
      },
      methods: ['GET', 'POST'] // Specify allowed methods
    }
  });

  io.on('connection', (socket) => {
    // 1. Connection Event
    socket.on('user_active', async (data) => {
      const { sessionId } = data;
      if (sessionId) {
        socket.sessionId = sessionId;

        // ZADD: Tracks exact timestamp they were last seen
        await redis.zadd('online_users', Date.now(), sessionId).catch(() => null);
        broadcastOnlineCount();
      }
    });

    // 2. Disconnect Event
    socket.on('disconnect', async () => {
      // We do not immediately delete their session ID because they might just be refreshing
      // or using multiple tabs. We let the Redis TTL handle true background purging!
      if (socket.sessionId) {
        socket.sessionId = null;
      }
    });
  });

  // 3. Background Validation Loop (TTL Implementation)
  // Scans Redis every 5 seconds, purges any IDs that haven't pinged in >20 seconds
  setInterval(() => {
    broadcastOnlineCount();
  }, 5000);

  async function broadcastOnlineCount() {
    try {
      if (redis.status !== 'ready') return;

      const twentySecondsAgo = Date.now() - 20000;
      // Removals (TTL)
      await redis.zremrangebyscore('online_users', '-inf', twentySecondsAgo);
      // Actual Online Count Calculation
      const count = await redis.zcount('online_users', '-inf', '+inf');

      // Instantly broadcast the accurate number to the entire network of Dashboard sockets!
      io.emit('online_count_updated', { count });
    } catch (err) {
      // Ignore background errors if redis is down
    }
  }

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Production-Grade Real-Time Engine Ready on http://${hostname}:${port}`);
    });
});

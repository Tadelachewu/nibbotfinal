const { createServer: createHttpServer } = require('http');
const { createServer: createHttpsServer } = require('https');
const { parse } = require('url');
const fs = require('fs');
const path = require('path');
const next = require('next');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const crypto = require('crypto');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = Number(process.env.PORT || (dev ? 9002 : 3024));

// Initialize Next.js engine directly from our custom wrapper
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const redisUrl = process.env.REDIS_URL;
let redis = null;
let redisReady = false;
if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1000),
      retryStrategy: () => null,
      reconnectOnError: () => false,
    });

    redis.on('ready', () => {
      redisReady = true;
      console.log('[Redis] Connected (presence tracking enabled).');
    });
    redis.on('end', () => {
      redisReady = false;
      console.warn('[Redis] Connection ended (presence tracking disabled).');
    });
    redis.on('error', (err) => {
      console.warn('[Redis] Connection warning. Presence tracking may be unavailable.', err?.message || err);
    });

    redis.connect().catch((err) => {
      redisReady = false;
      console.warn('[Redis] Disabled (could not connect). Online Now metric will be unavailable.', err?.message || err);
      try {
        redis.disconnect();
      } catch { }
      redis = null;
    });
  } catch (err) {
    redisReady = false;
    redis = null;
    console.warn('[Redis] Disabled (invalid configuration). Online Now metric will be unavailable.', err?.message || err);
  }
} else {
  console.log('[Redis] REDIS_URL not set. Presence tracking disabled.');
}
app.prepare().then(async () => {
  const defaultConnectSrc = ["'self'", "https://www.google.com"];
  if (dev) {
    defaultConnectSrc.push("http://localhost:3000", "http://localhost:3001");
  }

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

  function buildContentSecurityPolicy(nonce) {
    // Restrict connect-src to self, trusted APIs, and WebSockets.
    // Using a whitelist prevents XSS from exfiltrating data to arbitrary origins.
    const connectSrc = [
      "'self'",
      "https://www.google.com",
      "ws://localhost:9002",
      "ws://localhost:9004",
      "ws://127.0.0.1:9002",
      "ws://127.0.0.1:9004",
      "ws://localhost:3000",
      "ws://localhost:3001",
      "ws://127.0.0.1:3000",
      "ws://127.0.0.1:3001"
    ].join(' ');

    const scriptSrc = nonce ? `'self' 'nonce-${nonce}'` : "'self'";
    const styleSrc = nonce ? `'self' 'nonce-${nonce}'` : "'self'";

    const directives = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      `connect-src ${connectSrc}`,
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      "style-src-attr 'unsafe-inline'",
      `img-src 'self' blob: data: https://placehold.co https://images.unsplash.com https://picsum.photos`,
      "font-src 'self'",
      "frame-src 'none'",
      ...(!dev ? ['upgrade-insecure-requests', 'block-all-mixed-content'] : []),
    ];

    return directives.join('; ');
  }

  function buildSitemapContentSecurityPolicy() {
    return [
      "default-src 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
      "script-src 'none'",
      "style-src 'none'",
      "img-src 'none'",
      "font-src 'none'",
      "connect-src 'none'",
      "frame-src 'none'",
    ].join('; ');
  }

  // Tidy the directive string. In production we strip any 'unsafe-eval' tokens
  // for defense-in-depth; in development we allow 'unsafe-eval' to enable
  // React/Next dev debugging features (source maps / callstack reconstruction).
  function sanitizeCsp(header) {
    if (!header || typeof header !== 'string') return header;
    let directives = header
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)
      .map(dir => dir.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (!dev) {
      directives = directives
        .map(dir => dir.replace(/'unsafe-eval'/g, '').trim())
        .filter(Boolean);
    }

    return directives.join('; ');
  }

  const connectionsPerIp = new Map();

  // Hardened TLS configuration (Forward Secrecy AEAD ciphers only, no CBC, no static RSA)
  const tlsOptions = {
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-CHACHA20-POLY1305'
    ].join(':'),
    honorCipherOrder: true,
  };

  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslCertPath = process.env.SSL_CERT_PATH;
  let useHttps = false;
  let httpsOptions = {};

  if (sslKeyPath && sslCertPath) {
    try {
      httpsOptions = {
        ...tlsOptions,
        key: fs.readFileSync(path.resolve(sslKeyPath)),
        cert: fs.readFileSync(path.resolve(sslCertPath)),
      };
      useHttps = true;
      console.log('[Auth] SSL certificates loaded. Hardened TLS enabled.');
    } catch (err) {
      console.warn('[Auth] Failed to load SSL certificates. Falling back to HTTP.', err.message);
    }
  }

  const requestHandler = async (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

    // Simple connection limiting per IP (DoS protection)
    const currentConns = connectionsPerIp.get(ip) || 0;
    if (currentConns > 100) { // Limit to 100 concurrent requests per IP
      res.statusCode = 429;
      res.end('Too Many Requests');
      return;
    }
    connectionsPerIp.set(ip, currentConns + 1);

    res.on('finish', () => {
      const count = connectionsPerIp.get(ip) || 1;
      if (count <= 1) connectionsPerIp.delete(ip);
      else connectionsPerIp.set(ip, count - 1);
    });

    try {
      const maxRequestBodyBytes = Number(process.env.MAX_REQUEST_BODY_BYTES || 1024 * 1024);
      const method = String(req.method || 'GET').toUpperCase();
      const pathname = String(req.url || '/').split('?')[0] || '/';
      const hasBodyMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      const isApiRoute = pathname.startsWith('/api');
      const shouldLimitBody = hasBodyMethod && (isApiRoute || method === 'POST');
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
      const isDirectoryAccess = pathname !== '/' && pathname.endsWith('/');
      if (isDirectoryAccess) {
        // Explicitly block any directory access that isn't the root to prevent directory listing.
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
        res.setHeader('Access-Control-Max-Age', '86400');
      }
      if (method === 'OPTIONS' && origin) {
        res.statusCode = 204;
        res.end();
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

      // req.headers['content-security-policy'] = cspHeader;
      // req.headers['x-nonce'] = nonce;
      // res.setHeader('Content-Security-Policy', cspHeader);
      // res.setHeader('x-nonce', nonce);
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (!dev && isHttpsRequest(req)) {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
      }
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

      // req.nonce = nonce;
      if (pathname.startsWith('/_next/static/')) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Vary', 'Origin');
        // Prevent indexing of internal static assets (defense-in-depth)
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      // Remove X-Powered-By header (Express adds this by default)
      res.removeHeader('X-Powered-By');
      res.removeHeader('X-AspNet-Version');
      res.removeHeader('X-AspNetMvc-Version');
      res.removeHeader('X-AspNetCore-Version');
      res.removeHeader('Server');
      res.setHeader('Permissions-Policy', 'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), gamepad=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=()');
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
  };

  const httpServer = useHttps
    ? createHttpsServer(httpsOptions, requestHandler)
    : createHttpServer(requestHandler);

  // Attach Socket.io directly to the Next.js HTTP listener!
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        return callback(null, true);
      },
      methods: ['GET', 'POST'] // Specify allowed methods
    }
  });
  const applyEngineSecurityHeaders = (headers) => {
    headers['content-security-policy'] = sanitizeCsp(buildContentSecurityPolicy());
    headers['permissions-policy'] = 'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), gamepad=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=()';
    headers['x-content-type-options'] = 'nosniff';
    headers['x-frame-options'] = 'DENY';
    headers['x-permitted-cross-domain-policies'] = 'none';
    headers['cross-origin-embedder-policy'] = 'require-corp';
    headers['cross-origin-opener-policy'] = 'same-origin';
    headers['cross-origin-resource-policy'] = 'same-origin';
  };
  io.engine.on('initial_headers', (headers) => {
    applyEngineSecurityHeaders(headers);
  });
  io.engine.on('headers', (headers) => {
    applyEngineSecurityHeaders(headers);
  });

  io.on('connection', (socket) => {
    // 1. Connection Event
    socket.on('user_active', async (data) => {
      const { sessionId } = data;
      if (sessionId) {
        socket.sessionId = sessionId;

        // ZADD: Tracks exact timestamp they were last seen
        if (redis && redisReady) {
          await redis.zadd('online_users', Date.now(), sessionId).catch(() => null);
        }
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
      if (!redis || !redisReady) return;

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

  httpServer.headersTimeout = 20000; // Limit time to receive headers (Slowloris protection)
  httpServer.requestTimeout = 30000; // Limit time to receive full request (Slowloris protection)
  httpServer.keepAliveTimeout = 5000; // Close idle connections quickly

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      const modeLabel = dev ? 'Development' : 'Production';
      const protocol = useHttps ? 'https' : 'http';
      console.log(`> ${modeLabel} Real-Time Engine Ready on ${protocol}://${hostname}:${port}`);
    });
});

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const Redis = require('ioredis');
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

redis.on('error', (err) => {
  console.warn('[Redis] Connection warning. Make sure Redis is running locally or REDIS_URL is correctly set in .env', err.message);
});

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Attach Socket.io directly to the Next.js HTTP listener!
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    // 1. Connection Event
    socket.on('user_active', async (data) => {
      const { sessionId } = data;
      if (sessionId) {
        socket.sessionId = sessionId;
        
        // ZADD: Tracks exact timestamp they were last seen
        await redis.zadd('online_users', Date.now(), sessionId).catch(()=>null);
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

import Redis from 'ioredis';

type CounterState = {
  count: number;
  resetAtMs: number;
};

type RedisClient = InstanceType<typeof Redis>;

let redisClient: RedisClient | null | undefined;
const memoryCounters = new Map<string, CounterState>();
const memoryLocks = new Map<string, number>();

function nowMs() {
  return Date.now();
}

function normalizeIp(raw: string | null | undefined): string {
  const value = String(raw || '').trim();
  if (!value) return 'unknown';
  const first = value.split(',')[0]?.trim();
  if (!first) return 'unknown';
  if (first.toLowerCase() === 'unknown') return 'unknown';

  if (first.startsWith('[')) {
    const endBracket = first.indexOf(']');
    if (endBracket > 1) return first.slice(1, endBracket);
  }

  const ipv4Match = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/.exec(first);
  if (ipv4Match) return ipv4Match[1];

  return first;
}

function getRedisUrl() {
  const url = process.env.REDIS_URL;
  return typeof url === 'string' && url.trim().length > 0 ? url.trim() : null;
}

function getRedisClient(): RedisClient | null {
  if (redisClient !== undefined) return redisClient ?? null;
  const url = getRedisUrl();
  if (!url) {
    redisClient = null;
    return null;
  }
  try {
    const client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1000),
      retryStrategy: () => null,
      reconnectOnError: () => false,
    });
    redisClient = client;
    client.connect().catch(() => { });
    return client;
  } catch {
    redisClient = null;
    return null;
  }
}

function cleanMemory() {
  const now = nowMs();
  for (const [key, state] of memoryCounters) {
    if (state.resetAtMs <= now) memoryCounters.delete(key);
  }
  for (const [key, until] of memoryLocks) {
    if (until <= now) memoryLocks.delete(key);
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return normalizeIp(xff);
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return normalizeIp(realIp);
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return normalizeIp(cf);
  return 'unknown';
}

export function normalizePrincipal(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export async function enforceRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const key = params.key;
  const limit = Math.max(1, Math.floor(params.limit));
  const windowMs = Math.max(1000, Math.floor(params.windowMs));

  const redis = getRedisClient();
  if (redis) {
    try {
      const lua = `
local current = redis.call('INCR', KEYS[1])
if tonumber(current) == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;
      const res = (await redis.eval(lua, 1, key, String(windowMs))) as [number, number];
      const count = Number(res?.[0] ?? 0);
      const ttlMs = Number(res?.[1] ?? windowMs);
      if (count > limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil(Math.max(0, ttlMs) / 1000));
        return { ok: false, retryAfterSeconds };
      }
      return { ok: true };
    } catch {
      redisClient = null;
    }
  }

  cleanMemory();
  const now = nowMs();
  const existing = memoryCounters.get(key);
  if (!existing || existing.resetAtMs <= now) {
    memoryCounters.set(key, { count: 1, resetAtMs: now + windowMs });
    return { ok: true };
  }
  existing.count += 1;
  if (existing.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
    return { ok: false, retryAfterSeconds };
  }
  return { ok: true };
}

export type LockCheckResult =
  | { locked: false }
  | { locked: true; retryAfterSeconds: number };

export async function checkLock(key: string): Promise<LockCheckResult> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const ttlMs = await redis.pttl(key);
      if (typeof ttlMs === 'number' && ttlMs > 0) {
        return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)) };
      }
      return { locked: false };
    } catch {
      redisClient = null;
    }
  }

  cleanMemory();
  const until = memoryLocks.get(key);
  if (typeof until === 'number' && until > nowMs()) {
    return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((until - nowMs()) / 1000)) };
  }
  return { locked: false };
}

export async function setLock(key: string, ttlMs: number): Promise<void> {
  const durationMs = Math.max(1000, Math.floor(ttlMs));
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(key, '1', 'PX', durationMs);
      return;
    } catch {
      redisClient = null;
    }
  }

  cleanMemory();
  memoryLocks.set(key, nowMs() + durationMs);
}

export async function clearKey(key: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch {
      redisClient = null;
    }
  }
  memoryCounters.delete(key);
  memoryLocks.delete(key);
}

export async function incrementCounter(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }> {
  const window = Math.max(1000, Math.floor(windowMs));
  const redis = getRedisClient();
  if (redis) {
    try {
      const lua = `
local current = redis.call('INCR', KEYS[1])
if tonumber(current) == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;
      const res = (await redis.eval(lua, 1, key, String(window))) as [number, number];
      return { count: Number(res?.[0] ?? 0), ttlMs: Number(res?.[1] ?? window) };
    } catch {
      redisClient = null;
    }
  }

  cleanMemory();
  const now = nowMs();
  const existing = memoryCounters.get(key);
  if (!existing || existing.resetAtMs <= now) {
    const resetAtMs = now + window;
    memoryCounters.set(key, { count: 1, resetAtMs });
    return { count: 1, ttlMs: window };
  }
  existing.count += 1;
  return { count: existing.count, ttlMs: Math.max(0, existing.resetAtMs - now) };
}

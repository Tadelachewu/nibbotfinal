import crypto from 'crypto';

type RecoveryEntry = {
  username: string;
  expiresAt: number;
};

const store = new Map<string, RecoveryEntry>();

export function createRecoveryToken(username: string, ttlMs = 1000 * 60 * 60) {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + ttlMs;
  store.set(token, { username, expiresAt });
  return token;
}

export function verifyRecoveryToken(token: string) {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return null;
  }
  return entry.username;
}

export function invalidateRecoveryToken(token: string) {
  store.delete(token);
}

export function cleanupExpired() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= now) store.delete(k);
  }
}

// Periodic cleanup
setInterval(cleanupExpired, 1000 * 60 * 10);

export default { createRecoveryToken, verifyRecoveryToken, invalidateRecoveryToken };

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Persisted recovery tokens backed by the database for production.
export async function createRecoveryToken(username: string, ttlMs = 1000 * 60 * 60) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.adminRecoveryToken.create({ data: { token, username, expiresAt } });
  return token;
}

export async function verifyRecoveryToken(token: string) {
  const entry = await prisma.adminRecoveryToken.findUnique({ where: { token } });
  if (!entry) return null;
  if (entry.consumed) return null;
  if (new Date() > entry.expiresAt) {
    // expired - remove
    await prisma.adminRecoveryToken.deleteMany({ where: { token } }).catch(() => null);
    return null;
  }
  return entry.username;
}

export async function invalidateRecoveryToken(token: string) {
  await prisma.adminRecoveryToken.updateMany({ where: { token }, data: { consumed: true } }).catch(() => null);
}

export async function cleanupExpired() {
  const now = new Date();
  await prisma.adminRecoveryToken.deleteMany({ where: { expiresAt: { lte: now } } }).catch(() => null);
}

// Periodic cleanup (every 10 minutes)
setInterval(() => { cleanupExpired().catch(() => null); }, 1000 * 60 * 10);

export default { createRecoveryToken, verifyRecoveryToken, invalidateRecoveryToken };

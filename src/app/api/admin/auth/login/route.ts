import { NextResponse } from 'next/server';
import { comparePasswords, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

import { getAdminSession, isSameOriginRequest } from '@/lib/session';
import { logSecurityEvent } from '@/lib/logger';
import {
  checkLock,
  clearKey,
  enforceRateLimit,
  getClientIp,
  incrementCounter,
  normalizePrincipal,
  setLock,
} from '@/lib/rateLimit';

function isLocalhostRequest(req: Request) {
  try {
    const url = new URL(req.url);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function ensureInitialAdminExists(req: Request) {
  const adminCount = await prisma.adminCredential.count();
  if (adminCount > 0) return;

  const username = (process.env.ADMIN_INITIAL_USERNAME || process.env.ADMIN_USERNAME || 'admin').trim();
  const envPassword = process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD;

  // Security Hardening: Never use hardcoded fallback passwords.
  // The initial administrator password MUST be provided via environment variables.
  if (!envPassword || typeof envPassword !== 'string' || envPassword.length < 12) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[CRITICAL] ADMIN_INITIAL_PASSWORD must be set in production with at least 12 characters.');
    }
    console.warn('[Auth] Initial admin creation skipped: ADMIN_INITIAL_PASSWORD not set or too weak.');
    return;
  }

  const email = (process.env.ADMIN_EMAIL || 'admin@nib.local').trim().toLowerCase();
  const passwordHash = await hashPassword(envPassword);

  await prisma.adminCredential.upsert({
    where: { username },
    create: {
      username,
      email,
      passwordHash,
      role: 'admin',
      // Force the initial administrator to change their password on first login
      mustChangePassword: true,
      passwordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h TTL
    },
    update: {
      email,
      passwordHash,
      role: 'admin',
      mustChangePassword: true
    },
  });
  console.info(`[Auth] Initial administrator account created/updated: user=${username}`);
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!username || !password) {
    return NextResponse.json({ success: false, error: 'Username and password are required.' }, { status: 400 });
  }

  const ip = getClientIp(req);
  const principal = normalizePrincipal(username);
  const lockKey = `auth:admin:login:lock:${principal}`;
  const failuresKey = `auth:admin:login:fail:${principal}`;

  const lock = await checkLock(lockKey);
  if (lock.locked) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(lock.retryAfterSeconds));
    return res;
  }

  const ipLimit = await enforceRateLimit({
    key: `auth:admin:login:ip:${ip}`,
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(ipLimit.retryAfterSeconds));
    return res;
  }

  const principalLimit = await enforceRateLimit({
    key: `auth:admin:login:principal:${principal}:ip:${ip}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!principalLimit.ok) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(principalLimit.retryAfterSeconds));
    return res;
  }

  await ensureInitialAdminExists(req);

  const admin = await prisma.adminCredential.findUnique({ where: { username } });

  if (admin && (await comparePasswords(password, admin.passwordHash))) {
    // Check for password expiration (Slowloris protection: enforce credentials TTL)
    if (admin.passwordExpiresAt && new Date() > admin.passwordExpiresAt) {
      return NextResponse.json({
        success: false,
        error: 'Temporary password has expired. Please contact your administrator.'
      }, { status: 401 });
    }

    await clearKey(failuresKey);

    // Concurrent session control: increment version in DB to invalidate old sessions
    const updatedAdmin = await prisma.adminCredential.update({
      where: { username },
      data: { sessionVersion: { increment: 1 } },
      select: { role: true, sessionVersion: true, mustChangePassword: true }
    });

    const session = await getAdminSession();
    const now = Date.now();

    // Bind session to user identity and context
    session.username = username;
    session.role = updatedAdmin.role;
    session.sessionVersion = updatedAdmin.sessionVersion;
    session.ip = ip;
    session.userAgent = req.headers.get('user-agent') || 'unknown';

    session.createdAt = now;
    session.lastActivityAt = now;
    session.lastAuthAt = now;
    session.csrfToken = Buffer.from(crypto.randomUUID()).toString('base64');
    await session.save();

    // Audit Log: Successful Login
    await logSecurityEvent({
      actor: username,
      action: 'LOGIN_SUCCESS',
      target: `user:${username}`,
      ip,
      userAgent: req.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({
      success: true,
      username,
      role: admin.role,
      csrfToken: session.csrfToken,
      mustChangePassword: updatedAdmin.mustChangePassword
    });
  } else {
    const { count } = await incrementCounter(failuresKey, 15 * 60 * 1000);
    if (count >= 5) {
      await setLock(lockKey, 15 * 60 * 1000);
      await clearKey(failuresKey);

      // Audit Log: Account Lockout
      await logSecurityEvent({
        actor: username,
        action: 'LOGIN_LOCKOUT',
        target: `user:${username}`,
        details: { failureCount: count },
        ip,
        userAgent: req.headers.get('user-agent') || 'unknown'
      });

      const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
      res.headers.set('Retry-After', String(Math.max(1, Math.ceil((15 * 60 * 1000) / 1000))));
      return res;
    }
    return NextResponse.json({ success: false, error: 'Invalid username or password.' }, { status: 401 });
  }
}

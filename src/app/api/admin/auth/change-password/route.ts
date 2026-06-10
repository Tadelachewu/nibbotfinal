import { NextResponse } from 'next/server';
import { comparePasswords, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { getAdminSession, getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';

import { Prisma } from '@prisma/client';
import { checkLock, clearKey, enforceRateLimit, getClientIp, incrementCounter, normalizePrincipal, setLock } from '@/lib/rateLimit';
import { logSecurityEvent } from '@/lib/logger';

export async function POST(req: Request) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
  }

  const ip = getClientIp(req);
  const principal = normalizePrincipal(session.username);
  const lockKey = `auth:admin:change-password:lock:${principal}`;
  const failuresKey = `auth:admin:change-password:fail:${principal}`;

  const lock = await checkLock(lockKey);
  if (lock.locked) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(lock.retryAfterSeconds));
    return res;
  }

  const ipLimit = await enforceRateLimit({
    key: `auth:admin:change-password:ip:${ip}`,
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(ipLimit.retryAfterSeconds));
    return res;
  }

  const principalLimit = await enforceRateLimit({
    key: `auth:admin:change-password:principal:${principal}:ip:${ip}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!principalLimit.ok) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(principalLimit.retryAfterSeconds));
    return res;
  }

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newUsername = typeof body?.newUsername === 'string' ? body.newUsername.trim() : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
  const newEmail = typeof body?.email === 'string' && body.email.trim().length > 0 ? body.email.trim().toLowerCase() : undefined;

  if (!currentPassword || !newUsername || !newPassword) {
    return NextResponse.json(
      { success: false, error: 'currentPassword, newUsername, and newPassword are required.' },
      { status: 400 }
    );
  }

  const admin = await prisma.adminCredential.findUnique({ where: { username: session.username } });
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const emailRequired = admin.mustChangePassword === true;
  if (emailRequired && !newEmail) {
    return NextResponse.json(
      { success: false, error: 'Email is required during initial setup so password recovery works.' },
      { status: 400 }
    );
  }
  if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ success: false, error: 'Invalid email address.' }, { status: 400 });
  }

  const ok = await comparePasswords(currentPassword, admin.passwordHash);
  if (!ok) {
    const { count } = await incrementCounter(failuresKey, 15 * 60 * 1000);
    if (count >= 5) {
      await setLock(lockKey, 15 * 60 * 1000);
      await clearKey(failuresKey);
      const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
      res.headers.set('Retry-After', String(Math.max(1, Math.ceil((15 * 60 * 1000) / 1000))));
      return res;
    }
    return NextResponse.json({ success: false, error: 'Invalid current password.' }, { status: 401 });
  }

  await clearKey(failuresKey);
  const passwordHash = await hashPassword(newPassword);

  try {
    const data: any = {
      username: newUsername,
      passwordHash,
      // Invalidate all other sessions on password change
      sessionVersion: { increment: 1 },
      // Clear temporary password flags
      mustChangePassword: false,
      passwordExpiresAt: null
    };
    if (typeof newEmail === 'string') data.email = newEmail;

    const updated = await prisma.adminCredential.update({
      where: { username: session.username },
      data,
      select: { username: true, role: true, sessionVersion: true }
    });

    // Global Audit Log
    await logSecurityEvent({
      actor: session.username,
      action: 'CHANGE_PASSWORD',
      target: `user:${updated.username}`,
      details: { usernameChanged: session.username !== updated.username },
      ip: ip,
      userAgent: req.headers.get('user-agent') || 'unknown'
    });

    // Invalidate existing session and rotate identity to prevent token reuse
    session.destroy();
    await session.save();

    const newSession = await getAdminSession();
    newSession.username = updated.username;
    newSession.role = updated.role;
    newSession.sessionVersion = updated.sessionVersion;
    newSession.ip = ip;
    newSession.userAgent = req.headers.get('user-agent') || 'unknown';
    newSession.lastAuthAt = Date.now();
    newSession.lastActivityAt = newSession.lastAuthAt;
    newSession.createdAt = newSession.lastAuthAt;
    const nextToken = await rotateCsrfToken(newSession);
    const res = NextResponse.json({ success: true, username: updated.username });
    res.headers.set('x-csrf-token', nextToken);
    return res;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta as any)?.target;
      if (Array.isArray(target) && target.includes('email')) {
        return NextResponse.json({ success: false, error: 'Email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: 'Username already exists.' }, { status: 409 });
    }
    throw err;
  }
}

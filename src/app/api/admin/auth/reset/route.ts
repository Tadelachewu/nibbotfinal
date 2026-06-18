import { NextResponse } from 'next/server';
import { verifyRecoveryToken, invalidateRecoveryToken } from '@/lib/adminRecovery';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { validatePasswordFull } from '@/lib/passwordValidation';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = await enforceRateLimit({
    key: `auth:admin:reset:ip:${ip}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(ipLimit.retryAfterSeconds));
    return res;
  }

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!token || !newPassword) {
    return NextResponse.json({ success: false, error: 'token and newPassword are required.' }, { status: 400 });
  }

  // Validate new password is strong, not common, and not in breach databases
  const passwordValidation = await validatePasswordFull(newPassword);
  if (!passwordValidation.valid) {
    return NextResponse.json(
      { success: false, error: `Password requirements: ${passwordValidation.errors.join(', ')}` },
      { status: 400 }
    );
  }

  const tokenLimit = await enforceRateLimit({
    key: `auth:admin:reset:token:${token}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!tokenLimit.ok) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(tokenLimit.retryAfterSeconds));
    return res;
  }

  const username = await verifyRecoveryToken(token);
  if (!username) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.adminCredential.update({
    where: { username },
    data: {
      passwordHash,
      // Invalidate all active sessions on password reset
      sessionVersion: { increment: 1 },
      // Clear temporary password flags
      mustChangePassword: false,
      passwordExpiresAt: null
    }
  });

  await invalidateRecoveryToken(token);

  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = await enforceRateLimit({
    key: `auth:admin:confirm-email:ip:${ip}`,
    limit: 60,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(ipLimit.retryAfterSeconds));
    return res;
  }

  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Missing token.' }, { status: 400 });
  }

  const tokenLimit = await enforceRateLimit({
    key: `auth:admin:confirm-email:token:${token}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!tokenLimit.ok) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(tokenLimit.retryAfterSeconds));
    return res;
  }

  const change = await prisma.adminEmailChangeToken.findUnique({
    where: { token },
  });

  if (!change || change.consumed || change.expiresAt < new Date()) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token.' }, { status: 404 });
  }

  const existing = await prisma.adminCredential.findUnique({
    where: { email: change.newEmail },
    select: { id: true },
  });
  if (existing && existing.id !== change.adminId) {
    return NextResponse.json({ success: false, error: 'Email is already associated with another account.' }, { status: 409 });
  }

  const updated = await prisma.adminCredential.update({
    where: { id: change.adminId },
    data: { email: change.newEmail },
    select: { id: true, username: true, email: true },
  });

  await prisma.adminEmailChangeToken.update({
    where: { token },
    data: { consumed: true },
  });

  return NextResponse.json({
    success: true,
    email: updated.email,
    username: updated.username,
    message: 'Email ownership confirmed. Your account email has been updated.',
  });
}

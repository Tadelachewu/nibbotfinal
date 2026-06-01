import { NextResponse } from 'next/server';
import { verifyRecoveryToken } from '@/lib/adminRecovery';
import { getResetSession } from '@/lib/resetSession';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = await enforceRateLimit({
    key: `auth:admin:reset:consume:ip:${ip}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(ipLimit.retryAfterSeconds));
    return res;
  }

  const token = new URL(req.url).searchParams.get('token') || '';
  if (!token) {
    return NextResponse.json({ success: false, error: 'Recovery token is missing.' }, { status: 400 });
  }

  const username = await verifyRecoveryToken(token);
  if (!username) {
    return NextResponse.json({ success: false, error: 'Invalid or expired recovery link.' }, { status: 400 });
  }

  const session = await getResetSession();
  session.token = token;
  session.username = username;
  session.createdAt = Date.now();
  await session.save();

  return NextResponse.redirect(new URL('/reset', req.url));
}

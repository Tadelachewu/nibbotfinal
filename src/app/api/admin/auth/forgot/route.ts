import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRecoveryToken } from '@/lib/adminRecovery';
import { sendRecoveryEmail } from '@/lib/email';
import { enforceRateLimit, getClientIp, normalizePrincipal } from '@/lib/rateLimit';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = await enforceRateLimit({
    key: `auth:admin:forgot:ip:${ip}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    res.headers.set('Retry-After', String(ipLimit.retryAfterSeconds));
    return res;
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    return NextResponse.json({ success: false, error: 'Email is required.' }, { status: 400 });
  }

  const emailLimit = await enforceRateLimit({
    key: `auth:admin:forgot:email:${normalizePrincipal(email)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!emailLimit.ok) {
    const res = NextResponse.json({ success: true });
    res.headers.set('Retry-After', String(emailLimit.retryAfterSeconds));
    return res;
  }

  // Find admin by email (email is required on AdminCredential)
  const admin = await prisma.adminCredential.findUnique({ where: { email } });
  if (!admin) {
    // Do not reveal existence — return generic success
    return NextResponse.json({ success: true });
  }

  const token = await createRecoveryToken(admin.username);

  // Production behavior: send the token to the admin's email if available.
  // Do NOT return the token in the API response. Add logging to help debug
  // why emails may not be delivered during local development.
  try {
    console.info(`[admin/forgot] creating recovery token for user=${admin.username}`);
    const sendResult = await sendRecoveryEmail(admin.email, token, admin.username);
    if (sendResult?.previewUrl) {
      console.info('[admin/forgot] email preview URL available (development mode)');
    }
  } catch (err) {
    // Log the error but still return a generic success to avoid account probing.
    console.error('[admin/forgot] email send failed', err);
  }

  return NextResponse.json({ success: true });
}

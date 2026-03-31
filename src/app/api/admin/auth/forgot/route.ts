import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRecoveryToken } from '@/lib/adminRecovery';
import { sendRecoveryEmail } from '@/lib/email';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    return NextResponse.json({ success: false, error: 'Email is required.' }, { status: 400 });
  }

  // Find admin by email (email is required on AdminCredential)
  const admin = await prisma.adminCredential.findUnique({ where: { email } });
  if (!admin) {
    // Do not reveal existence — return generic success
    return NextResponse.json({ success: true });
  }

  const token = createRecoveryToken(admin.username);

  // Production behavior: send the token to the admin's email if available.
  // Do NOT return the token in the API response.
  try {
    // Send email to the admin's configured email address.
    await sendRecoveryEmail(admin.email, token, admin.username);
  } catch (err) {
    // Log the error but still return a generic success to avoid account probing.
    // eslint-disable-next-line no-console
    console.error('[admin/forgot] email send failed', err);
  }

  return NextResponse.json({ success: true });
}

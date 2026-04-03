import { NextResponse } from 'next/server';
import { verifyRecoveryToken, invalidateRecoveryToken } from '@/lib/adminRecovery';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!token || !newPassword) {
    return NextResponse.json({ success: false, error: 'token and newPassword are required.' }, { status: 400 });
  }

  const username = await verifyRecoveryToken(token);
  if (!username) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.adminCredential.update({ where: { username }, data: { passwordHash } });

  await invalidateRecoveryToken(token);

  return NextResponse.json({ success: true });
}

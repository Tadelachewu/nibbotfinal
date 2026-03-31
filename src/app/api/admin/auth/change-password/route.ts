import { NextResponse } from 'next/server';
import { comparePasswords, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';

import { Prisma } from '@prisma/client';

export async function POST(req: Request) {
  const session = await getValidatedAdminSession();
  if (!session?.username) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
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

  const ok = await comparePasswords(currentPassword, admin.passwordHash);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Invalid current password.' }, { status: 401 });
  }

  const passwordHash = await hashPassword(newPassword);

  try {
    const data: any = { username: newUsername, passwordHash };
    if (typeof newEmail === 'string') data.email = newEmail;

    const updated = await prisma.adminCredential.update({
      where: { username: session.username },
      data,
    });

    session.username = updated.username;
    session.lastAuthAt = Date.now();
    session.lastActivityAt = session.lastAuthAt;
    const nextToken = await rotateCsrfToken(session);
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

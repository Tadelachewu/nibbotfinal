import { NextResponse } from 'next/server';

import { getValidatedAdminSession, verifyCsrfToken } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getValidatedAdminSession(true);
  if (session && !verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
  }

  if (!session) {
    return NextResponse.json({ success: true });
  }

  if (session.username) {
    await prisma.adminCredential.update({
      where: { username: session.username },
      data: { sessionVersion: { increment: 1 } },
    }).catch(() => null);
  }

  session.destroy();
  try {
    await session.save();
  } catch { }

  const res = NextResponse.json({ success: true });
  res.headers.set('x-csrf-token', '');
  return res;
}

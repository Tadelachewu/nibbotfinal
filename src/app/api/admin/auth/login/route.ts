import { NextResponse } from 'next/server';
import { comparePasswords } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

import { getAdminSession, isSameOriginRequest } from '@/lib/session';

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

  const admin = await prisma.adminCredential.findUnique({ where: { username } });

  if (admin && (await comparePasswords(password, admin.passwordHash))) {
    const session = await getAdminSession();
    const now = Date.now();
    session.username = username;
    session.createdAt = now;
    session.lastActivityAt = now;
    session.lastAuthAt = now;
    session.csrfToken = Buffer.from(crypto.randomUUID()).toString('base64');
    await session.save();

    return NextResponse.json({ success: true, username, role: admin.role, csrfToken: session.csrfToken });
  } else {
    return NextResponse.json({ success: false, error: 'Invalid username or password.' }, { status: 401 });
  }
}

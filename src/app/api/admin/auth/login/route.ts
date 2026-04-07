import { NextResponse } from 'next/server';
import { comparePasswords, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

import { getAdminSession, isSameOriginRequest } from '@/lib/session';

function isLocalhostRequest(req: Request) {
  try {
    const url = new URL(req.url);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function ensureInitialAdminExists(req: Request) {
  const adminCount = await prisma.adminCredential.count();
  if (adminCount > 0) return;

  const username = (process.env.ADMIN_INITIAL_USERNAME || process.env.ADMIN_USERNAME || 'admin').trim();
  const envPassword = process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD;
  const password = typeof envPassword === 'string' && envPassword.length > 0
    ? envPassword
    : isLocalhostRequest(req)
      ? 'Admin@1234'
      : '';
  if (!password) return;

  const email = (process.env.ADMIN_EMAIL || 'admin@nib.local').trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  await prisma.adminCredential.upsert({
    where: { username },
    create: { username, email, passwordHash, role: 'admin' },
    update: { email, passwordHash, role: 'admin' },
  });
}

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

  await ensureInitialAdminExists(req);

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

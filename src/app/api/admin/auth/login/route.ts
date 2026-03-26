import { NextResponse } from 'next/server';
import { comparePasswords } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!username || !password) {
    return NextResponse.json({ success: false, error: 'Username and password are required.' }, { status: 400 });
  }

  const admin = await prisma.adminCredential.findUnique({ where: { username } });

  if (admin && (await comparePasswords(password, admin.passwordHash))) {
    const session = await getIronSession<{ username?: string }>(await cookies(), sessionOptions);
    session.username = username;
    await session.save();

    return NextResponse.json({ success: true, username });
  } else {
    return NextResponse.json({ success: false, error: 'Invalid username or password.' }, { status: 401 });
  }
}

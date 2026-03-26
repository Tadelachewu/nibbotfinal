import { NextResponse } from 'next/server';
import { comparePasswords, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';

import { Prisma } from '@prisma/client';

export async function POST(req: Request) {
  const session = await getIronSession<{ username?: string }>(await cookies(), sessionOptions);
  if (!session.username) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newUsername = typeof body?.newUsername === 'string' ? body.newUsername.trim() : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

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
    const updated = await prisma.adminCredential.update({
      where: { username: session.username },
      data: { username: newUsername, passwordHash },
    });

    session.username = updated.username;
    await session.save();

    return NextResponse.json({ success: true, username: updated.username });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Username already exists.' }, { status: 409 });
    }
    throw err;
  }
}

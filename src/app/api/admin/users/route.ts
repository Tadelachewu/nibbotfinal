import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';

function isStrongPassword(password: string): boolean {
  const p = String(password || '');
  if (p.length < 8) return false;
  if (!/[A-Z]/.test(p)) return false;
  if (!/[a-z]/.test(p)) return false;
  if (!/[0-9]/.test(p)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p)) return false;
  return true;
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export async function GET() {
  const session = await getValidatedAdminSession();
  if (!session?.username) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
  }

  const users = await prisma.adminCredential.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    success: true,
    data: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getValidatedAdminSession();
  if (!session?.username) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
  }

  const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const email = normalizeEmail(body?.email);
  const role = body?.role === 'checker' || body?.role === 'admin' || body?.role === 'support' ? body.role : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!username || !email || !role || !password) {
    return NextResponse.json(
      { success: false, error: 'username, email, role, and password are required.' },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: 'Invalid email address.' }, { status: 400 });
  }

  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { success: false, error: 'Password does not meet strength requirements.' },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const created = await prisma.adminCredential.create({
      data: {
        username,
        email,
        passwordHash,
        role,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    const nextToken = await rotateCsrfToken(session);
    const res = NextResponse.json({
      success: true,
      data: {
        id: created.id,
        username: created.username,
        email: created.email,
        role: created.role,
        createdAt: created.createdAt.toISOString(),
      },
    });
    res.headers.set('x-csrf-token', nextToken);
    return res;
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Username or email already exists.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}

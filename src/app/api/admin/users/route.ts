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

export async function PATCH(req: Request) {
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
  const id = typeof body?.id === 'number' ? body.id : Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, error: 'Valid user id is required.' }, { status: 400 });
  }

  const existing = await prisma.adminCredential.findUnique({
    where: { id },
    select: { id: true, username: true, role: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
  }
  if (existing.username === session.username) {
    return NextResponse.json(
      { success: false, error: 'Use the Credentials panel to update your own account.' },
      { status: 400 }
    );
  }

  const data: { username?: string; email?: string; role?: 'admin' | 'checker' | 'support'; passwordHash?: string } = {};

  if ('username' in (body || {})) {
    const nextUsername = typeof body?.username === 'string' ? body.username.trim() : '';
    if (!nextUsername) {
      return NextResponse.json({ success: false, error: 'Username cannot be empty.' }, { status: 400 });
    }
    data.username = nextUsername;
  }

  if ('email' in (body || {})) {
    const email = normalizeEmail(body?.email);
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email cannot be empty.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email address.' }, { status: 400 });
    }
    data.email = email;
  }

  if ('role' in (body || {})) {
    const role = body?.role === 'checker' || body?.role === 'admin' || body?.role === 'support' ? body.role : '';
    if (!role) {
      return NextResponse.json({ success: false, error: 'Invalid role.' }, { status: 400 });
    }
    data.role = role;
  }

  const password = typeof body?.password === 'string' ? body.password : '';
  if (password) {
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        { success: false, error: 'Password does not meet strength requirements.' },
        { status: 400 }
      );
    }
    data.passwordHash = await hashPassword(password);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: 'No changes provided.' }, { status: 400 });
  }

  try {
    const updated = await prisma.adminCredential.update({
      where: { id },
      data,
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });

    const nextToken = await rotateCsrfToken(session);
    const res = NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        createdAt: updated.createdAt.toISOString(),
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

export async function DELETE(req: Request) {
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
  const id = typeof body?.id === 'number' ? body.id : Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, error: 'Valid user id is required.' }, { status: 400 });
  }

  const target = await prisma.adminCredential.findUnique({
    where: { id },
    select: { id: true, username: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
  }
  if (target.username === session.username) {
    return NextResponse.json({ success: false, error: 'Cannot delete your own account.' }, { status: 400 });
  }
  if (target.role === 'admin') {
    const adminCount = await prisma.adminCredential.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      return NextResponse.json({ success: false, error: 'Cannot delete the last admin account.' }, { status: 400 });
    }
  }

  await prisma.adminCredential.delete({ where: { id } });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ success: true });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

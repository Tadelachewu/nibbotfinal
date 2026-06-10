import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';
import { logSecurityEvent } from '@/lib/logger';

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

function parsePageParams(searchParams: URLSearchParams) {
  const pageRaw = Number(searchParams.get('page') ?? '0');
  const pageSizeRaw = Number(searchParams.get('pageSize') ?? '50');
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
    ? Math.min(Math.floor(pageSizeRaw), 200)
    : 50;
  return { page, pageSize, skip: page * pageSize, take: pageSize };
}

export async function GET(req: Request) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get('q') ?? '').trim();
  const roleFilterRaw = String(searchParams.get('role') ?? '').trim();
  const roleFilter = roleFilterRaw === 'admin' || roleFilterRaw === 'checker' || roleFilterRaw === 'support'
    ? roleFilterRaw
    : null;
  const { page, pageSize, skip, take } = parsePageParams(searchParams);

  const where: any = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(q
      ? {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { groupName: { contains: q, mode: 'insensitive' } },
        ]
      }
      : {})
  };

  const [total, users] = await Promise.all([
    prisma.adminCredential.count({ where }),
    prisma.adminCredential.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        groupName: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasMore = page + 1 < totalPages;

  return NextResponse.json({
    success: true,
    meta: { page, pageSize, total, totalPages, hasMore },
    data: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      groupName: u.groupName ?? '',
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}

function generateRandomPassword(length = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let ret = "";
  // Ensure at least one of each required type for our strength checker
  ret += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  ret += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
  ret += "0123456789"[Math.floor(Math.random() * 10)];
  ret += "!@#$%^&*()_+"[Math.floor(Math.random() * 12)];

  for (let i = ret.length; i < length; i++) {
    ret += charset[Math.floor(Math.random() * charset.length)];
  }
  // Shuffle
  return ret.split('').sort(() => 0.5 - Math.random()).join('');
}

export async function POST(req: Request) {
  const session = await getValidatedAdminSession(true);
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
  const groupName = typeof body?.groupName === 'string' ? body.groupName.trim().slice(0, 80) : '';
  const role = body?.role === 'checker' || body?.role === 'admin' || body?.role === 'support' ? body.role : '';

  let password = typeof body?.password === 'string' ? body.password : '';
  let isGenerated = false;

  if (!username || !email || !role) {
    return NextResponse.json(
      { success: false, error: 'username, email, and role are required.' },
      { status: 400 }
    );
  }

  // If password is not provided or explicitly requested as random, generate one.
  // This prevents the "same default password for all" vulnerability.
  if (!password || body?.generatePassword === true) {
    password = generateRandomPassword();
    isGenerated = true;
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
        groupName: groupName || null,
        // Enforce temporary password expiration (24 hours) and mandatory change
        mustChangePassword: true,
        passwordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      select: {
        id: true,
        username: true,
        email: true,
        groupName: true,
        role: true,
        mustChangePassword: true,
        passwordExpiresAt: true,
        createdAt: true,
      },
    });

    // Audit Log: User Creation
    await logSecurityEvent({
      actor: session.username,
      action: 'CREATE_USER',
      target: `user:${username}`,
      details: { name: username, role, email, groupName },
      ip: session.ip,
      userAgent: session.userAgent
    });

    const nextToken = await rotateCsrfToken(session);
    const res = NextResponse.json({
      success: true,
      data: {
        id: created.id,
        username: created.username,
        email: created.email,
        groupName: created.groupName ?? '',
        role: created.role,
        mustChangePassword: created.mustChangePassword,
        passwordExpiresAt: created.passwordExpiresAt?.toISOString() ?? null,
        createdAt: created.createdAt.toISOString(),
        // Only return the password in the response if it was generated,
        // so the admin can provide it to the user.
        temporaryPassword: isGenerated ? password : undefined
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
  const session = await getValidatedAdminSession(true);
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

  const data: {
    username?: string;
    email?: string;
    role?: 'admin' | 'checker' | 'support';
    passwordHash?: string;
    groupName?: string | null;
    sessionVersion?: { increment: number };
    passwordExpiresAt?: null;
    mustChangePassword?: boolean;
  } = {};

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

  if ('groupName' in (body || {})) {
    const nextGroup = typeof body?.groupName === 'string' ? body.groupName.trim().slice(0, 80) : '';
    data.groupName = nextGroup ? nextGroup : null;
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
    // Invalidate sessions for this user if password is changed by admin
    data.sessionVersion = { increment: 1 };

    // RESET security flags: when an admin sets a password, it's no longer "expired"
    // and we don't necessarily force them to change it again if the admin just set it.
    data.passwordExpiresAt = null;
    data.mustChangePassword = false;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: 'No changes provided.' }, { status: 400 });
  }

  try {
    const updated = await prisma.adminCredential.update({
      where: { id },
      data,
      select: { id: true, username: true, email: true, groupName: true, role: true, createdAt: true },
    });

    // Audit Log: User Update
    await logSecurityEvent({
      actor: session.username,
      action: 'UPDATE_USER',
      target: `user:${updated.username}`,
      details: {
        name: updated.username,
        fieldsChanged: Object.keys(data).filter(k => k !== 'passwordHash' && k !== 'sessionVersion' && k !== 'passwordExpiresAt' && k !== 'mustChangePassword'),
        roleChanged: 'role' in data,
        passwordChanged: 'passwordHash' in data
      },
      ip: session.ip,
      userAgent: session.userAgent
    });

    const nextToken = await rotateCsrfToken(session);
    const res = NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        groupName: updated.groupName ?? '',
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
  const session = await getValidatedAdminSession(true);
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

  // Audit Log: User Deletion
  await logSecurityEvent({
    actor: session.username,
    action: 'DELETE_USER',
    target: `user:${target.username}`,
    details: { name: target.username, role: target.role },
    ip: session.ip,
    userAgent: session.userAgent
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ success: true });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

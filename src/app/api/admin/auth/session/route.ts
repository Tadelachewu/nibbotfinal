import { NextResponse } from 'next/server';
import { getValidatedAdminSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getValidatedAdminSession(true);
  if (!session) return NextResponse.json({ isAuthenticated: false });
  const admin = session.username
    ? await prisma.adminCredential.findUnique({ where: { username: session.username } })
    : null;
  if (!admin) return NextResponse.json({ isAuthenticated: false });
  return NextResponse.json({
    isAuthenticated: true,
    username: session.username,
    role: admin.role,
    csrfToken: session.csrfToken
  });
}

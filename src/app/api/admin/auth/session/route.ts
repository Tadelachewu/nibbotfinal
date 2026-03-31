import { NextResponse } from 'next/server';
import { getValidatedAdminSession } from '@/lib/session';

export async function GET() {
  const session = await getValidatedAdminSession();
  if (!session) return NextResponse.json({ isAuthenticated: false });
  return NextResponse.json({ isAuthenticated: true, username: session.username, csrfToken: session.csrfToken });
}

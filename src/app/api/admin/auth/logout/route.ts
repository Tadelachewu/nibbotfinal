import { NextResponse } from 'next/server';

import { getValidatedAdminSession, verifyCsrfToken } from '@/lib/session';

export async function POST(req: Request) {
  const session = await getValidatedAdminSession();
  if (session && !verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
  }

  if (!session) {
    return NextResponse.json({ success: true });
  }

  session.destroy();
  await session.save();

  const res = NextResponse.json({ success: true });
  res.headers.set('x-csrf-token', '');
  return res;
}

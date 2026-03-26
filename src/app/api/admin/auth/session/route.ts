import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await getIronSession<{ username?: string }>(await cookies(), sessionOptions);

  if (session.username) {
    return NextResponse.json({ isAuthenticated: true, username: session.username });
  } else {
    return NextResponse.json({ isAuthenticated: false });
  }
}

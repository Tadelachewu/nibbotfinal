import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body.sessionId !== 'string') {
            return NextResponse.json({ status: 'error', message: 'Invalid request' }, { status: 400 });
        }

        const cookieValue = encodeURIComponent(String(body.sessionId)).slice(0, 2048);
        const maxAge = 60 * 60 * 24 * 30; // 30 days
        const secure = process.env.NODE_ENV === 'production';

        const cookieHeader = `nib_session=${cookieValue}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
        return NextResponse.json({ status: 'success' }, { headers: { 'Set-Cookie': cookieHeader } });
    } catch (err) {
        console.error('session-cookie error', err?.message || err);
        return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 });
    }
}

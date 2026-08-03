import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CALLUS_URL = 'https://downloads-global.3cx.com/downloads/livechatandtalk/v1/callus.js';

export async function GET() {
    const res = await fetch(CALLUS_URL, { cache: 'no-store' });
    const body = await res.text().catch(() => '');

    const headers = new Headers();
    headers.set('Content-Type', res.headers.get('content-type') || 'application/javascript; charset=utf-8');
    headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');

    return new NextResponse(body, { status: res.ok ? 200 : 502, headers });
}


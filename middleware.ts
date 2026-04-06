import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const host = request.headers.get('host') || request.nextUrl.host
  const connectSrc = [
    "'self'",
    'https://www.google.com',
    ...(host ? [`ws://${host}`, `wss://${host}`] : []),
    'ws://localhost:9002',
    'ws://localhost:9004',
    'ws://127.0.0.1:9002',
    'ws://127.0.0.1:9004',
  ].join(' ')

  const cspHeader = `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
      style-src 'self' 'nonce-${nonce}' 'unsafe-inline';
      style-src-elem 'self' 'nonce-${nonce}';
      style-src-attr 'unsafe-inline';
      img-src 'self' blob: data: https://placehold.co https://images.unsplash.com https://picsum.photos;
      font-src 'self' data:;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      frame-src 'none';
      media-src 'self';
      connect-src ${connectSrc};
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set('Content-Security-Policy', cspHeader)

  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}

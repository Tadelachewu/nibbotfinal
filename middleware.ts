import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const host = request.headers.get('host') || request.nextUrl.host
  const isProd = process.env.NODE_ENV === 'production'
  const origin = request.headers.get('origin')
  const isCorsRequest = Boolean(origin)
  const connectSrc = [
    "'self'",
    'https://www.google.com',
    ...(host ? [`ws://${host}`, `wss://${host}`] : []),
    'ws://localhost:9002',
    'ws://localhost:9004',
    'ws://127.0.0.1:9002',
    'ws://127.0.0.1:9004',
  ].join(' ')

  const styleSrc = isProd
    ? `'self' 'nonce-${nonce}'`
    : `'self' 'nonce-${nonce}' 'unsafe-inline'`

  const styleSrcElem = isProd
    ? `'self' 'nonce-${nonce}' 'unsafe-inline'`
    : `'self' 'nonce-${nonce}' 'unsafe-inline'`

  const cspHeader = `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
      style-src ${styleSrc};
      style-src-elem ${styleSrcElem};
      style-src-attr 'unsafe-inline';
      img-src 'self' blob: data: https://placehold.co https://images.unsplash.com https://picsum.photos;
      font-src 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      frame-src 'none';
      media-src 'self';
      connect-src ${connectSrc};
      ${isProd ? 'upgrade-insecure-requests;' : ''}
    `.replace(/\s{2,}/g, ' ').trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const corsHeaders = new Headers()
  if (isCorsRequest && origin) {
    corsHeaders.set('Access-Control-Allow-Origin', origin)
    corsHeaders.set('Vary', 'Origin')
    corsHeaders.set('Access-Control-Allow-Credentials', 'true')
    corsHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    corsHeaders.set(
      'Access-Control-Allow-Headers',
      request.headers.get('access-control-request-headers') || '*'
    )
    corsHeaders.set('Access-Control-Max-Age', '86400')
  }

  if (request.method === 'OPTIONS' && isCorsRequest) {
    return new NextResponse(null, { status: 204, headers: corsHeaders })
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set('Content-Security-Policy', cspHeader)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Permissions-Policy', 'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), gamepad=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=()')
  response.headers.delete('X-Powered-By')
  response.headers.delete('X-AspNet-Version')
  response.headers.delete('X-AspNetMvc-Version')
  response.headers.delete('X-AspNetCore-Version')
  response.headers.delete('Server')
  corsHeaders.forEach((value, key) => response.headers.set(key, value))

  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store')
  }

  // Strict RBAC: Block legacy password change paths
  const legacyBlockedPaths = ['/admin-change-password', '/member-change-password'];
  if (legacyBlockedPaths.some(p => pathname.startsWith(p))) {
    return new NextResponse(null, { status: 404 });
  }

  // Strict RBAC: Protect /admin routes from forced browsing.
  // We allow /admin/login and /admin/reset as they are public entry points.
  // All other /admin paths require an active nib-admin-session cookie.
  // Unauthorized requests return 404 to hide the existence of the admin panel.
  if (pathname.startsWith('/admin') &&
    !pathname.startsWith('/admin/login') &&
    !pathname.startsWith('/admin/reset')) {
    const adminSession = request.cookies.get('nib-admin-session');
    if (!adminSession) {
      return new NextResponse(null, { status: 404 });
    }
  }

  if (isProd) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}

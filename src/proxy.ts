import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const host = request.headers.get('host') || request.nextUrl.host
  const isProd = process.env.NODE_ENV === 'production'
  const origin = request.headers.get('origin')
  const isCorsRequest = Boolean(origin)

  // Allowed origins for frame-ancestors
  const rawAncestors = process.env.ALLOWED_FRAME_ANCESTORS || ''
  const allowedAncestors = rawAncestors.split(/[,\s]+/).filter(Boolean)
  const frameAncestors = ["'self'", ...allowedAncestors].join(' ')

  const connectSrc = [
    "'self'",
    'https:',
    'http:',
    'blob:',
    'data:',
    ...(host ? [`ws://${host}`, `wss://${host}`] : []),
    'ws://localhost:9002',
    'ws://localhost:9004',
    'ws://127.0.0.1:9002',
    'ws://127.0.0.1:9004',
  ].join(' ')

  const styleSrc = `'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`

  const styleSrcElem = `'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`

  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline'`
    : `'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic'`

  const cspHeader = `
      default-src 'self';
      script-src ${scriptSrc};
      style-src ${styleSrc};
      style-src-elem ${styleSrcElem};
      style-src-attr 'unsafe-inline';
      img-src 'self' blob: data: https://* http://*;
      font-src 'self' data: https://fonts.gstatic.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors ${frameAncestors};
      frame-src 'self' https://*;
      media-src 'self' blob: data:;
      connect-src ${connectSrc};
      ${isProd ? 'upgrade-insecure-requests;' : ''}
    `.replace(/\s{2,}/g, ' ').trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const corsHeaders = new Headers()
  if (isCorsRequest && origin) {
    // If origin is allowed (for framing or general CORS)
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

  // If we have allowed ancestors and the origin matches, we can be more specific, 
  // but SAMEORIGIN is a safe fallback for X-Frame-Options when CSP is present.
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')

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
  // Unauthorized requests redirect to /login.
  if (pathname.startsWith('/admin')) {
    const adminSession = request.cookies.get('nib-admin-session');
    if (!adminSession) {
      return NextResponse.redirect(new URL('/login', request.url));
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
    '/admin/:path*',
    '/app-settings/:path*',
    '/uploads/:path*',
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}

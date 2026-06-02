import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isSameOriginRequest } from './lib/session'

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const host = request.headers.get('host') || request.nextUrl.host
  const isProd = process.env.NODE_ENV === 'production'
  const origin = request.headers.get('origin')
  const isCorsRequest = Boolean(origin)

  // Determine a safe Access-Control-Allow-Origin value.
  // Use the shared same-origin check to avoid duplicating allowed-origins logic.
  const allowedOrigin = isCorsRequest && origin && isSameOriginRequest(request) ? origin : ''

  // Allowed origins for frame-ancestors
  const rawAncestors = process.env.ALLOWED_FRAME_ANCESTORS || ''
  const allowedAncestors = rawAncestors.split(/[,\s]+/).filter(Boolean)
  const frameAncestors = ["'self'", ...allowedAncestors].join(' ')

  // Static/default connect-src entries
  const staticConnect = [
    "'self'",
    'blob:',
    'data:',

    'https://www.google.com',
    'https://fonts.gstatic.com',
    'https://placehold.co',
    'https://images.unsplash.com',
    'https://picsum.photos',
    ...(host ? [`ws://${host}`, `wss://${host}`] : []),
    'ws://localhost:9002',
    'ws://localhost:3020',
    'ws://127.0.0.1:9002',
    'wss://localhost:3020',
    'wss://nibterachatboat.nibbank.com.et'

  ]

  // Additional connect-src entries from environment (comma/space-separated)
  const extraConnectRaw = process.env.ALLOWED_CONNECT_SRC || ''
  const extraConnect = extraConnectRaw
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean)

  // Merge and dedupe while preserving order
  const connectSet = new Set<string>()
  for (const v of [...staticConnect, ...extraConnect]) connectSet.add(v)
  const connectSrc = Array.from(connectSet).join(' ')

  const styleSrc = `'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`

  const styleSrcElem = `'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`

  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`

  const cspHeader = `
      default-src 'self';
      script-src ${scriptSrc};
      style-src ${styleSrc};
      style-src-elem ${styleSrcElem};
      style-src-attr 'unsafe-inline';
      img-src 'self' blob: data: https://placehold.co https://images.unsplash.com https://picsum.photos;
      font-src 'self' data: https://fonts.gstatic.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors ${frameAncestors};
      frame-src 'self';
      media-src 'self' blob: data:;
      connect-src ${connectSrc};
      ${isProd ? 'upgrade-insecure-requests;' : ''}
    `.replace(/\s{2,}/g, ' ').trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const corsHeaders = new Headers()
  if (isCorsRequest && allowedOrigin) {
    corsHeaders.set('Access-Control-Allow-Origin', allowedOrigin)
    corsHeaders.set('Vary', 'Origin')
    corsHeaders.set('Access-Control-Allow-Credentials', 'true')
    corsHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, Accept, X-Requested-With')
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
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

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

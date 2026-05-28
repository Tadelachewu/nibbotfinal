import type { NextConfig } from 'next';

type NextConfigCompat = NextConfig & {
  typescript?: {
    ignoreBuildErrors?: boolean;
  };
  turbopack?: {
    root?: string;
  };
};

const appOrigin = process.env.APP_ORIGIN || 'http://localhost:9002';
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: https://placehold.co https://images.unsplash.com https://picsum.photos",
  "font-src 'self' data:",
  `connect-src 'self' https://www.google.com ${appOrigin}${process.env.NODE_ENV !== 'production' ? ' ws://localhost:9002 ws://127.0.0.1:9002 http://localhost:3000 http://localhost:3001' : ''}`,
  "frame-src 'self' https://www.google.com",
  ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests', 'block-all-mixed-content'] : []),
].join('; ');
const sitemapCspDirectives = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "script-src 'none'",
  "style-src 'none'",
  "img-src 'none'",
  "font-src 'none'",
  "connect-src 'none'",
  "frame-src 'none'",
].join('; ');

const nextConfig: NextConfigCompat = {
  /* config options here */
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          // { key: 'Content-Security-Policy', value: cspDirectives },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          ...(process.env.NODE_ENV === 'production'
            ? [
              {
                key: 'Strict-Transport-Security',
                value: 'max-age=63072000; includeSubDomains; preload',
              },
            ]
            : []),
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          // { key: 'Content-Security-Policy', value: cspDirectives },
          // X-Frame-Options removed to allow middleware to set frame-ancestors dynamically
          { key: 'Access-Control-Allow-Origin', value: appOrigin },
          { key: 'Vary', value: 'Origin' },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          // { key: 'Content-Security-Policy', value: sitemapCspDirectives },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

import crypto from 'crypto';
import type { IronSession, SessionOptions } from 'iron-session';
import { getIronSession } from 'iron-session';
import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';

export type AdminSessionData = {
  username?: string;
  role?: string;
  ip?: string;
  userAgent?: string;
  sessionVersion?: number;
  createdAt?: number;
  lastActivityAt?: number;
  lastAuthAt?: number;
  csrfToken?: string;
};

const idleMinutesRaw = Number(process.env.ADMIN_SESSION_IDLE_MINUTES || 15);
const idleMinutes = Number.isFinite(idleMinutesRaw) && idleMinutesRaw > 0 ? idleMinutesRaw : 15;
const idleSeconds = Math.floor(idleMinutes * 60);
const idleMs = idleSeconds * 1000;

// Absolute session lifetime limit (8 hours)
const absoluteLifetimeMs = 8 * 60 * 60 * 1000;

export const sessionOptions: SessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string,
  cookieName: 'nib-admin-session',
  ttl: idleSeconds,
  cookieOptions: {
    // In production, force Secure, HttpOnly, and SameSite=Strict for maximum protection.
    // In development, allow lax for easier debugging.
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: idleSeconds,
    path: '/',
  },
};

function normalizeIp(raw: string | null | undefined): string {
  const value = String(raw || '').trim();
  if (!value) return 'unknown';
  const first = value.split(',')[0]?.trim();
  if (!first) return 'unknown';
  if (first.toLowerCase() === 'unknown') return 'unknown';

  if (first.startsWith('[')) {
    const endBracket = first.indexOf(']');
    if (endBracket > 1) return first.slice(1, endBracket);
  }

  const ipv4Match = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/.exec(first);
  if (ipv4Match) return ipv4Match[1];

  return first;
}

export async function getAdminSession(): Promise<IronSession<AdminSessionData>> {
  return getIronSession<AdminSessionData>(await cookies(), sessionOptions);
}

async function destroySessionSafely(session: IronSession<AdminSessionData>) {
  session.destroy();
  try {
    await session.save();
  } catch (e) {
    console.warn('[Auth] Could not destroy session in this context', e instanceof Error ? e.message : e);
  }
}

export async function getValidatedAdminSession(allowMutations = true): Promise<IronSession<AdminSessionData> | null> {
  const session = await getAdminSession();
  if (!session.username) return null;

  const now = Date.now();
  const lastActivityAt = typeof session.lastActivityAt === 'number'
    ? session.lastActivityAt
    : typeof session.createdAt === 'number'
      ? session.createdAt
      : now;

  if (now - lastActivityAt > idleMs) {
    console.warn(`[Auth] Session idle timeout for user=${session.username}`);
    if (allowMutations) {
      await destroySessionSafely(session);
    }
    return null;
  }

  // Absolute session lifetime check (8 hours)
  const createdAt = typeof session.createdAt === 'number' ? session.createdAt : now;
  if (now - createdAt > absoluteLifetimeMs) {
    console.warn(`[Auth] Session absolute lifetime expired for user=${session.username}`);
    if (allowMutations) {
      await destroySessionSafely(session);
    }
    return null;
  }

  // Contextual binding check (IP and User-Agent)
  // We use headers() from next/headers which is available in Server Components/Actions/API Routes.
  const reqHeaders = await headers();
  const currentIp = normalizeIp(
    reqHeaders.get('x-forwarded-for') ||
    reqHeaders.get('x-real-ip') ||
    reqHeaders.get('cf-connecting-ip') ||
    'unknown'
  );
  const currentUserAgent = reqHeaders.get('user-agent') || 'unknown';
  const sessionIp = normalizeIp(session.ip);
  // Optional binding toggle: set ENABLE_SESSION_BINDING=false to disable strict IP/User-Agent binding.
  // This can help when legitimate client User-Agent or IP changes are expected (proxy/CDN, preview modes).
  const enforceBinding = process.env.ENABLE_SESSION_BINDING !== 'false';

  // If session was bound to an IP/UA and it changed, invalidate to prevent hijacking
  if (enforceBinding) {
    if (sessionIp !== 'unknown' && currentIp !== 'unknown' && sessionIp !== currentIp) {
      console.warn(`[Auth] Session IP mismatch. sessionIp=${session.ip} currentIp=${currentIp} user=${session.username}`);
      if (allowMutations) {
        await destroySessionSafely(session);
      }
      return null;
    }

    if (session.userAgent && session.userAgent !== 'unknown' && currentUserAgent !== 'unknown' && session.userAgent !== currentUserAgent) {
      console.warn(`[Auth] Session User-Agent mismatch for user=${session.username}`);
      if (allowMutations) {
        await destroySessionSafely(session);
      }
      return null;
    }
  }

  // Concurrent session control: check session version in DB
  // This allows invalidating all other sessions on login or password change.
  const admin = await prisma.adminCredential.findUnique({
    where: { username: session.username },
    select: { sessionVersion: true }
  });

  if (!admin || (typeof session.sessionVersion === 'number' && admin.sessionVersion !== session.sessionVersion)) {
    console.warn(`[Auth] Session version mismatch or user not found. user=${session.username}`);
    if (allowMutations) {
      await destroySessionSafely(session);
    }
    return null;
  }

  if (allowMutations) {
    if (typeof session.createdAt !== 'number') session.createdAt = now;
    session.lastActivityAt = now;
    if (typeof session.ip === 'string' && session.ip && session.ip !== sessionIp) {
      session.ip = sessionIp;
    }
    if (typeof session.csrfToken !== 'string' || !session.csrfToken) {
      session.csrfToken = Buffer.from(crypto.randomUUID()).toString('base64');
    }
    try {
      // Iron-session save() will attempt to write cookies.
      // This is allowed in API Route Handlers and Server Actions, but not in Server Components.
      await session.save();
    } catch (e) {
      // Log and continue if it's a cookie modification error.
      // This allows the function to be used in Server Components without crashing.
      console.warn('[Auth] Could not update session in this context', e instanceof Error ? e.message : e);
    }
  }

  return session;
}

export function isSameOriginRequest(req: Request): boolean {
  const requestUrl = new URL(req.url);
  const requestOrigin = requestUrl.origin;
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  const allowedOrigins = new Set<string>([requestOrigin]);
  if (process.env.NEXT_PUBLIC_SITE_URL) allowedOrigins.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
  if (process.env.APP_ORIGIN) allowedOrigins.add(new URL(process.env.APP_ORIGIN).origin);

  const envAllowed = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  for (const o of envAllowed) {
    try {
      allowedOrigins.add(new URL(o).origin);
    } catch {
      allowedOrigins.add(o);
    }
  }

  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProtoRaw = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedProto = forwardedProtoRaw === 'https' || forwardedProtoRaw === 'http' ? forwardedProtoRaw : undefined;

  const host = req.headers.get('host')?.split(',')[0]?.trim();
  const fallbackProto = forwardedProto ?? requestUrl.protocol.replace(':', '');

  if (forwardedHost) {
    allowedOrigins.add(`${fallbackProto}://${forwardedHost}`);
  }
  if (host) {
    allowedOrigins.add(`${fallbackProto}://${host}`);
  }

  if (origin) {
    const ok = allowedOrigins.has(origin);
    if (ok) return true;

    // Sometimes proxies or CDNs strip/replace the Origin header while preserving Host/X-Forwarded-Host.
    // Accept the request if the Host or X-Forwarded-Host (assembled as an origin) matches our allowed origins.
    const hostOrigin = host ? `${fallbackProto}://${host}` : undefined;
    const fwdOrigin = forwardedHost ? `${fallbackProto}://${forwardedHost}` : undefined;
    if ((hostOrigin && allowedOrigins.has(hostOrigin)) || (fwdOrigin && allowedOrigins.has(fwdOrigin))) {
      try {
        console.warn('[Auth] Origin header mismatch but host/forwarded-host matches allowed origins', {
          origin,
          hostOrigin,
          fwdOrigin,
          requestOrigin,
          referer,
          allowedOrigins: Array.from(allowedOrigins),
        });
      } catch { }
      return true;
    }

    try {
      console.warn('[Auth] Same-origin check failed', {
        origin,
        requestOrigin,
        referer,
        forwardedHost,
        forwardedProto,
        host,
        allowedOrigins: Array.from(allowedOrigins),
      });
    } catch (e) {
      // ignore logging errors
    }
    return false;
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      return allowedOrigins.has(refOrigin);
    } catch {
      return false;
    }
  }

  return false;
}

export function verifyCsrfToken(
  req: Request,
  session: IronSession<AdminSessionData> | null,
  options: { requireToken: boolean }
): boolean {
  const hasOriginOrReferer = Boolean(req.headers.get('origin') || req.headers.get('referer'));
  if (!options.requireToken) return isSameOriginRequest(req);
  if (hasOriginOrReferer && !isSameOriginRequest(req)) return false;
  const provided = req.headers.get('x-csrf-token');
  const expected = session?.csrfToken;
  return Boolean(provided && expected && provided === expected);
}

export async function rotateCsrfToken(session: IronSession<AdminSessionData>): Promise<string> {
  const previous = typeof session.csrfToken === 'string' ? session.csrfToken : '';
  const next = Buffer.from(crypto.randomUUID()).toString('base64');
  session.csrfToken = next;
  try {
    await session.save();
    return next;
  } catch (e) {
    session.csrfToken = previous;
    console.warn('[Auth] Could not rotate CSRF token', e instanceof Error ? e.message : e);
    return previous || next;
  }
}

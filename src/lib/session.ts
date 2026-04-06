import crypto from 'crypto';
import type { IronSession, SessionOptions } from 'iron-session';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export type AdminSessionData = {
  username?: string;
  createdAt?: number;
  lastActivityAt?: number;
  lastAuthAt?: number;
  csrfToken?: string;
};

const idleMinutesRaw = Number(process.env.ADMIN_SESSION_IDLE_MINUTES || 15);
const idleMinutes = Number.isFinite(idleMinutesRaw) && idleMinutesRaw > 0 ? idleMinutesRaw : 15;
const idleSeconds = Math.floor(idleMinutes * 60);
const idleMs = idleSeconds * 1000;

export const sessionOptions: SessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string,
  cookieName: 'nib-admin-session',
  ttl: idleSeconds,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: idleSeconds,
  },
};

export async function getAdminSession(): Promise<IronSession<AdminSessionData>> {
  return getIronSession<AdminSessionData>(await cookies(), sessionOptions);
}

export async function getValidatedAdminSession(): Promise<IronSession<AdminSessionData> | null> {
  const session = await getAdminSession();
  if (!session.username) return null;

  const now = Date.now();
  const lastActivityAt = typeof session.lastActivityAt === 'number'
    ? session.lastActivityAt
    : typeof session.createdAt === 'number'
      ? session.createdAt
      : now;

  if (now - lastActivityAt > idleMs) {
    session.destroy();
    await session.save();
    return null;
  }

  if (typeof session.createdAt !== 'number') session.createdAt = now;
  session.lastActivityAt = now;
  if (typeof session.csrfToken !== 'string' || !session.csrfToken) {
    session.csrfToken = Buffer.from(crypto.randomUUID()).toString('base64');
  }
  await session.save();

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
    if (!ok) {
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
    }
    return ok;
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
  session.csrfToken = Buffer.from(crypto.randomUUID()).toString('base64');
  await session.save();
  return session.csrfToken;
}

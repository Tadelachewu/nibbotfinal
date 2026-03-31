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
  const requestOrigin = new URL(req.url).origin;
  const origin = req.headers.get('origin');
  if (origin) return origin === requestOrigin;

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === requestOrigin;
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

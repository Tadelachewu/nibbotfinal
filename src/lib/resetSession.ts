import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { IronSession, SessionOptions } from 'iron-session';
import { sessionOptions } from './session';

export type ResetSessionData = {
    token?: string;
    username?: string;
    createdAt?: number;
};

export const resetSessionOptions: SessionOptions = {
    ...sessionOptions,
    cookieName: 'nib-admin-reset',
    ttl: 10 * 60,
    cookieOptions: {
        ...sessionOptions.cookieOptions,
        path: '/api/admin/auth/reset',
        maxAge: 10 * 60,
    },
};

export async function getResetSession(): Promise<IronSession<ResetSessionData>> {
    return getIronSession<ResetSessionData>(await cookies(), resetSessionOptions);
}

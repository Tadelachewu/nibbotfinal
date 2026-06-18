import { NextResponse } from 'next/server';
import { getResetSession } from '@/lib/resetSession';
import { verifyRecoveryToken, invalidateRecoveryToken } from '@/lib/adminRecovery';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { validatePasswordFull } from '@/lib/passwordValidation';

export async function POST(req: Request) {
    const ip = getClientIp(req);
    const ipLimit = await enforceRateLimit({
        key: `auth:admin:reset:confirm:ip:${ip}`,
        limit: 20,
        windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.ok) {
        const res = NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
        res.headers.set('Retry-After', String(ipLimit.retryAfterSeconds));
        return res;
    }

    const body = await req.json().catch(() => null);
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    if (!newPassword) {
        return NextResponse.json({ success: false, error: 'newPassword is required.' }, { status: 400 });
    }

    const passwordValidation = await validatePasswordFull(newPassword);
    if (!passwordValidation.valid) {
        return NextResponse.json(
            { success: false, error: `Password requirements: ${passwordValidation.errors.join(', ')}` },
            { status: 400 }
        );
    }

    const resetSession = await getResetSession();
    const token = resetSession.token;
    const username = resetSession.username;

    if (!token || !username) {
        if (resetSession) {
            resetSession.destroy();
            await resetSession.save();
        }
        return NextResponse.json({ success: false, error: 'Reset session missing or expired.' }, { status: 401 });
    }

    const validUsername = await verifyRecoveryToken(token);
    if (!validUsername || validUsername !== username) {
        resetSession.destroy();
        await resetSession.save();
        return NextResponse.json({ success: false, error: 'Invalid or expired recovery session.' }, { status: 401 });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.adminCredential.update({
        where: { username },
        data: {
            passwordHash,
            sessionVersion: { increment: 1 },
            mustChangePassword: false,
            passwordExpiresAt: null,
        },
    });

    await invalidateRecoveryToken(token);
    resetSession.destroy();
    await resetSession.save();

    return NextResponse.json({ success: true });
}

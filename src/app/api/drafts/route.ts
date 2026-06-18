import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getValidatedAdminSession } from '@/lib/session';

function getDraftClient() {
    const draftClient = (prisma as any)?.draft;
    const ok =
        draftClient &&
        typeof draftClient.findMany === 'function' &&
        typeof draftClient.upsert === 'function' &&
        typeof draftClient.deleteMany === 'function';
    return ok ? draftClient : null;
}

export async function GET(req: NextRequest) {
    try {
        const session = await getValidatedAdminSession();
        if (!session?.username) {
            return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
        }

        const draftClient = getDraftClient();
        if (!draftClient) {
            return NextResponse.json(
                { status: 'error', message: 'Drafts storage is not available on this server. Run "npx prisma generate" and restart the server.' },
                { status: 500 }
            );
        }

        const { searchParams } = new URL(req.url);
        const entityType = searchParams.get('entityType');

        if (!entityType) {
            return NextResponse.json({ status: 'error', message: 'entityType is required' }, { status: 400 });
        }

        const drafts = await draftClient.findMany({
            where: {
                createdBy: session.username,
                entityType
            },
            orderBy: { updatedAt: 'desc' }
        });

        return NextResponse.json({ status: 'success', data: drafts });
    } catch (error) {
        console.error('[Drafts GET Error]:', error);
        return NextResponse.json({ status: 'error', message: 'Failed to fetch drafts' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getValidatedAdminSession();
        if (!session?.username) {
            return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
        }

        const draftClient = getDraftClient();
        if (!draftClient) {
            return NextResponse.json(
                { status: 'error', message: 'Drafts storage is not available on this server. Run "npx prisma generate" and restart the server.' },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { entityType, entityId, data } = body;

        if (!entityType || !entityId || !data) {
            return NextResponse.json({ status: 'error', message: 'entityType, entityId, and data are required' }, { status: 400 });
        }

        const draft = await draftClient.upsert({
            where: {
                entityType_entityId_createdBy: {
                    entityType,
                    entityId,
                    createdBy: session.username
                }
            },
            update: { data },
            create: {
                entityType,
                entityId,
                createdBy: session.username,
                data
            }
        });

        return NextResponse.json({ status: 'success', data: draft });
    } catch (error) {
        console.error('[Drafts POST Error]:', error);
        return NextResponse.json({ status: 'error', message: 'Failed to save draft' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getValidatedAdminSession();
        if (!session?.username) {
            return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
        }

        const draftClient = getDraftClient();
        if (!draftClient) {
            return NextResponse.json(
                { status: 'error', message: 'Drafts storage is not available on this server. Run "npx prisma generate" and restart the server.' },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { entityType, entityId } = body;

        if (!entityType || !entityId) {
            return NextResponse.json({ status: 'error', message: 'entityType and entityId are required' }, { status: 400 });
        }

        await draftClient.deleteMany({
            where: {
                entityType,
                entityId,
                createdBy: session.username
            }
        });

        return NextResponse.json({ status: 'success' });
    } catch (error) {
        console.error('[Drafts DELETE Error]:', error);
        return NextResponse.json({ status: 'error', message: 'Failed to delete draft' }, { status: 500 });
    }
}

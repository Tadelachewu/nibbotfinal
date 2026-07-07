import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession } from '@/lib/session';
import { indexArticle, deleteArticleChunks } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const data: Record<string, unknown> = {};
  if (typeof body?.title   === 'string')  data.title   = body.title.trim();
  if (typeof body?.body    === 'string')  data.body    = body.body.trim();
  if (typeof body?.titleAm === 'string' || body?.titleAm === null) data.titleAm = body.titleAm?.trim() || null;
  if (typeof body?.bodyAm  === 'string' || body?.bodyAm  === null) data.bodyAm  = body.bodyAm?.trim()  || null;
  if (body?.translations && typeof body.translations === 'object') data.translations = body.translations;
  if (typeof body?.enabled === 'boolean') data.enabled = body.enabled;

  const article = await prisma.kBArticle.update({
    where: { id },
    data,
  }).catch(() => null);

  if (!article) {
    return NextResponse.json({ status: 'error', message: 'Article not found.' }, { status: 404 });
  }

  indexArticle(article.id).catch(err => console.error('[KB] article index error:', err));

  return NextResponse.json({ status: 'success', data: article });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  await deleteArticleChunks(id);
  await prisma.kBArticle.delete({ where: { id } }).catch(() => null);

  return NextResponse.json({ status: 'success' });
}

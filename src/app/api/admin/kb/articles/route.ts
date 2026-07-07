import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession } from '@/lib/session';
import { indexArticle } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const articles = await prisma.kBArticle.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { chunks: true } } },
  });

  return NextResponse.json({
    status: 'success',
    data: articles.map(a => ({
      id:           a.id,
      title:        a.title,
      body:         a.body,
      titleAm:      a.titleAm,
      bodyAm:       a.bodyAm,
      translations: a.translations,
      enabled:      a.enabled,
      createdBy:    a.createdBy,
      createdAt:    a.createdAt.toISOString(),
      updatedAt:    a.updatedAt.toISOString(),
      chunkCount:   a._count.chunks,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const articleBody = typeof body?.body === 'string' ? body.body.trim() : '';
  const titleAm = typeof body?.titleAm === 'string' ? body.titleAm.trim() : null;
  const bodyAm  = typeof body?.bodyAm  === 'string' ? body.bodyAm.trim()  : null;
  const translations = body?.translations && typeof body.translations === 'object' ? body.translations : undefined;
  const enabled = typeof body?.enabled === 'boolean' ? body.enabled : true;

  if (!title) {
    return NextResponse.json({ status: 'error', message: 'Title is required.' }, { status: 400 });
  }

  const article = await prisma.kBArticle.create({
    data: { title, body: articleBody, titleAm, bodyAm, translations, enabled, createdBy: session.username ?? null },
  });

  indexArticle(article.id).catch(err => console.error('[KB] article index error:', err));

  return NextResponse.json({ status: 'success', data: article }, { status: 201 });
}

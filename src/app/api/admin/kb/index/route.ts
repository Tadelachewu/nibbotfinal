import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession } from '@/lib/session';
import { indexMenu, deleteMenuChunks, indexArticle, deleteArticleChunks } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const articleId = typeof body?.articleId === 'string' ? body.articleId.trim() : '';
  const menuId    = typeof body?.menuId    === 'string' ? body.menuId.trim()    : '';

  if (articleId) {
    const article = await prisma.kBArticle.findUnique({ where: { id: articleId }, select: { id: true } });
    if (!article) {
      return NextResponse.json({ status: 'error', message: 'Article not found.' }, { status: 404 });
    }
    try {
      await indexArticle(articleId);
      const count = await prisma.kBChunk.count({ where: { articleId } });
      return NextResponse.json({ status: 'success', data: { articleId, chunksCreated: count } });
    } catch (err: any) {
      console.error('[KB index article]', err);
      return NextResponse.json({ status: 'error', message: 'Indexing failed. Check Ollama connectivity.' }, { status: 503 });
    }
  }

  if (!menuId) {
    return NextResponse.json({ status: 'error', message: 'menuId or articleId is required.' }, { status: 400 });
  }

  const menu = await prisma.menuItem.findUnique({ where: { id: menuId }, select: { id: true } });
  if (!menu) {
    return NextResponse.json({ status: 'error', message: 'Menu not found.' }, { status: 404 });
  }

  try {
    await indexMenu(menuId, true);
    const count = await prisma.kBChunk.count({ where: { menuId } });
    return NextResponse.json({ status: 'success', data: { menuId, chunksCreated: count } });
  } catch (err: any) {
    console.error('[KB index]', err);
    return NextResponse.json({ status: 'error', message: 'Indexing failed. Check Ollama connectivity.' }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const menuId    = searchParams.get('menuId')?.trim()    ?? '';
  const articleId = searchParams.get('articleId')?.trim() ?? '';

  if (articleId) {
    await deleteArticleChunks(articleId);
    return NextResponse.json({ status: 'success' });
  }

  if (!menuId) {
    return NextResponse.json({ status: 'error', message: 'menuId or articleId query param is required.' }, { status: 400 });
  }

  await deleteMenuChunks(menuId);
  return NextResponse.json({ status: 'success' });
}

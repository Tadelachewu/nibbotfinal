import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyCsrfToken } from '@/lib/session';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!verifyCsrfToken(req, null, { requireToken: false })) {
      return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
    }

    const { id: menuId } = await ctx.params;
    const body = await req.json().catch(() => null);
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';

    if (!sessionId) {
      return NextResponse.json({ status: 'error', message: 'sessionId is required.' }, { status: 400 });
    }

    const menu = await prisma.menuItem.findUnique({ where: { id: menuId } });
    if (!menu) {
      return NextResponse.json({ status: 'error', message: 'Menu not found.' }, { status: 404 });
    }

    if (!menu.trackClicks) {
      return NextResponse.json({ status: 'success', data: { clickCount: menu.clickCount, sessionClickCount: menu.sessionClickCount } });
    }

    const alreadyClicked = await prisma.clickHistory.findFirst({ where: { menuId, sessionId } });

    await prisma.menuItem.update({
      where: { id: menuId },
      data: {
        clickCount: { increment: 1 },
        ...(alreadyClicked ? {} : { sessionClickCount: { increment: 1 } })
      }
    });

    if (!alreadyClicked) {
      await prisma.clickHistory.create({ data: { menuId, sessionId } });
    }

    const updated = await prisma.menuItem.findUnique({ where: { id: menuId } });
    return NextResponse.json({
      status: 'success',
      data: { clickCount: updated?.clickCount ?? 0, sessionClickCount: updated?.sessionClickCount ?? 0 }
    });
  } catch (err) {
    console.error('/api/menus/[id]/click error', err && err.stack ? err.stack : err?.message || err);
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 });
  }
}


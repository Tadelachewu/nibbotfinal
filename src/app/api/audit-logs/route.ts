import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parsePageParams(searchParams: URLSearchParams) {
  const pageRaw = Number(searchParams.get('page') ?? '0');
  const pageSizeRaw = Number(searchParams.get('pageSize') ?? '50');
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
    ? Math.min(Math.floor(pageSizeRaw), 200)
    : 50;
  return { page, pageSize, skip: page * pageSize, take: pageSize };
}

export async function GET(req: Request) {
  try {
    const session = await getValidatedAdminSession(true);
    if (!session?.username) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
    }

    // Only admins can view audit logs
    const actor = await prisma.adminCredential.findUnique({
      where: { username: session.username },
      select: { role: true },
    });

    if (actor?.role !== 'admin') {
      return NextResponse.json({ status: 'error', message: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get('q') ?? '').trim();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const { page, pageSize, skip, take } = parsePageParams(searchParams);

    const where: any = {};

    if (q) {
      where.OR = [
        { actor: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { target: { contains: q, mode: 'insensitive' } },
        { details: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (startDate) {
      where.timestamp = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.timestamp = { ...where.timestamp, lte: new Date(endDate) };
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take
      })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const hasMore = page + 1 < totalPages;

    return NextResponse.json({
      status: 'success',
      meta: { page, pageSize, total, totalPages, hasMore },
      data: logs.map(l => ({
        id: l.id,
        timestamp: l.timestamp.toISOString(),
        actor: l.actor,
        action: l.action,
        target: l.target,
        details: l.details,
        ip: l.ip,
        userAgent: l.userAgent
      }))
    });
  } catch (err: any) {
    console.error('GET /api/audit-logs error', err?.message || err);
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 });
  }
}

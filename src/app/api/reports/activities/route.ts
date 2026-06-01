import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parsePageParams(searchParams: URLSearchParams) {
  const pageRaw = Number(searchParams.get('page') ?? '0');
  const pageSizeRaw = Number(searchParams.get('pageSize') ?? '100');
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
    ? Math.min(Math.floor(pageSizeRaw), 500)
    : 100;
  return { page, pageSize, skip: page * pageSize, take: pageSize };
}

export async function GET(req: Request) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const actor = await prisma.adminCredential.findUnique({
    where: { username: session.username },
    select: { role: true }
  });

  if (!actor || (actor.role !== 'admin' && actor.role !== 'support')) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawReportId = searchParams.get('reportId');
  const reportId = typeof rawReportId === 'string' && rawReportId.trim() && /^[A-Za-z0-9-]+$/.test(rawReportId.trim())
    ? rawReportId.trim()
    : null;
  const { page, pageSize, skip, take } = parsePageParams(searchParams);

  // Horizontal RBAC (IDOR): Support users can only see activities for reports assigned to them.
  if (actor.role === 'support' && reportId) {
    const report = await prisma.userReport.findUnique({
      where: { id: reportId },
      select: { supportAssignee: true }
    });
    if (!report || report.supportAssignee !== session.username) {
      return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
    }
  }

  const where: any = {
    AND: [
      reportId ? { reportId } : {},
      actor.role === 'support' ? { report: { supportAssignee: session.username } } : {}
    ]
  };

  const [total, activities] = await Promise.all([
    prisma.reportActivity.count({ where }),
    prisma.reportActivity.findMany({
      where,
      include: {
        report: {
          select: {
            menuName: true
          }
        }
      },
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
    data: activities.map(a => ({
      id: a.id,
      reportId: a.reportId,
      menuName: a.report.menuName,
      type: a.type,
      actor: a.actor,
      target: a.target ?? undefined,
      content: a.content ?? undefined,
      timestamp: a.timestamp.toISOString()
    }))
  });
}

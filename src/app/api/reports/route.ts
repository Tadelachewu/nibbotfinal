import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

import { getValidatedAdminSession, verifyCsrfToken } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parsePageParams(searchParams: URLSearchParams) {
  const pageRaw = Number(searchParams.get('page') ?? '0');
  const pageSizeRaw = Number(searchParams.get('pageSize') ?? '50');
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
    ? Math.min(Math.floor(pageSizeRaw), 500)
    : 50;
  return { page, pageSize, skip: page * pageSize, take: pageSize };
}

function parseSequenceFromReportId(id: string): number | null {
  const parts = id.split('-');
  const lastPart = parts[parts.length - 1];
  const n = parseInt(lastPart, 10);
  return Number.isFinite(n) ? n : null;
}

function generateReportId(config: {
  prefix: string;
  yearEnabled: boolean;
  numberLength: number;
  startValue: number;
  resetEveryYear: boolean;
}, sequence: number) {
  const year = new Date().getFullYear();
  const yearPart = config.yearEnabled ? `-${year}` : '';
  const numberPart = String(sequence).padStart(config.numberLength, '0');
  return `${config.prefix}${yearPart}-${numberPart}`;
}

async function getReportConfig() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 1 },
    include: { reportId: true }
  });

  if (!settings?.reportId) {
    return { prefix: 'NIB', yearEnabled: true, numberLength: 6, startValue: 100000, resetEveryYear: true };
  }

  return {
    prefix: settings.reportId.prefix,
    yearEnabled: settings.reportId.yearEnabled,
    numberLength: settings.reportId.numberLength,
    startValue: settings.reportId.startValue,
    resetEveryYear: settings.reportId.resetEveryYear
  };
}

export async function GET(req: Request) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
  const role = actor?.role ?? null;
  if (role !== 'admin' && role !== 'support') {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get('q') ?? '').trim();
  const statusRaw = String(searchParams.get('status') ?? '').trim();
  const priorityRaw = String(searchParams.get('priority') ?? '').trim();
  const { page, pageSize, skip, take } = parsePageParams(searchParams);

  const whereBase: any = role === 'support' ? { supportAssignee: session.username } : {};
  const status = statusRaw === 'pending' || statusRaw === 'reviewed' || statusRaw === 'resolved' ? statusRaw : null;
  const priority = priorityRaw === 'low' || priorityRaw === 'medium' || priorityRaw === 'high' || priorityRaw === 'urgent' ? priorityRaw : null;

  const where: any = {
    ...whereBase,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(q
      ? {
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { menuName: { contains: q, mode: 'insensitive' } },
          { userId: { contains: q, mode: 'insensitive' } },
        ]
      }
      : {})
  };

  const [total, reports] = await Promise.all([
    prisma.userReport.count({ where }),
    prisma.userReport.findMany({
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
    data: reports.map(r => ({
      id: r.id,
      userId: r.userId ?? '',
      menuId: r.menuId ?? undefined,
      menuName: r.menuName,
      data: (r.data as any) ?? {},
      status: r.status,
      priority: r.priority,
      adminResponse: r.adminResponse ?? undefined,
      internalNotes: r.internalNotes ?? undefined,
      supportAssignee: r.supportAssignee ?? undefined,
      serviceRating: typeof r.serviceRating === 'number' ? r.serviceRating : undefined,
      serviceFeedback: r.serviceFeedback ?? undefined,
      serviceRatedAt: r.serviceRatedAt ? r.serviceRatedAt.toISOString() : undefined,
      serviceRatedSupportAssignee: r.serviceRatedSupportAssignee ?? undefined,
      timestamp: r.timestamp.toISOString()
    }))
  });
}

export async function POST(req: Request) {
  if (!verifyCsrfToken(req, null, { requireToken: false })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const menuId = typeof body.menuId === 'string' && body.menuId.trim() ? body.menuId.trim() : null;
  const menu = menuId ? await prisma.menuItem.findUnique({ where: { id: menuId }, select: { supportAssignee: true } }) : null;

  const config = await getReportConfig();
  const year = new Date().getFullYear();

  const where: any = {};
  if (config.resetEveryYear && config.yearEnabled) {
    const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const to = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
    where.timestamp = { gte: from, lt: to };
  }

  const existing = await prisma.userReport.findMany({ where, select: { id: true } });
  const used = new Set<number>();
  for (const r of existing) {
    const seq = parseSequenceFromReportId(r.id);
    if (seq !== null) used.add(seq);
  }

  let nextSequence = config.startValue;
  if (used.size) {
    nextSequence = Math.max(...Array.from(used.values())) + 1;
  }

  let id = generateReportId(config, nextSequence);
  let safety = 0;
  while (await prisma.userReport.findUnique({ where: { id } })) {
    safety += 1;
    id = generateReportId(config, nextSequence + safety);
    if (safety > 1000) break;
  }

  const created = await prisma.userReport.create({
    data: {
      id,
      userId: body.userId ?? null,
      menuId,
      menuName: body.menuName ?? 'Unknown',
      data: body.data ?? {},
      status: 'pending',
      priority: body.priority ?? 'medium',
      adminResponse: null,
      internalNotes: null,
      supportAssignee: menu?.supportAssignee ?? null,
      activities: {
        create: [
          {
            type: 'creation',
            actor: body.userId ?? 'system',
            content: `New ${body.menuName ?? 'report'} submitted`
          },
          ...(menu?.supportAssignee ? [{
            type: 'assignment',
            actor: 'system',
            target: menu.supportAssignee,
            content: 'Auto-assigned from menu configuration'
          }] : [])
        ]
      }
    }
  });

  return NextResponse.json({
    status: 'success',
    data: {
      id: created.id,
      userId: created.userId ?? '',
      menuId: created.menuId ?? undefined,
      menuName: created.menuName,
      data: (created.data as any) ?? {},
      status: created.status,
      priority: created.priority,
      adminResponse: created.adminResponse ?? undefined,
      internalNotes: created.internalNotes ?? undefined,
      supportAssignee: created.supportAssignee ?? undefined,
      timestamp: created.timestamp.toISOString()
    }
  });
}

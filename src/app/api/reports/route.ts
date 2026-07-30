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

function sanitizeSearchValue(value: string, maxLength = 256) {
  return value
    .replace(/[\u0000-\u001f\x7f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function normalizeString(value: unknown, maxLength = 128) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

const validPriorities = new Set(['low', 'medium', 'high', 'urgent']);
function normalizePriority(value: unknown) {
  return typeof value === 'string' && validPriorities.has(value) ? value : 'medium';
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
  try {
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
    const q = sanitizeSearchValue(String(searchParams.get('q') ?? ''));
    const statusRaw = sanitizeSearchValue(String(searchParams.get('status') ?? ''));
    const priorityRaw = sanitizeSearchValue(String(searchParams.get('priority') ?? ''));
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const { page, pageSize, skip, take } = parsePageParams(searchParams);

    const whereBase: any = role === 'support' ? { supportAssignee: session.username } : {};
    const status = statusRaw === 'pending' || statusRaw === 'reviewed' || statusRaw === 'resolved' ? statusRaw : null;
    const priority = priorityRaw === 'low' || priorityRaw === 'medium' || priorityRaw === 'high' || priorityRaw === 'urgent' ? priorityRaw : null;

    const where: any = {
      ...whereBase,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {})
    };

    if (q) {
      const orConditions: any[] = [
        { id: { contains: q, mode: 'insensitive' } },
        { menuName: { contains: q, mode: 'insensitive' } }
      ];

      // Add optional fields only if they can contain the query
      orConditions.push({ userId: { contains: q, mode: 'insensitive' } });
      orConditions.push({ supportAssignee: { contains: q, mode: 'insensitive' } });
      orConditions.push({ serviceFeedback: { contains: q, mode: 'insensitive' } });

      // For status, check if query is a prefix of any enum value (case-insensitive)
      const lowerQ = q.toLowerCase();
      const matchingStatuses = ['pending', 'reviewed', 'resolved'].filter(status =>
        status.startsWith(lowerQ)
      );
      if (matchingStatuses.length > 0) {
        orConditions.push({ status: { in: matchingStatuses as any } });
      }

      where.OR = orConditions;
    }

    if (startDate) {
      where.timestamp = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.timestamp = { ...where.timestamp, lte: new Date(endDate) };
    }

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
        assignmentHistory: (r.data as any)?.assignmentHistory ?? [],
        status: r.status,
        priority: r.priority,
        adminResponse: r.adminResponse ?? undefined,
        internalNotes: r.internalNotes ?? undefined,
        supportAssignee: r.supportAssignee ?? undefined,
        serviceRating: typeof r.serviceRating === 'number' ? r.serviceRating : undefined,
        serviceFeedback: r.serviceFeedback ?? undefined,
        serviceRatedAt: r.serviceRatedAt ? r.serviceRatedAt.toISOString() : undefined,
        serviceRatedSupportAssignee: r.serviceRatedSupportAssignee ?? undefined,
        resolvedBy: r.resolvedBy ?? undefined,
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : undefined,
        timestamp: r.timestamp.toISOString()
      }))
    });
  } catch (err) {
    console.error('/api/reports GET error', err && err.stack ? err.stack : err?.message || err);
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!verifyCsrfToken(req, null, { requireToken: false })) {
      return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
    }

    const userId = normalizeString((body as any).userId, 64) || null;
    const menuId = normalizeString((body as any).menuId, 64) || null;
    const menu = menuId
      ? await prisma.menuItem.findUnique({ where: { id: menuId }, select: { supportAssignee: true } })
      : null;
    if (menuId && !menu) {
      return NextResponse.json({ status: 'error', message: 'Invalid menu selected.' }, { status: 400 });
    }

    const menuName = normalizeString((body as any).menuName, 128) || 'Unknown';
    const reportData = (body as any).data && typeof (body as any).data === 'object'
      ? (body as any).data
      : {};
    const priority = normalizePriority((body as any).priority);

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
        userId,
        menuId,
        menuName,
        data: {
          ...reportData,
          ...(menu?.supportAssignee ? {
            assignmentHistory: [{
              assignee: menu.supportAssignee,
              assignedBy: 'system',
              assignedAt: new Date().toISOString(),
              type: 'first_assignment',
              reason: 'Auto-assigned from menu configuration'
            }]
          } : {})
        },
        status: 'pending',
        priority,
        adminResponse: null,
        internalNotes: null,
        supportAssignee: menu?.supportAssignee ?? null,
        activities: {
          create: [
            {
              type: 'creation',
              actor: userId ?? 'system',
              content: `New ${menuName} submitted`
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
  } catch (err) {
    console.error('/api/reports POST error', err && err.stack ? err.stack : err?.message || err);
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 });
  }
}

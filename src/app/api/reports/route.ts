import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

export async function GET() {
  const reports = await prisma.userReport.findMany({
    orderBy: { timestamp: 'desc' }
  });

  return NextResponse.json({
    status: 'success',
    data: reports.map(r => ({
      id: r.id,
      userId: r.userId ?? '',
      menuName: r.menuName,
      data: (r.data as any) ?? {},
      status: r.status,
      priority: r.priority,
      adminResponse: r.adminResponse ?? undefined,
      internalNotes: r.internalNotes ?? undefined,
      timestamp: r.timestamp.toISOString()
    }))
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

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
      menuId: body.menuId ?? null,
      menuName: body.menuName ?? 'Unknown',
      data: body.data ?? {},
      status: 'pending',
      priority: body.priority ?? 'medium',
      adminResponse: null,
      internalNotes: null
    }
  });

  return NextResponse.json({
    status: 'success',
    data: {
      id: created.id,
      userId: created.userId ?? '',
      menuName: created.menuName,
      data: (created.data as any) ?? {},
      status: created.status,
      priority: created.priority,
      adminResponse: created.adminResponse ?? undefined,
      internalNotes: created.internalNotes ?? undefined,
      timestamp: created.timestamp.toISOString()
    }
  });
}


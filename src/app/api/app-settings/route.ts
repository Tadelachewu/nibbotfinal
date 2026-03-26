import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const defaultReportIdConfig = {
  prefix: 'NIB',
  yearEnabled: true,
  numberLength: 6,
  startValue: 100000,
  resetEveryYear: true
};

export async function GET() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 1 },
    include: { reportId: true }
  });

  if (!settings) {
    return NextResponse.json({
      status: 'success',
      data: { supportedLanguages: [], systemTranslations: {}, reportId: defaultReportIdConfig }
    });
  }

  return NextResponse.json({
    status: 'success',
    data: {
      supportedLanguages: (settings.supportedLanguages as any) ?? [],
      systemTranslations: (settings.systemTranslations as any) ?? {},
      reportId: settings.reportId
        ? {
            prefix: settings.reportId.prefix,
            yearEnabled: settings.reportId.yearEnabled,
            numberLength: settings.reportId.numberLength,
            startValue: settings.reportId.startValue,
            resetEveryYear: settings.reportId.resetEveryYear
          }
        : defaultReportIdConfig
    }
  });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const supportedLanguages = Array.isArray(body.supportedLanguages) ? body.supportedLanguages : [];
  const systemTranslations = body.systemTranslations && typeof body.systemTranslations === 'object' ? body.systemTranslations : {};
  const reportId = body.reportId && typeof body.reportId === 'object' ? body.reportId : null;

  const existing = await prisma.appSettings.findUnique({ where: { id: 1 } });

  let reportIdId: number | null | undefined = existing?.reportIdId ?? null;
  if (reportId) {
    if (reportIdId) {
      await prisma.reportIdConfig.update({
        where: { id: reportIdId },
        data: {
          prefix: reportId.prefix ?? defaultReportIdConfig.prefix,
          yearEnabled: typeof reportId.yearEnabled === 'boolean' ? reportId.yearEnabled : defaultReportIdConfig.yearEnabled,
          numberLength: Number.isFinite(reportId.numberLength) ? reportId.numberLength : defaultReportIdConfig.numberLength,
          startValue: Number.isFinite(reportId.startValue) ? reportId.startValue : defaultReportIdConfig.startValue,
          resetEveryYear: typeof reportId.resetEveryYear === 'boolean' ? reportId.resetEveryYear : defaultReportIdConfig.resetEveryYear
        }
      });
    } else {
      const created = await prisma.reportIdConfig.create({
        data: {
          prefix: reportId.prefix ?? defaultReportIdConfig.prefix,
          yearEnabled: typeof reportId.yearEnabled === 'boolean' ? reportId.yearEnabled : defaultReportIdConfig.yearEnabled,
          numberLength: Number.isFinite(reportId.numberLength) ? reportId.numberLength : defaultReportIdConfig.numberLength,
          startValue: Number.isFinite(reportId.startValue) ? reportId.startValue : defaultReportIdConfig.startValue,
          resetEveryYear: typeof reportId.resetEveryYear === 'boolean' ? reportId.resetEveryYear : defaultReportIdConfig.resetEveryYear
        }
      });
      reportIdId = created.id;
    }
  }

  const saved = await prisma.appSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      supportedLanguages,
      systemTranslations,
      reportIdId: reportIdId ?? null
    },
    update: {
      supportedLanguages,
      systemTranslations,
      reportIdId: reportIdId ?? null
    },
    include: { reportId: true }
  });

  return NextResponse.json({
    status: 'success',
    data: {
      supportedLanguages: (saved.supportedLanguages as any) ?? [],
      systemTranslations: (saved.systemTranslations as any) ?? {},
      reportId: saved.reportId
        ? {
            prefix: saved.reportId.prefix,
            yearEnabled: saved.reportId.yearEnabled,
            numberLength: saved.reportId.numberLength,
            startValue: saved.reportId.startValue,
            resetEveryYear: saved.reportId.resetEveryYear
          }
        : defaultReportIdConfig
    }
  });
}


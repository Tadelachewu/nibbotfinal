import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

import { getValidatedAdminSession, verifyCsrfToken } from '@/lib/session';

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

function maskSensitiveInfo(text: string): string {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'pin', 'cvv'];
  let out = text;
  for (const key of sensitiveKeys) {
    const regex = new RegExp(`(${key}\\s*[:=]\\s*)([^\\s,]+)`, 'gi');
    out = out.replace(regex, '$1********');
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const session = await getValidatedAdminSession(true);
    if (!session?.username) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
    }

    const actor = await prisma.adminCredential.findUnique({
      where: { username: session.username },
      select: { role: true },
    });
    if (actor?.role !== 'admin') {
      return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const summaryOnly = searchParams.get('summary') === '1' || searchParams.get('summary') === 'true';
    const q = String(searchParams.get('q') ?? '').trim();
    const status = String(searchParams.get('status') ?? '').trim();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const { page, pageSize, skip, take } = parsePageParams(searchParams);

    const sessionStartRows = await prisma.interactionLog.findMany({
      where: { tags: { has: 'session_start' } },
      distinct: ['sessionId'],
      select: { sessionId: true },
    });

    const uniqueSessions = sessionStartRows.length
      ? sessionStartRows.filter(r => typeof r.sessionId === 'string' && r.sessionId.trim()).length
      : await prisma.interactionLog
        .findMany({
          distinct: ['sessionId'],
          select: { sessionId: true },
        })
        .then(rows => rows.filter(r => typeof r.sessionId === 'string' && r.sessionId.trim()).length);

    if (summaryOnly) {
      return NextResponse.json({
        status: 'success',
        stats: { uniqueSessions },
        data: [],
      });
    }

    const where: any = {};

    if (q) {
      where.OR = [
        { sessionId: { contains: q, mode: 'insensitive' } },
        { userMessage: { contains: q, mode: 'insensitive' } },
        { botResponse: { contains: q, mode: 'insensitive' } },
        { endpoint: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (startDate) {
      where.timestamp = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.timestamp = { ...where.timestamp, lte: new Date(endDate) };
    }

    const [total, logs] = await Promise.all([
      prisma.interactionLog.count({ where }),
      prisma.interactionLog.findMany({
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
      stats: { uniqueSessions },
      meta: { page, pageSize, total, totalPages, hasMore },
      data: logs.map(l => ({
        timestamp: l.timestamp.toISOString(),
        sessionId: l.sessionId,
        userMessage: l.userMessage,
        botResponse: l.botResponse,
        status: l.status,
        endpoint: l.endpoint ?? undefined,
        responseTime: Number.isFinite(l.responseTime) ? Math.max(0, Math.round(Number(l.responseTime))) : 0,
        errorDetails: l.errorDetails ?? undefined,
        tags: l.tags ?? []
      }))
    });
  } catch (err) {
    console.error('GET /api/logs error', err && err.stack ? err.stack : err?.message || err);
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

    const normalizedResponseTime = Number.isFinite(body.responseTime)
      ? Math.max(0, Math.round(Number(body.responseTime)))
      : 0;

    const created = await prisma.interactionLog.create({
      data: {
        sessionId: body.sessionId ?? 'unknown',
        userMessage: maskSensitiveInfo(String(body.userMessage ?? '')),
        botResponse: maskSensitiveInfo(String(body.botResponse ?? '')),
        status: body.status ?? 'success',
        endpoint: body.endpoint ?? null,
        responseTime: normalizedResponseTime,
        errorDetails: body.errorDetails ? maskSensitiveInfo(String(body.errorDetails)) : null,
        tags: Array.isArray(body.tags) ? body.tags : []
      }
    });

    return NextResponse.json({
      status: 'success',
      data: {
        timestamp: created.timestamp.toISOString(),
        sessionId: created.sessionId,
        userMessage: created.userMessage,
        botResponse: created.botResponse,
        status: created.status,
        endpoint: created.endpoint ?? undefined,
        responseTime: Number.isFinite(created.responseTime) ? Math.max(0, Math.round(Number(created.responseTime))) : 0,
        errorDetails: created.errorDetails ?? undefined,
        tags: created.tags ?? []
      }
    });
  } catch (err) {
    console.error('POST /api/logs error', err && err.stack ? err.stack : err?.message || err);
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 });
  }
}

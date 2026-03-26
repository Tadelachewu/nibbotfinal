import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function maskSensitiveInfo(text: string): string {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'pin', 'cvv'];
  let out = text;
  for (const key of sensitiveKeys) {
    const regex = new RegExp(`(${key}\\s*[:=]\\s*)([^\\s,]+)`, 'gi');
    out = out.replace(regex, '$1********');
  }
  return out;
}

export async function GET() {
  const logs = await prisma.interactionLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 500
  });

  return NextResponse.json({
    status: 'success',
    data: logs.map(l => ({
      timestamp: l.timestamp.toISOString(),
      sessionId: l.sessionId,
      userMessage: l.userMessage,
      botResponse: l.botResponse,
      status: l.status,
      endpoint: l.endpoint ?? undefined,
      responseTime: l.responseTime ?? undefined,
      errorDetails: l.errorDetails ?? undefined,
      tags: l.tags ?? []
    }))
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const created = await prisma.interactionLog.create({
    data: {
      sessionId: body.sessionId ?? 'unknown',
      userMessage: maskSensitiveInfo(String(body.userMessage ?? '')),
      botResponse: maskSensitiveInfo(String(body.botResponse ?? '')),
      status: body.status ?? 'success',
      endpoint: body.endpoint ?? null,
      responseTime: Number.isFinite(body.responseTime) ? body.responseTime : null,
      errorDetails: body.errorDetails ?? null,
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
      responseTime: created.responseTime ?? undefined,
      errorDetails: created.errorDetails ?? undefined,
      tags: created.tags ?? []
    }
  });
}


import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const report = await prisma.userReport.findUnique({ where: { id } });
  if (!report) {
    return NextResponse.json({ status: 'error', message: 'Report not found.' }, { status: 404 });
  }

  return NextResponse.json({
    status: 'success',
    data: {
      id: report.id,
      userId: report.userId ?? '',
      menuName: report.menuName,
      data: (report.data as any) ?? {},
      status: report.status,
      priority: report.priority,
      adminResponse: report.adminResponse ?? undefined,
      internalNotes: report.internalNotes ?? undefined,
      timestamp: report.timestamp.toISOString()
    }
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const updated = await prisma.userReport.update({
    where: { id },
    data: {
      status: body.status ?? undefined,
      priority: body.priority ?? undefined,
      adminResponse: typeof body.adminResponse === 'string' ? body.adminResponse : undefined,
      internalNotes: typeof body.internalNotes === 'string' ? body.internalNotes : undefined
    }
  });

  return NextResponse.json({
    status: 'success',
    data: {
      id: updated.id,
      userId: updated.userId ?? '',
      menuName: updated.menuName,
      data: (updated.data as any) ?? {},
      status: updated.status,
      priority: updated.priority,
      adminResponse: updated.adminResponse ?? undefined,
      internalNotes: updated.internalNotes ?? undefined,
      timestamp: updated.timestamp.toISOString()
    }
  });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.userReport.delete({ where: { id } });
  return NextResponse.json({ status: 'success' });
}


import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

import { getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession();
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
  const role = actor?.role ?? null;
  if (role !== 'admin' && role !== 'support') {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const report = await prisma.userReport.findUnique({ where: { id } });
  if (!report) {
    return NextResponse.json({ status: 'error', message: 'Report not found.' }, { status: 404 });
  }

  if (role === 'support' && report.supportAssignee !== session.username) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({
    status: 'success',
    data: {
      id: report.id,
      userId: report.userId ?? '',
      menuId: report.menuId ?? undefined,
      menuName: report.menuName,
      data: (report.data as any) ?? {},
      status: report.status,
      priority: report.priority,
      adminResponse: report.adminResponse ?? undefined,
      internalNotes: report.internalNotes ?? undefined,
      supportAssignee: report.supportAssignee ?? undefined,
      timestamp: report.timestamp.toISOString()
    }
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession();
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
  const role = actor?.role ?? null;
  if (role !== 'admin' && role !== 'support') {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const existing = await prisma.userReport.findUnique({ where: { id }, select: { supportAssignee: true, internalNotes: true } });
  if (!existing) {
    return NextResponse.json({ status: 'error', message: 'Report not found.' }, { status: 404 });
  }

  if (role === 'support' && existing.supportAssignee !== session.username) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  if (role === 'support' && Object.prototype.hasOwnProperty.call(body, 'priority')) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const nextSupportAssignee =
    role === 'admin' && Object.prototype.hasOwnProperty.call(body, 'supportAssignee')
      ? (typeof body.supportAssignee === 'string' && body.supportAssignee.trim() ? body.supportAssignee.trim() : null)
      : undefined;

  const isSupportAssignmentChange =
    role === 'admin' &&
    typeof nextSupportAssignee !== 'undefined' &&
    Object.is(existing.supportAssignee ?? null, nextSupportAssignee) === false;

  if (isSupportAssignmentChange && typeof nextSupportAssignee === 'string') {
    const assignmentTypeRaw = typeof body.supportAssignmentType === 'string' ? body.supportAssignmentType.trim() : '';
    const assignmentReason = typeof body.supportAssignmentReason === 'string' ? body.supportAssignmentReason.trim() : '';
    const expectedType = existing.supportAssignee ? 'escalation' : 'first_assignment';
    if (assignmentTypeRaw !== expectedType) {
      return NextResponse.json({ status: 'error', message: 'Invalid assignment type.' }, { status: 400 });
    }
    if (!assignmentReason) {
      return NextResponse.json({ status: 'error', message: 'Assignment reason is required.' }, { status: 400 });
    }
  }

  if (typeof nextSupportAssignee === 'string') {
    const supportUser = await prisma.adminCredential.findUnique({ where: { username: nextSupportAssignee } });
    if (!supportUser || supportUser.role !== 'support') {
      return NextResponse.json({ status: 'error', message: 'Support assignee must be a Support user.' }, { status: 400 });
    }
  }

  const existingNotes = typeof existing.internalNotes === 'string' ? existing.internalNotes : '';
  const requestedNotes = typeof body.internalNotes === 'string' ? body.internalNotes : undefined;
  let nextInternalNotes = requestedNotes;

  if (isSupportAssignmentChange && typeof nextSupportAssignee === 'string') {
    const assignmentType = typeof body.supportAssignmentType === 'string' ? body.supportAssignmentType.trim() : '';
    const assignmentReason = typeof body.supportAssignmentReason === 'string' ? body.supportAssignmentReason.trim() : '';
    const base = typeof requestedNotes === 'string' ? requestedNotes : existingNotes;
    const timestamp = new Date().toISOString();
    const line = `[Support Assignment] type=${assignmentType} to=${nextSupportAssignee} by=${session.username} at=${timestamp} reason=${assignmentReason}`;
    nextInternalNotes = base ? `${base}\n${line}` : line;
  }

  const updated = await prisma.userReport.update({
    where: { id },
    data: {
      status: body.status ?? undefined,
      priority: body.priority ?? undefined,
      adminResponse: typeof body.adminResponse === 'string' ? body.adminResponse : undefined,
      internalNotes: typeof nextInternalNotes === 'string' ? nextInternalNotes : undefined,
      supportAssignee: nextSupportAssignee
    }
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({
    status: 'success',
    data: {
      id: updated.id,
      userId: updated.userId ?? '',
      menuId: updated.menuId ?? undefined,
      menuName: updated.menuName,
      data: (updated.data as any) ?? {},
      status: updated.status,
      priority: updated.priority,
      adminResponse: updated.adminResponse ?? undefined,
      internalNotes: updated.internalNotes ?? undefined,
      supportAssignee: updated.supportAssignee ?? undefined,
      timestamp: updated.timestamp.toISOString()
    }
  });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession();
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(_, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  await prisma.userReport.delete({ where: { id } });
  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success' });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

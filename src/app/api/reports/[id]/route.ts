import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

import { getValidatedAdminSession, rotateCsrfToken, verifyCsrfToken } from '@/lib/session';
import { logSecurityEvent } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeReportId(value: unknown) {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  if (!id || !/^[A-Za-z0-9-]+$/.test(id)) return null;
  return id;
}

function normalizeString(value: unknown, maxLength = 1024) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

const validPriorities = new Set(['low', 'medium', 'high', 'urgent']);
const validStatuses = new Set(['pending', 'reviewed', 'resolved']);

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const id = normalizeReportId(params.id);
  if (!id) {
    return NextResponse.json({ status: 'error', message: 'Invalid report id.' }, { status: 400 });
  }
  const session = await getValidatedAdminSession(true);

  if (!session?.username) {
    const report = await prisma.userReport.findUnique({
      where: { id },
      select: {
        id: true,
        menuId: true,
        menuName: true,
        status: true,
        priority: true,
        adminResponse: true,
        supportAssignee: true,
        serviceRating: true,
        serviceFeedback: true,
        serviceRatedAt: true,
        timestamp: true,
      }
    });

    if (!report) {
      return NextResponse.json({ status: 'error', message: 'Report not found.' }, { status: 404 });
    }

    return NextResponse.json({
      status: 'success',
      data: {
        id: report.id,
        userId: '',
        menuId: report.menuId ?? undefined,
        menuName: report.menuName,
        data: {},
        status: report.status,
        priority: report.priority,
        adminResponse: report.adminResponse ?? undefined,
        supportAssignee: report.supportAssignee ?? undefined,
        serviceRating: typeof report.serviceRating === 'number' ? report.serviceRating : undefined,
        serviceFeedback: report.serviceFeedback ?? undefined,
        serviceRatedAt: report.serviceRatedAt ? report.serviceRatedAt.toISOString() : undefined,
        timestamp: report.timestamp.toISOString()
      }
    });
  }

  const actor = await prisma.adminCredential.findUnique({ where: { username: session.username } });
  const role = actor?.role ?? null;
  if (role !== 'admin' && role !== 'support') {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

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
      assignmentHistory: (report.data as any)?.assignmentHistory ?? [],
      status: report.status,
      priority: report.priority,
      adminResponse: report.adminResponse ?? undefined,
      internalNotes: report.internalNotes ?? undefined,
      supportAssignee: report.supportAssignee ?? undefined,
      serviceRating: typeof report.serviceRating === 'number' ? report.serviceRating : undefined,
      serviceFeedback: report.serviceFeedback ?? undefined,
      serviceRatedAt: report.serviceRatedAt ? report.serviceRatedAt.toISOString() : undefined,
      serviceRatedSupportAssignee: report.serviceRatedSupportAssignee ?? undefined,
      timestamp: report.timestamp.toISOString()
    }
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const id = normalizeReportId(params.id);
  if (!id) {
    return NextResponse.json({ status: 'error', message: 'Invalid report id.' }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const ratingRaw = (body as any).rating;
  const rating = typeof ratingRaw === 'number' ? ratingRaw : parseInt(String(ratingRaw ?? ''), 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ status: 'error', message: 'Rating must be an integer from 1 to 5.' }, { status: 400 });
  }

  const feedbackRaw = typeof (body as any).feedback === 'string' ? (body as any).feedback : '';
  const feedback = feedbackRaw.trim();
  if (feedback.length > 500) {
    return NextResponse.json({ status: 'error', message: 'Feedback is too long (max 500 characters).' }, { status: 400 });
  }

  const sessionIdRaw = typeof (body as any).sessionId === 'string' ? (body as any).sessionId : '';
  const sessionId = sessionIdRaw.trim();

  const existing = await prisma.userReport.findUnique({
    where: { id },
    select: { status: true, serviceRating: true, supportAssignee: true }
  });
  if (!existing) {
    return NextResponse.json({ status: 'error', message: 'Report not found.' }, { status: 404 });
  }
  if (existing.status !== 'resolved') {
    return NextResponse.json({ status: 'error', message: 'Ratings are available after the report is resolved.' }, { status: 400 });
  }
  if (typeof existing.serviceRating === 'number') {
    return NextResponse.json({ status: 'error', message: 'This report has already been rated.' }, { status: 409 });
  }

  const ratedAt = new Date();
  const supportSnapshot = typeof existing.supportAssignee === 'string' && existing.supportAssignee.trim()
    ? existing.supportAssignee.trim()
    : null;

  const updated = await prisma.userReport.update({
    where: { id },
    data: {
      serviceRating: rating,
      serviceFeedback: feedback ? feedback : undefined,
      serviceRatedAt: ratedAt,
      serviceRatedBySessionId: sessionId ? sessionId : undefined,
      serviceRatedSupportAssignee: supportSnapshot,
      activities: {
        create: {
          type: 'rating',
          actor: 'end_user',
          target: supportSnapshot ?? undefined,
          content: feedback ? `rating=${rating} feedback=${feedback}` : `rating=${rating}`
        }
      }
    }
  });

  return NextResponse.json({
    status: 'success',
    data: {
      id: updated.id,
      serviceRating: typeof updated.serviceRating === 'number' ? updated.serviceRating : undefined,
      serviceFeedback: updated.serviceFeedback ?? undefined,
      serviceRatedAt: updated.serviceRatedAt ? updated.serviceRatedAt.toISOString() : undefined,
      serviceRatedSupportAssignee: updated.serviceRatedSupportAssignee ?? undefined
    }
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(true);
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

  const params = await ctx.params;
  const id = normalizeReportId(params.id);
  if (!id) {
    return NextResponse.json({ status: 'error', message: 'Invalid report id.' }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const existing = await prisma.userReport.findUnique({ where: { id }, select: { status: true, supportAssignee: true, internalNotes: true } });
  if (!existing) {
    return NextResponse.json({ status: 'error', message: 'Report not found.' }, { status: 404 });
  }

  if (role === 'support' && existing.supportAssignee !== session.username) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  if (role === 'support' && Object.prototype.hasOwnProperty.call(body, 'priority')) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const rawStatus = typeof body.status === 'string' ? body.status.trim() : '';
  const nextStatus = rawStatus ? (validStatuses.has(rawStatus) ? rawStatus : null) : undefined;
  if (rawStatus && !nextStatus) {
    return NextResponse.json({ status: 'error', message: 'Invalid report status.' }, { status: 400 });
  }

  const rawPriority = typeof body.priority === 'string' ? body.priority.trim() : '';
  const nextPriority = rawPriority ? (validPriorities.has(rawPriority) ? rawPriority : null) : undefined;
  if (rawPriority && !nextPriority) {
    return NextResponse.json({ status: 'error', message: 'Invalid report priority.' }, { status: 400 });
  }

  const nextAdminResponse = typeof body.adminResponse === 'string'
    ? normalizeString(body.adminResponse, 2000)
    : undefined;

  const requestedNotes = typeof body.internalNotes === 'string'
    ? normalizeString(body.internalNotes, 2000)
    : undefined;

  const nextSupportAssignee =
    role === 'admin' && Object.prototype.hasOwnProperty.call(body, 'supportAssignee')
      ? (typeof body.supportAssignee === 'string' && body.supportAssignee.trim() ? body.supportAssignee.trim() : null)
      : undefined;

  const nextAssignmentHistory =
    role === 'admin' && Array.isArray(body.assignmentHistory)
      ? body.assignmentHistory
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
    if (expectedType === 'escalation' && !assignmentReason) {
      return NextResponse.json({ status: 'error', message: 'Assignment reason is required for escalations.' }, { status: 400 });
    }
  }

  if (typeof nextSupportAssignee === 'string') {
    const supportUser = await prisma.adminCredential.findUnique({ where: { username: nextSupportAssignee } });
    if (!supportUser || supportUser.role !== 'support') {
      return NextResponse.json({ status: 'error', message: 'Support assignee must be a Support user.' }, { status: 400 });
    }
  }

  const existingNotes = typeof existing.internalNotes === 'string' ? existing.internalNotes : '';
  let nextInternalNotes = requestedNotes;

  if (isSupportAssignmentChange && typeof nextSupportAssignee === 'string') {
    const assignmentType = typeof body.supportAssignmentType === 'string' ? body.supportAssignmentType.trim() : '';
    const assignmentReason = typeof body.supportAssignmentReason === 'string' ? body.supportAssignmentReason.trim() : '';
    const base = typeof requestedNotes === 'string' ? requestedNotes : existingNotes;
    const timestamp = new Date().toISOString();
    const line = `[Support Assignment] type=${assignmentType} to=${nextSupportAssignee} by=${session.username} at=${timestamp} reason=${assignmentReason}`;
    nextInternalNotes = base ? `${base}\n${line}` : line;
  }

  const activitiesToCreate: any[] = [];

  if (isSupportAssignmentChange && typeof nextSupportAssignee === 'string') {
    activitiesToCreate.push({
      type: 'assignment',
      actor: session.username,
      target: nextSupportAssignee,
      content: typeof body.supportAssignmentReason === 'string' ? body.supportAssignmentReason.trim() : 'Manual assignment'
    });
  }

  if (body.status === 'resolved' && existing.status !== 'resolved') {
    activitiesToCreate.push({
      type: 'resolution',
      actor: session.username,
      content: 'Report marked as resolved'
    });
  }

  if (typeof nextAdminResponse === 'string' && nextAdminResponse.length > 0) {
    activitiesToCreate.push({
      type: 'response',
      actor: session.username,
      content: nextAdminResponse
    });
  }

  const updated = await prisma.userReport.update({
    where: { id },
    data: {
      status: nextStatus ?? undefined,
      priority: nextPriority ?? undefined,
      adminResponse: typeof nextAdminResponse === 'string' ? nextAdminResponse : undefined,
      internalNotes: typeof nextInternalNotes === 'string' ? nextInternalNotes : undefined,
      supportAssignee: nextSupportAssignee,
      data: nextAssignmentHistory ? {
        ...(existing.data as any ?? {}),
        assignmentHistory: nextAssignmentHistory
      } : undefined,
      activities: activitiesToCreate.length > 0 ? {
        create: activitiesToCreate
      } : undefined
    }
  });

  // Global Audit Log
  await logSecurityEvent({
    actor: session.username,
    action: isSupportAssignmentChange ? 'ASSIGN_REPORT' : 'UPDATE_REPORT',
    target: `report:${id}`,
    details: {
      status: nextStatus,
      priority: nextPriority,
      hasResponse: !!nextAdminResponse,
      assignee: nextSupportAssignee
    },
    ip: session.ip,
    userAgent: session.userAgent
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
      assignmentHistory: (updated.data as any)?.assignmentHistory ?? [],
      status: updated.status,
      priority: updated.priority,
      adminResponse: updated.adminResponse ?? undefined,
      internalNotes: updated.internalNotes ?? undefined,
      supportAssignee: updated.supportAssignee ?? undefined,
      serviceRating: typeof updated.serviceRating === 'number' ? updated.serviceRating : undefined,
      serviceFeedback: updated.serviceFeedback ?? undefined,
      serviceRatedAt: updated.serviceRatedAt ? updated.serviceRatedAt.toISOString() : undefined,
      serviceRatedSupportAssignee: updated.serviceRatedSupportAssignee ?? undefined,
      timestamp: updated.timestamp.toISOString()
    }
  });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(true);
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

  const params = await ctx.params;
  const id = normalizeReportId(params.id);
  if (!id) {
    return NextResponse.json({ status: 'error', message: 'Invalid report id.' }, { status: 400 });
  }

  await prisma.userReport.delete({ where: { id } });

  // Global Audit Log
  await logSecurityEvent({
    actor: session.username,
    action: 'DELETE_REPORT',
    target: `report:${id}`,
    ip: session.ip,
    userAgent: session.userAgent
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success' });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

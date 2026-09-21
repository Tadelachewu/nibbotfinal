import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session';
import { logSecurityEvent } from '@/lib/logger';
import { isEvalAdmin } from '@/lib/eval/authz';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  const datasetId = Number(id);
  if (!Number.isInteger(datasetId)) {
    return NextResponse.json({ status: 'error', message: 'Invalid dataset id.' }, { status: 400 });
  }

  const dataset = await prisma.evaluationDataset.findUnique({
    where: { id: datasetId },
    include: { testCases: { orderBy: { id: 'asc' } } },
  });
  if (!dataset) {
    return NextResponse.json({ status: 'error', message: 'Dataset not found.' }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', data: dataset });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }
  if (!(await isEvalAdmin(session.username))) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const { id } = await params;
  const datasetId = Number(id);
  if (!Number.isInteger(datasetId)) {
    return NextResponse.json({ status: 'error', message: 'Invalid dataset id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.description === 'string' || body?.description === null) data.description = body?.description ?? null;

  const dataset = await prisma.evaluationDataset.update({ where: { id: datasetId }, data }).catch(() => null);
  if (!dataset) {
    return NextResponse.json({ status: 'error', message: 'Dataset not found.' }, { status: 404 });
  }

  await logSecurityEvent({
    actor: session.username,
    action: 'UPDATE_EVAL_DATASET',
    target: `evaluation_dataset:${datasetId}`,
    details: data,
    ip: session.ip,
    userAgent: session.userAgent,
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', data: dataset });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }
  if (!(await isEvalAdmin(session.username))) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const { id } = await params;
  const datasetId = Number(id);
  if (!Number.isInteger(datasetId)) {
    return NextResponse.json({ status: 'error', message: 'Invalid dataset id.' }, { status: 400 });
  }

  await prisma.evaluationDataset.delete({ where: { id: datasetId } }).catch(() => null);

  await logSecurityEvent({
    actor: session.username,
    action: 'DELETE_EVAL_DATASET',
    target: `evaluation_dataset:${datasetId}`,
    details: null,
    ip: session.ip,
    userAgent: session.userAgent,
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success' });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session';
import { logSecurityEvent } from '@/lib/logger';
import { isEvalAdmin } from '@/lib/eval/authz';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const datasets = await prisma.evaluationDataset.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { testCases: true, runs: true } } },
  });

  return NextResponse.json({
    status: 'success',
    data: datasets.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      version: d.version,
      createdBy: d.createdBy,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      testCaseCount: d._count.testCases,
      runCount: d._count.runs,
    })),
  });
}

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : null;
  if (!name) {
    return NextResponse.json({ status: 'error', message: 'name is required.' }, { status: 400 });
  }

  const dataset = await prisma.evaluationDataset.create({
    data: { name, description, createdBy: session.username },
  });

  await logSecurityEvent({
    actor: session.username,
    action: 'CREATE_EVAL_DATASET',
    target: `evaluation_dataset:${dataset.id}`,
    details: { name },
    ip: session.ip,
    userAgent: session.userAgent,
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', data: dataset }, { status: 201 });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

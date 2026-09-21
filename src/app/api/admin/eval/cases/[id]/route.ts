import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session';
import { isEvalAdmin } from '@/lib/eval/authz';

export const dynamic = 'force-dynamic';

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

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
  const caseId = Number(id);
  if (!Number.isInteger(caseId)) {
    return NextResponse.json({ status: 'error', message: 'Invalid test case id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.question === 'string' && body.question.trim()) data.question = body.question.trim();
  if (typeof body?.expectedAnswer === 'string' || body?.expectedAnswer === null) data.expectedAnswer = body?.expectedAnswer?.trim() || null;
  if (Array.isArray(body?.relevantMenuIds)) data.relevantMenuIds = body.relevantMenuIds.filter((v: unknown) => typeof v === 'string');
  if (Array.isArray(body?.relevantChunkIds)) data.relevantChunkIds = body.relevantChunkIds.filter((v: unknown) => Number.isInteger(v));
  if (typeof body?.category === 'string' || body?.category === null) data.category = body?.category?.trim() || null;
  if (typeof body?.language === 'string' && body.language.trim()) data.language = body.language.trim().toLowerCase();
  if (body?.difficulty === null || (typeof body?.difficulty === 'string' && DIFFICULTIES.has(body.difficulty))) data.difficulty = body.difficulty;
  if (typeof body?.answerable === 'boolean') data.answerable = body.answerable;
  if (Array.isArray(body?.expectedCitations)) data.expectedCitations = body.expectedCitations.filter((v: unknown) => typeof v === 'string');
  if (typeof body?.isActive === 'boolean') data.isActive = body.isActive;
  if (body?.metadata && typeof body.metadata === 'object') data.metadata = body.metadata;

  if (!Object.keys(data).length) {
    return NextResponse.json({ status: 'error', message: 'No valid fields to update.' }, { status: 400 });
  }

  const existing = await prisma.evaluationTestCase.findUnique({ where: { id: caseId }, select: { datasetId: true } });
  if (!existing) {
    return NextResponse.json({ status: 'error', message: 'Test case not found.' }, { status: 404 });
  }

  const [testCase] = await prisma.$transaction([
    prisma.evaluationTestCase.update({ where: { id: caseId }, data }),
    prisma.evaluationDataset.update({ where: { id: existing.datasetId }, data: { version: { increment: 1 } } }),
  ]);

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', data: testCase });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

// Archives rather than hard-deletes: EvaluationResult rows from past runs
// reference this test case (no onDelete: Cascade there, deliberately — a
// past run's results must stay intact for audit even if a question is later
// retired), and the runner already only selects isActive:true cases, so
// archiving is sufficient to stop it being used in future runs.
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
  const caseId = Number(id);
  if (!Number.isInteger(caseId)) {
    return NextResponse.json({ status: 'error', message: 'Invalid test case id.' }, { status: 400 });
  }

  const existing = await prisma.evaluationTestCase.findUnique({ where: { id: caseId }, select: { datasetId: true } });
  if (!existing) {
    return NextResponse.json({ status: 'error', message: 'Test case not found.' }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.evaluationTestCase.update({ where: { id: caseId }, data: { isActive: false } }),
    prisma.evaluationDataset.update({ where: { id: existing.datasetId }, data: { version: { increment: 1 } } }),
  ]);

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success' });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

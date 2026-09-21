import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session';
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

  const cases = await prisma.evaluationTestCase.findMany({
    where: { datasetId },
    orderBy: { id: 'asc' },
  });

  return NextResponse.json({ status: 'success', data: cases });
}

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return NextResponse.json({ status: 'error', message: 'question is required.' }, { status: 400 });
  }
  const difficulty = typeof body?.difficulty === 'string' && DIFFICULTIES.has(body.difficulty) ? body.difficulty : null;

  const [testCase] = await prisma.$transaction([
    prisma.evaluationTestCase.create({
      data: {
        datasetId,
        question,
        expectedAnswer: typeof body?.expectedAnswer === 'string' ? body.expectedAnswer.trim() : null,
        relevantMenuIds: Array.isArray(body?.relevantMenuIds) ? body.relevantMenuIds.filter((v: unknown) => typeof v === 'string') : [],
        relevantChunkIds: Array.isArray(body?.relevantChunkIds) ? body.relevantChunkIds.filter((v: unknown) => Number.isInteger(v)) : [],
        category: typeof body?.category === 'string' ? body.category.trim() || null : null,
        language: typeof body?.language === 'string' && body.language.trim() ? body.language.trim().toLowerCase() : 'en',
        difficulty,
        answerable: typeof body?.answerable === 'boolean' ? body.answerable : true,
        expectedCitations: Array.isArray(body?.expectedCitations) ? body.expectedCitations.filter((v: unknown) => typeof v === 'string') : [],
        metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
        createdBy: session.username,
      },
    }),
    prisma.evaluationDataset.update({ where: { id: datasetId }, data: { version: { increment: 1 } } }),
  ]);

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', data: testCase }, { status: 201 });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

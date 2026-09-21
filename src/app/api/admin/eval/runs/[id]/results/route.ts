import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Paginated, filterable results for one run — used by both the "Evaluation
// Runs" detail view and "Failed Questions" (status=error|timeout, or
// judgeEvaluation.hallucinationDetected=true) in the admin dashboard.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) {
    return NextResponse.json({ status: 'error', message: 'Invalid run id.' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20));
  const category = searchParams.get('category');
  const language = searchParams.get('language');
  const difficulty = searchParams.get('difficulty');
  const answerable = searchParams.get('answerable'); // 'true' | 'false'
  const status = searchParams.get('status'); // success | error | timeout
  const onlyHallucinations = searchParams.get('hallucinations') === 'true';
  const onlyFailedAbstention = searchParams.get('failedAbstention') === 'true';

  const where: any = { runId };
  if (status) where.status = status;
  if (onlyHallucinations) where.judgeEvaluation = { hallucinationDetected: true };
  if (onlyFailedAbstention) where.abstentionOutcome = { in: ['incorrect_abstention', 'hallucinated_answer'] };
  if (category || language || difficulty || answerable !== null) {
    where.testCase = {
      ...(category ? { category } : {}),
      ...(language ? { language } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(answerable !== null ? { answerable: answerable === 'true' } : {}),
    };
  }

  const [results, total] = await Promise.all([
    prisma.evaluationResult.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: page * pageSize,
      take: pageSize,
      include: {
        testCase: { select: { category: true, language: true, difficulty: true, answerable: true } },
        judgeEvaluation: { include: { claims: true, citations: true } },
      },
    }),
    prisma.evaluationResult.count({ where }),
  ]);

  return NextResponse.json({
    status: 'success',
    data: results,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

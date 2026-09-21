import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session';
import { isEvalAdmin } from '@/lib/eval/authz';
import { startEvaluationRun } from '@/lib/eval/runner';

export const dynamic = 'force-dynamic';

// Starts a pending run, or resumes one that finished with failures/crashed —
// startEvaluationRun() only (re)processes test cases that don't already
// have a successful EvaluationResult for this run, so calling this again is
// always safe and picks up exactly where the run left off.
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
  const runId = Number(id);
  if (!Number.isInteger(runId)) {
    return NextResponse.json({ status: 'error', message: 'Invalid run id.' }, { status: 400 });
  }

  const run = await prisma.evaluationRun.findUnique({ where: { id: runId } });
  if (!run) {
    return NextResponse.json({ status: 'error', message: 'Run not found.' }, { status: 404 });
  }
  if (run.status === 'running') {
    return NextResponse.json({ status: 'error', message: 'Run is already in progress.' }, { status: 409 });
  }

  startEvaluationRun(runId).catch(err => console.error(`[eval] run ${runId} failed to start:`, err));

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', message: 'Run started/resumed.' }, { status: 202 });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

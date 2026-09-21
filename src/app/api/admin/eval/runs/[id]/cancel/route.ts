import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session';
import { isEvalAdmin } from '@/lib/eval/authz';

export const dynamic = 'force-dynamic';

// Cooperative cancellation: sets a DB flag the runner checks between test
// cases (src/lib/eval/runner.ts's isCancelled()) — in-flight LLM calls for
// cases already dispatched still finish, but no new ones start.
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

  const run = await prisma.evaluationRun.update({
    where: { id: runId },
    data: { cancelRequested: true },
  }).catch(() => null);
  if (!run) {
    return NextResponse.json({ status: 'error', message: 'Run not found.' }, { status: 404 });
  }

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', message: 'Cancellation requested.' });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

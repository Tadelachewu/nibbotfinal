import { NextRequest, NextResponse } from 'next/server';
import { getValidatedAdminSession } from '@/lib/session';
import { computeRunSummary } from '@/lib/eval/summary';

export const dynamic = 'force-dynamic';

// Aggregate success/failure metrics for one run — see src/lib/eval/summary.ts.
// Computed on read (not cached/stored) since it's cheap at eval-run scale
// (hundreds of rows, not millions) and always reflects the latest results
// while a run is still in progress.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) {
    return NextResponse.json({ status: 'error', message: 'Invalid run id.' }, { status: 400 });
  }

  const summary = await computeRunSummary(runId);
  if (!summary) {
    return NextResponse.json({ status: 'error', message: 'Run not found.' }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', data: summary });
}

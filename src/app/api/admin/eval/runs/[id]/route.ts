import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Polled by the admin dashboard for live progress (status/completedCases/
// failedCases) — deliberately lightweight, no join on results.
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

  const run = await prisma.evaluationRun.findUnique({
    where: { id: runId },
    include: { dataset: { select: { name: true } } },
  });
  if (!run) {
    return NextResponse.json({ status: 'error', message: 'Run not found.' }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', data: run });
}

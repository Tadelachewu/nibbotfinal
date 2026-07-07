import { NextResponse } from 'next/server';
import { getValidatedAdminSession } from '@/lib/session';
import { rebuildAll } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  // Fire-and-forget — client polls /status for progress
  rebuildAll().then(({ indexed, failed }) => {
    console.log(`[KB] rebuild complete: indexed=${indexed} failed=${failed}`);
  }).catch(err => {
    console.error('[KB] rebuild error:', err);
  });

  return NextResponse.json(
    { status: 'success', message: 'Rebuild started. Poll /api/admin/kb/status for progress.' },
    { status: 202 },
  );
}

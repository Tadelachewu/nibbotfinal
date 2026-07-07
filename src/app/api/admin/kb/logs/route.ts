import { NextRequest, NextResponse } from 'next/server';
import { getValidatedAdminSession } from '@/lib/session';
import { getKBQueryLogs } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromRaw  = searchParams.get('from');
  const toRaw    = searchParams.get('to');
  const pageRaw  = searchParams.get('page') ?? '1';
  const limitRaw = searchParams.get('limit') ?? '50';

  const page   = Math.max(1, parseInt(pageRaw,  10) || 1);
  const limit  = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
  const offset = (page - 1) * limit;

  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to   = toRaw   ? new Date(toRaw)   : undefined;

  if (from && isNaN(from.getTime())) {
    return NextResponse.json({ status: 'error', message: 'Invalid from date.' }, { status: 400 });
  }
  if (to && isNaN(to.getTime())) {
    return NextResponse.json({ status: 'error', message: 'Invalid to date.' }, { status: 400 });
  }

  const { rows, total } = await getKBQueryLogs({ from, to, limit, offset });

  return NextResponse.json({
    status: 'success',
    data: { rows, total, page, limit },
  });
}

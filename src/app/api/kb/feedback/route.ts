import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Public — thumbs up/down on a specific answer, keyed by the KBQueryLog row
// id returned as `queryLogId` on KBResult (see src/lib/kb.ts's queryKB()).
// Scoped strictly to setting the three feedback columns on an existing row;
// never returns row content, so this can't be used to enumerate/read logs.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const queryLogId = Number(body.queryLogId);
  const helpful = body.helpful;
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : null;

  if (!Number.isInteger(queryLogId) || queryLogId <= 0) {
    return Response.json({ status: 'error', message: 'Invalid queryLogId.' }, { status: 400 });
  }
  if (typeof helpful !== 'boolean') {
    return Response.json({ status: 'error', message: 'helpful must be a boolean.' }, { status: 400 });
  }

  const result = await prisma.kBQueryLog.updateMany({
    where: { id: queryLogId },
    data: { helpful, feedbackComment: comment, feedbackAt: new Date() },
  }).catch(() => null);

  if (!result || result.count === 0) {
    return Response.json({ status: 'error', message: 'Query log not found.' }, { status: 404 });
  }

  return Response.json({ status: 'success' });
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const session = await getValidatedAdminSession();
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const actor = await prisma.adminCredential.findUnique({
    where: { username: session.username },
    select: { role: true }
  });

  if (!actor || (actor.role !== 'admin' && actor.role !== 'support')) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const reportId = searchParams.get('reportId');

  // Horizontal RBAC (IDOR): Support users can only see activities for reports assigned to them.
  if (actor.role === 'support' && reportId) {
    const report = await prisma.userReport.findUnique({
      where: { id: reportId },
      select: { supportAssignee: true }
    });
    if (!report || report.supportAssignee !== session.username) {
      return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
    }
  }

  const activities = await prisma.reportActivity.findMany({
    where: {
      AND: [
        reportId ? { reportId } : {},
        actor.role === 'support' ? { report: { supportAssignee: session.username } } : {}
      ]
    },
    include: {
      report: {
        select: {
          menuName: true
        }
      }
    },
    orderBy: { timestamp: 'desc' },
    take: 500
  });

  return NextResponse.json({
    status: 'success',
    data: activities.map(a => ({
      id: a.id,
      reportId: a.reportId,
      menuName: a.report.menuName,
      type: a.type,
      actor: a.actor,
      target: a.target ?? undefined,
      content: a.content ?? undefined,
      timestamp: a.timestamp.toISOString()
    }))
  });
}

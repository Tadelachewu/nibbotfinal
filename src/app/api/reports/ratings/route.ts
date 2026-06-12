import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession } from '@/lib/session';

export async function GET(req: Request) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '0', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const sortKey = searchParams.get('sortKey') || 'avg'; // avg, count, lastRatedAt

  const take = Math.max(1, pageSize);
  const skip = Math.max(0, page) * take;

  // Step 1: Aggregate ratings from reports
  const allReports = await prisma.userReport.findMany({
    where: { serviceRating: { not: null } },
    select: {
      serviceRating: true,
      serviceFeedback: true,
      serviceRatedAt: true,
      supportAssignee: true,
      serviceRatedSupportAssignee: true
    }
  });

  // Step 2: Get all support users to include unrated ones
  const supportUsers = await prisma.adminCredential.findMany({
    where: { role: 'support' },
    select: { username: true }
  });

  // Step 3: Build ratings map
  const ratingsMap = new Map<string, {
    username: string;
    total: number;
    count: number;
    feedbackCount: number;
    lastRatedAt: Date | null;
  }>();

  // Add all support users first
  supportUsers.forEach(u => {
    ratingsMap.set(u.username, {
      username: u.username,
      total: 0,
      count: 0,
      feedbackCount: 0,
      lastRatedAt: null
    });
  });

  // Add '__unassigned__'
  ratingsMap.set('__unassigned__', {
    username: '__unassigned__',
    total: 0,
    count: 0,
    feedbackCount: 0,
    lastRatedAt: null
  });

  // Populate with report data
  allReports.forEach(report => {
    const username = report.serviceRatedSupportAssignee ?? report.supportAssignee ?? '__unassigned__';
    const entry = ratingsMap.get(username) || {
      username,
      total: 0,
      count: 0,
      feedbackCount: 0,
      lastRatedAt: null
    };
    entry.count += 1;
    entry.total += report.serviceRating ?? 0;
    if (report.serviceFeedback?.trim()) entry.feedbackCount += 1;
    if (report.serviceRatedAt && (!entry.lastRatedAt || report.serviceRatedAt > entry.lastRatedAt)) {
      entry.lastRatedAt = report.serviceRatedAt;
    }
    ratingsMap.set(username, entry);
  });

  // Step 4: Prepare and sort the data
  let ratings = Array.from(ratingsMap.values()).map(r => ({
    ...r,
    avg: r.count > 0 ? r.total / r.count : 0,
    lastRatedAt: r.lastRatedAt ? r.lastRatedAt.toISOString() : null
  }));

  // Sort based on sortKey
  ratings.sort((a, b) => {
    if (sortKey === 'count') return b.count - a.count;
    if (sortKey === 'lastRatedAt') {
      const aTime = a.lastRatedAt ? new Date(a.lastRatedAt).getTime() : 0;
      const bTime = b.lastRatedAt ? new Date(b.lastRatedAt).getTime() : 0;
      return bTime - aTime;
    }
    return b.avg - a.avg;
  });

  const total = ratings.length;
  const paginatedRatings = ratings.slice(skip, skip + take);
  const totalPages = Math.ceil(total / take);
  const hasMore = skip + take < total;

  return NextResponse.json({
    status: 'success',
    data: paginatedRatings,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore
    }
  });
}

import { NextResponse } from 'next/server';
import { getValidatedAdminSession } from '@/lib/session';
import { getKBStatus, getKBConfig } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const [statuses, config] = await Promise.all([getKBStatus(), getKBConfig()]);

  const totalChunks  = statuses.reduce((s, m) => s + m.chunkCount, 0);
  const indexedMenus = statuses.filter(m => m.chunkCount > 0).length;

  return NextResponse.json({
    status: 'success',
    data: {
      config,
      summary: { totalMenus: statuses.length, indexedMenus, totalChunks },
      menus: statuses,
    },
  });
}

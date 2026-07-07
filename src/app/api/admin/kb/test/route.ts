import { NextResponse } from 'next/server';
import { getValidatedAdminSession } from '@/lib/session';
import { queryKB } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const question = searchParams.get('q')?.trim() ?? '';
  const lang     = searchParams.get('lang')?.toLowerCase() ?? 'en';

  if (!question) {
    return NextResponse.json({ status: 'error', message: 'q param is required.' }, { status: 400 });
  }

  try {
    // Admin test queries use a synthetic sessionId that won't hit user rate
    // limits, and can search disabled articles too — so an article can be
    // authored/QA'd via Test AI before being switched on for real users.
    const result = await queryKB(question, lang, `admin_test:${session.username}`, {
      includeDisabledArticles: true,
    });
    return NextResponse.json({ status: 'success', data: result });
  } catch (err: any) {
    const isOllama = String(err?.message || '').startsWith('Ollama');
    if (isOllama) {
      return NextResponse.json(
        { status: 'error', message: 'Ollama is unreachable. Check OLLAMA_URL and that the service is running.' },
        { status: 503 },
      );
    }
    console.error('[KB test]', err);
    return NextResponse.json({ status: 'error', message: String(err?.message || 'Internal error') }, { status: 500 });
  }
}

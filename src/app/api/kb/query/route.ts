import { NextResponse } from 'next/server';
import { queryKB, sanitizeQuestion } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
    }

    const question  = typeof body.question  === 'string' ? body.question  : '';
    const lang      = typeof body.lang      === 'string' ? body.lang.trim().toLowerCase() : 'en';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';

    if (!sessionId || sessionId.length > 128) {
      return NextResponse.json({ status: 'error', message: 'Missing or invalid sessionId.' }, { status: 400 });
    }

    // Validate & sanitize the question (throws with .code on bad input)
    try {
      sanitizeQuestion(question);
    } catch (err: any) {
      return NextResponse.json({ status: 'error', message: 'Invalid question.' }, { status: err.code ?? 400 });
    }

    // Optional prior turn, used to resolve follow-up questions ("how many
    // are there?") into standalone ones before retrieval. Client-supplied,
    // so re-sanitize it the same way as a fresh question rather than trusting
    // it — it gets embedded directly into an LLM prompt. Malformed/oversized
    // entries are dropped rather than rejecting the whole request; a missing
    // rewrite hint just means the follow-up is handled like a first turn.
    const rawHistory = Array.isArray(body.history) ? body.history.slice(-2) : [];
    const history = rawHistory
      .map((h: any) => {
        if (!h || typeof h !== 'object') return null;
        let q: string;
        try {
          q = sanitizeQuestion(h.question);
        } catch {
          return null;
        }
        const a = typeof h.answer === 'string' ? h.answer.replace(/<[^>]*>/g, '').trim().slice(0, 1000) : '';
        if (!a) return null;
        return { question: q, answer: a };
      })
      .filter((h: unknown): h is { question: string; answer: string } => h !== null);

    const result = await queryKB(question, lang, sessionId, { history });
    return NextResponse.json({ status: 'success', data: result });
  } catch (err: any) {
    if (err?.code === 429) {
      return NextResponse.json({ status: 'error', message: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }
    if (err?.message === 'kb_disabled') {
      return NextResponse.json({ status: 'error', message: 'Knowledge base is currently unavailable.' }, { status: 503 });
    }
    // Ollama unreachable or embed/generate failure
    const isOllama = String(err?.message || '').startsWith('Ollama');
    if (isOllama) {
      return NextResponse.json(
        { status: 'error', message: 'Knowledge base is temporarily unavailable. Please use the menu or contact support.' },
        { status: 503 },
      );
    }
    console.error('[KB query]', err);
    return NextResponse.json({ status: 'error', message: 'Internal server error.' }, { status: 500 });
  }
}

import { queryKB, sanitizeQuestion } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const question  = typeof body.question  === 'string' ? body.question  : '';
  const lang      = typeof body.lang      === 'string' ? body.lang.trim().toLowerCase() : 'en';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';

  if (!sessionId || sessionId.length > 128) {
    return Response.json({ status: 'error', message: 'Missing or invalid sessionId.' }, { status: 400 });
  }

  // Validate & sanitize the question (throws with .code on bad input). This
  // stays a plain, immediate JSON response — it's a fast synchronous check
  // that never reaches retrieval/generation, so there's nothing to stream.
  try {
    sanitizeQuestion(question);
  } catch (err: any) {
    return Response.json({ status: 'error', message: 'Invalid question.' }, { status: err.code ?? 400 });
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

  // Everything past this point (rate limiting, retrieval, the actual answer
  // generation) streams as newline-delimited JSON instead of one blocking
  // JSON response — the generation step alone was measured taking 16-80s+
  // end to end on this stack, during which the old blocking response left
  // the UI showing nothing at all. The client reads each line as it
  // arrives: {type:'chunk', text} for each answer token as it's generated,
  // and a final {type:'result'|'error', ...} once the whole answer (or a
  // failure) is known. HTTP status is always 200 here — errors are carried
  // as a stream event instead, since the response has already started by
  // the time most failures (rate limit, Ollama down/timeout) can occur.
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const send = (obj: unknown) => {
    controllerRef?.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      (async () => {
        try {
          const result = await queryKB(question, lang, sessionId, {
            history,
            onToken: (text) => send({ type: 'chunk', text }),
          });
          send({ type: 'result', data: result });
        } catch (err: any) {
          if (err?.code === 429) {
            send({ type: 'error', status: 429, message: 'Too many requests. Please wait a moment.' });
          } else if (err?.message === 'kb_disabled') {
            send({ type: 'error', status: 503, message: 'Knowledge base is currently unavailable.' });
          } else if (String(err?.message || '').startsWith('Ollama')) {
            // Ollama unreachable or embed/generate failure
            send({
              type: 'error',
              status: 503,
              message: 'Knowledge base is temporarily unavailable. Please use the menu or contact support.',
            });
          } else {
            console.error('[KB query]', err);
            send({ type: 'error', status: 500, message: 'Internal server error.' });
          }
        } finally {
          controllerRef?.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      // Prevent an nginx reverse proxy (see PRODUCTION_SETUP.md) from
      // buffering the whole response before forwarding it, which would
      // silently turn this back into a blocking response in production.
      'X-Accel-Buffering': 'no',
    },
  });
}

import prisma from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const RERANKER_URL = (process.env.RERANKER_URL || 'http://localhost:8001').replace(/\/$/, '');
const VECTOR_DIMS = Number(process.env.KB_VECTOR_DIMS || 1024);
// Optional alternative to Ollama for chat generation only (see
// generateViaProvider() below) — embeddings and the AI Evaluation judge
// always use Ollama regardless of this. The key is server-only env config,
// deliberately never stored in kb_config / returned by any admin API
// response (see KBConfig.openrouterModel's schema comment).
const OPENROUTER_URL = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// Short-lived cache — queryKB() calls getKBConfig() on every single request,
// which otherwise means a DB round trip before any real work starts. Config
// changes take up to this long to take effect; acceptable for values tuned
// occasionally in the admin UI, and cheap insurance against DB load under
// real query volume.
const CONFIG_CACHE_MS = 10_000;
let cachedConfig: { value: Awaited<ReturnType<typeof loadKBConfig>>; expiresAt: number } | null = null;

async function loadKBConfig() {
  const cfg = await prisma.kBConfig.findUnique({ where: { id: 1 } });
  return {
    enabled: cfg?.enabled ?? (process.env.KB_ENABLED !== 'false'),
    embeddingModel: cfg?.embeddingModel ?? (process.env.OLLAMA_EMBED_MODEL || 'bge-m3'),
    generationModel: cfg?.generationModel ?? (process.env.OLLAMA_GENERATE_MODEL || 'aya:8b'),
    generationProvider: (cfg?.generationProvider === 'openrouter' ? 'openrouter' : 'ollama') as 'ollama' | 'openrouter',
    openrouterModel: cfg?.openrouterModel ?? (process.env.OPENROUTER_MODEL || null),
    chunkSize: cfg?.chunkSize ?? Number(process.env.KB_CHUNK_SIZE || 350),
    chunkOverlap: cfg?.chunkOverlap ?? 60,
    topK: cfg?.topK ?? Number(process.env.KB_TOP_K || 5),
    minScore: cfg?.minScore ?? Number(process.env.KB_MIN_SCORE || 0.5),
    temperature: cfg?.temperature ?? Number(process.env.KB_TEMPERATURE || 0.2),
    rerankerEnabled: cfg?.rerankerEnabled ?? (process.env.KB_RERANKER_ENABLED === 'true'),
    rerankerModel: cfg?.rerankerModel ?? (process.env.KB_RERANKER_MODEL || 'bge-reranker-base'),
    rerankPoolSize: cfg?.rerankPoolSize ?? Number(process.env.KB_RERANK_POOL_SIZE || 15),
    rerankMinScore: cfg?.rerankMinScore ?? Number(process.env.KB_RERANK_MIN_SCORE || 0.25),
    systemPrompt: cfg?.systemPrompt ?? null,
  };
}

async function getKBConfig() {
  if (cachedConfig && cachedConfig.expiresAt > Date.now()) return cachedConfig.value;
  const value = await loadKBConfig();
  cachedConfig = { value, expiresAt: Date.now() + CONFIG_CACHE_MS };
  return value;
}

// ---------------------------------------------------------------------------
// Ollama wrappers — no SDK, plain fetch, always server-side
// ---------------------------------------------------------------------------

// Retries only real network failures (connection refused/reset) — never
// timeouts. A model that's already too slow to answer in time will almost
// certainly time out again immediately, so retrying it would just double the
// worst-case wait for no benefit. A dropped/refused connection, on the other
// hand, is often transient (Ollama mid-restart, brief network blip).
async function fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    if (retries > 0 && !isTimeout) {
      return fetchWithRetry(url, init, retries - 1);
    }
    throw err;
  }
}

async function embed(text: string, model: string): Promise<number[]> {
  const res = await fetchWithRetry(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text.slice(0, 8000), keep_alive: '30m' }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama embed ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { embedding: number[] };
  if (!Array.isArray(data.embedding) || data.embedding.length !== VECTOR_DIMS) {
    throw new Error(
      `Ollama embed: expected ${VECTOR_DIMS} dims, got ${data.embedding?.length ?? 'none'}`,
    );
  }
  return data.embedding;
}

// Exported so the AI Evaluation judge (src/lib/eval/judge.ts) can call Ollama
// through this exact tested path (retry/timeout/think:false handling)
// instead of a second hand-rolled implementation. Never called from any
// production request path other than queryKB() itself.
export async function generate(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  opts: { temperature?: number; timeoutMs?: number; numPredict?: number } = {},
): Promise<string> {
  const { temperature = 0.2, timeoutMs = 90_000, numPredict } = opts;
  const res = await fetchWithRetry(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      // keep_alive keeps the model resident between requests — avoids paying
      // a multi-second reload penalty on every query when traffic is bursty.
      keep_alive: '30m',
      // Reasoning models (e.g. qwen3) spend a large, unpredictable chunk of
      // the token budget on a hidden "thinking" block before ever emitting
      // real content — observed burning all of num_predict on thinking alone,
      // returning empty content. `think: false` disables that for models that
      // support it; Ollama ignores the field entirely for models that don't.
      think: false,
      options: { temperature, ...(numPredict ? { num_predict: numPredict } : {}) },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama generate ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return String(data.message?.content || '').trim();
}

// Same call as generate(), but with stream: true — Ollama then sends the
// response as newline-delimited JSON objects (one per token/token-chunk,
// each with a `message.content` delta) instead of a single payload after
// the full ~600-token answer is ready. On this stack the generate call
// itself measured 16-80s+ end to end (mostly model load + slow CPU token
// throughput, not app overhead) — streamed, the user sees the answer build
// token-by-token instead of a single multi-second blank wait, which is what
// actually matters for perceived speed since the total wall-clock time is
// unchanged either way. onToken fires per delta; the full concatenated
// answer is still returned at the end so callers (logging, etc.) are
// unaffected by streaming vs. non-streaming.
async function generateStreaming(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  opts: { temperature?: number; timeoutMs?: number; numPredict?: number } = {},
  onToken: (delta: string) => void,
): Promise<string> {
  const { temperature = 0.2, timeoutMs = 90_000, numPredict } = opts;
  const res = await fetchWithRetry(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      keep_alive: '30m',
      think: false,
      options: { temperature, ...(numPredict ? { num_predict: numPredict } : {}) },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama generate ${res.status}: ${body}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let obj: { message?: { content?: string }; done?: boolean };
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      const delta = obj.message?.content;
      if (delta) {
        full += delta;
        onToken(delta);
      }
      if (obj.done) return full.trim();
    }
  }
  return full.trim();
}

// ---------------------------------------------------------------------------
// OpenRouter — optional alternative to Ollama for chat generation only (see
// generateViaProvider()/generateViaProviderStreaming() below, and
// KBConfig.generationProvider). OpenRouter's API is OpenAI-compatible over
// plain HTTP, so this follows the same "no SDK, plain fetch" convention as
// the Ollama wrappers above rather than adding the `openai` package as a
// dependency.
//
// Explicitly sends `reasoning: { enabled: false }` on every request — the
// same reasoning as Ollama's `think: false` above, and not optional the way
// the original version of this comment assumed: measured directly against
// nvidia/nemotron-3-ultra (a reasoning-tuned model), a request with no
// `reasoning` field at all still reasoned by default, and on the
// short-budget rewriteFollowUp() call (numPredict=60) it spent the entire
// budget narrating its reasoning in plain prose inside `content` itself —
// not in a separate `reasoning_content` field the extraction logic below
// could filter out — and got cut off before ever emitting the real rewrite,
// corrupting the question sent into retrieval/generation downstream.
// Omitting `reasoning` is not "reasoning off" for every model; only an
// explicit `enabled: false` reliably is.
// ---------------------------------------------------------------------------

function assertOpenRouterConfigured(): void {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter generation selected but OPENROUTER_API_KEY is not set in .env');
  }
}

// OpenRouter returning HTTP 200 with an embedded error body is not the same
// failure shape as Ollama being unreachable — measured directly against the
// free tier: repeated identical requests interleaved success and failure
// ("Upstream error from Nvidia: Service temporarily overloaded"), i.e. a
// genuine transient load spike, not a deterministic break. That's worth one
// short-backoff retry, unlike fetchWithRetry's deliberate refusal to retry
// timeouts above (a too-slow model will time out again immediately; an
// overloaded upstream often clears within a second).
function isTransientOpenRouterError(err: { message?: string; code?: number } | undefined): boolean {
  if (!err) return false;
  if (err.code === 429 || err.code === 502 || err.code === 503 || err.code === 504) return true;
  return /overloaded|rate.?limit|temporarily unavailable|try again/i.test(err.message || '');
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const OPENROUTER_MAX_ATTEMPTS = 2;

async function generateOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  opts: { temperature?: number; timeoutMs?: number; numPredict?: number } = {},
): Promise<string> {
  assertOpenRouterConfigured();
  const { temperature = 0.2, timeoutMs = 90_000, numPredict } = opts;

  for (let attempt = 1; attempt <= OPENROUTER_MAX_ATTEMPTS; attempt++) {
  const res = await fetchWithRetry(`${OPENROUTER_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      // OpenRouter-specific: prefer deterministic JSON-free answers and ask
      // the underlying provider to omit any "thinking" blocks from the
      // content field. Some providers (Gemini/Gemma reasoning, Claude) still
      // send `content: null` alongside a separate `reasoning_content` — the
      // extraction code below handles both cases.
      'HTTP-Referer': 'https://nibbank.local',
      'X-Title': 'NIB International Bank Assistant',
    },
    body: JSON.stringify({
      model,
      temperature,
      reasoning: { enabled: false },
      ...(numPredict ? { max_tokens: numPredict } : {}),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter generate ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    // OpenRouter can return HTTP 200 with an error body instead of a real
    // completion — measured directly: "Upstream error from Nvidia: Service
    // temporarily overloaded" came back as status 200 in ~1/3 of real calls
    // against the free tier. res.ok alone does NOT catch this; without this
    // check, the content-extraction logic below silently found nothing and
    // returned an empty string instead of surfacing the failure — unlike
    // Ollama's equivalent path, which always throws on a genuine failure.
    error?: { message?: string; code?: number };
    choices?: {
      message?: {
        content?: string | Array<{ type?: string; text?: string }> | null;
        reasoning_content?: string | null;
      };
      text?: string;
    }[];
  };
  if (data.error) {
    if (isTransientOpenRouterError(data.error) && attempt < OPENROUTER_MAX_ATTEMPTS) {
      await sleep(600 * attempt);
      continue;
    }
    throw new Error(`OpenRouter generate error (code ${data.error.code ?? 'unknown'}): ${data.error.message || JSON.stringify(data.error)}`);
  }
  const msg = data.choices?.[0]?.message;
  let content = '';
  // Case 1: plain string content (most providers, e.g. GPT-4o, Llama)
  if (typeof msg?.content === 'string' && msg.content) content = msg.content;
  // Case 2: Anthropic-style array of content parts — join `text` fields
  else if (Array.isArray(msg?.content)) {
    content = msg.content
      .filter(p => p && p.type !== 'tool_use' && typeof p.text === 'string')
      .map(p => (p as { text: string }).text)
      .join(' ');
  }
  // Case 3: `choices[0].text` (legacy completions shape; rare but some providers wrap this way)
  if (!content && typeof data.choices?.[0]?.text === 'string') {
    content = data.choices[0].text;
  }
  // Case 4: Some reasoning models send answer content in
  // `reasoning_content` only and leave `content` as null/empty. This is
  // genuinely the real answer for e.g. some self-hosted models behind
  // OpenRouter — prefer this over returning an empty string that the UI
  // renders as no AI answer at all.
  if (!content && typeof msg?.reasoning_content === 'string' && msg.reasoning_content) {
    content = msg.reasoning_content;
  }
  return String(content || '').trim();
  }
  throw new Error('OpenRouter generate: exhausted retries against a transiently overloaded upstream');
}

// Same streaming contract as generateStreaming() above (onToken fires per
// delta, full text returned at the end) — different wire format underneath:
// OpenAI-style SSE (`data: {...}` lines, `choices[0].delta.content`,
// terminated by a literal `data: [DONE]`) rather than Ollama's
// newline-delimited JSON. Non-`data:` lines (e.g. OpenRouter's `: ` keep-alive
// comments) are skipped.
async function generateOpenRouterStreaming(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  opts: { temperature?: number; timeoutMs?: number; numPredict?: number } = {},
  onToken: (delta: string) => void,
): Promise<string> {
  assertOpenRouterConfigured();
  const { temperature = 0.2, timeoutMs = 90_000, numPredict } = opts;

  for (let attempt = 1; attempt <= OPENROUTER_MAX_ATTEMPTS; attempt++) {
  const res = await fetchWithRetry(`${OPENROUTER_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature,
      reasoning: { enabled: false },
      ...(numPredict ? { max_tokens: numPredict } : {}),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter generate ${res.status}: ${body}`);
  }
  // Same 200-with-error-body failure mode as generateOpenRouter() above, but
  // for a streaming request the error comes back as a single JSON object
  // instead of an SSE stream — detected via content-type rather than trying
  // to SSE-parse it (which would just find no `data:` lines and silently
  // return an empty answer). Safe to retry here specifically: this check
  // runs before any onToken() delta has been emitted, so a retry is
  // invisible to the caller — no partial stream has reached the user yet.
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('event-stream')) {
    const text = await res.text().catch(() => '');
    let parsed: { error?: { message?: string; code?: number } } = {};
    try { parsed = JSON.parse(text); } catch { /* not JSON either — surfaced raw below */ }
    if (isTransientOpenRouterError(parsed.error) && attempt < OPENROUTER_MAX_ATTEMPTS) {
      await sleep(600 * attempt);
      continue;
    }
    throw new Error(parsed.error
      ? `OpenRouter generate error (code ${parsed.error.code ?? 'unknown'}): ${parsed.error.message}`
      : `OpenRouter generate: unexpected non-streaming response: ${text.slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return full.trim();
      let obj: { choices?: { delta?: { content?: string } }[] };
      try {
        obj = JSON.parse(payload);
      } catch {
        continue;
      }
      const delta = obj.choices?.[0]?.delta;
      // OpenRouter/OpenAI emit different delta keys per provider:
      //   - content             — standard answer text
      //   - reasoning_content   — hidden thinking from reasoning models
      //       (Gemma 3, Gemini Flash thinking, Claude). We intentionally
      //       NEVER stream reasoning chunks to the user (they read as
      //       garbled output) but we also mustn't confuse a reasoning-only
      //       delta with "end of stream". Continue accumulating until a
      //       real `content` delta arrives.
      //   - Array-of-parts delta: some providers send the same structured
      //       content shape as the non-streaming extraction handles above.
      let contentDelta = '';
      if (typeof delta?.content === 'string' && delta.content) {
        contentDelta = delta.content;
      } else if (Array.isArray(delta?.content)) {
        contentDelta = delta.content
          .filter(p => p && p.type !== 'tool_use' && typeof p.text === 'string')
          .map(p => (p as { text: string }).text)
          .join('');
      }
      if (contentDelta) {
        full += contentDelta;
        onToken(contentDelta);
      }
    }
  }
  return full.trim();
  }
  throw new Error('OpenRouter generate: exhausted retries against a transiently overloaded upstream');
}

// Dispatches chat generation to whichever provider KBConfig.generationProvider
// selects. Used by queryKB() for both the follow-up rewrite step and the
// final answer — NOT used by the AI Evaluation judge (src/lib/eval/judge.ts),
// which calls the exported generate() above directly and is intentionally
// kept on Ollama regardless of this setting.
async function generateViaProvider(
  config: Awaited<ReturnType<typeof loadKBConfig>>,
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; timeoutMs?: number; numPredict?: number } = {},
): Promise<string> {
  if (config.generationProvider === 'openrouter') {
    return generateOpenRouter(systemPrompt, userPrompt, config.openrouterModel || config.generationModel, opts);
  }
  return generate(systemPrompt, userPrompt, config.generationModel, opts);
}

async function generateViaProviderStreaming(
  config: Awaited<ReturnType<typeof loadKBConfig>>,
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; timeoutMs?: number; numPredict?: number },
  onToken: (delta: string) => void,
): Promise<string> {
  if (config.generationProvider === 'openrouter') {
    return generateOpenRouterStreaming(systemPrompt, userPrompt, config.openrouterModel || config.generationModel, opts, onToken);
  }
  return generateStreaming(systemPrompt, userPrompt, config.generationModel, opts, onToken);
}

// Resolves a follow-up question's pronouns/ellipsis (e.g. "How many are
// there?") into a standalone one using the immediately preceding Q&A turn,
// so retrieval doesn't have to guess what "there" refers to. Kept to a short
// timeout and small output budget — this runs on the hot path of every
// follow-up question, and a slow/failed rewrite must never block the actual
// answer, so any error just falls back to the original question unchanged.
async function rewriteFollowUp(
  question: string,
  history: { question: string; answer: string }[],
  config: Awaited<ReturnType<typeof loadKBConfig>>,
): Promise<string> {
  const context = history
    .map(h => `Q: ${h.question}\nA: ${h.answer}`)
    .join('\n\n');
  const systemPrompt =
    'Rewrite the follow-up question so it stands alone without needing the ' +
    'conversation above — resolve any pronoun or implicit reference (e.g. ' +
    '"it", "that one", "how many are there") using the prior exchange. ' +
    'Output ONLY the rewritten question, nothing else — no explanation, no ' +
    'quotes. If the follow-up already stands alone, output it unchanged.';
  const userPrompt = `Conversation so far:\n${context}\n\nFollow-up question: ${question}\n\nStandalone question:`;
  try {
    const rewritten = await generateViaProvider(config, systemPrompt, userPrompt, {
      temperature: 0,
      numPredict: 60,
      timeoutMs: 15_000,
    });
    const cleaned = rewritten.trim().replace(/^["']|["']$/g, '');
    return cleaned || question;
  } catch {
    return question;
  }
}

// ---------------------------------------------------------------------------
// Text chunking — recursive character splitting
// ---------------------------------------------------------------------------

const SEPARATORS = ['\n\n', '\n', '. ', ' '];

function splitRecursive(text: string, sepIdx: number, maxChars: number): string[] {
  if (text.length <= maxChars) return text.trim() ? [text] : [];
  if (sepIdx >= SEPARATORS.length) {
    const parts: string[] = [];
    for (let i = 0; i < text.length; i += maxChars) parts.push(text.slice(i, i + maxChars));
    return parts;
  }
  const sep = SEPARATORS[sepIdx];
  const segments = text.split(sep);
  const result: string[] = [];
  let buf = '';
  for (const seg of segments) {
    const candidate = buf ? buf + sep + seg : seg;
    if (candidate.length <= maxChars) {
      buf = candidate;
    } else {
      if (buf) result.push(...splitRecursive(buf, sepIdx + 1, maxChars));
      buf = seg;
    }
  }
  if (buf) result.push(...splitRecursive(buf, sepIdx + 1, maxChars));
  return result;
}

function chunkText(text: string, maxChars: number, overlap: number): string[] {
  const raw = splitRecursive(text.trim(), 0, maxChars).filter(c => c.trim());
  if (raw.length <= 1) return raw;
  return raw.map((chunk, i) => {
    if (i === 0) return chunk;
    const prev = raw[i - 1];
    let start = Math.max(0, prev.length - overlap);
    // Blindly cutting at a fixed offset lands mid-word (e.g. "Customer"
    // becomes "stomer"), which reads as garbled text — this measurably hurts
    // both embedding similarity and cross-encoder reranking, since neither
    // scores "stomer Centricity" as fluent English. Walk back to the start
    // of the word so the overlap keeps it whole instead of truncating it.
    while (start > 0 && !/\s/.test(prev[start - 1])) start--;
    const tail = prev.slice(start);
    // Gluing with a bare space discards the original break (usually a list
    // item or paragraph boundary), which visually and semantically fuses two
    // distinct items into what reads like one — e.g. separate list entries
    // "Collaboration" and "Diversity" became "Collaboration Diversity". A
    // newline is a safe default: it never fuses two items, and costs nothing
    // even where the true original separator was just a mid-sentence space.
    return (tail + '\n' + chunk).trim();
  });
}

// ---------------------------------------------------------------------------
// HTML → plain text for clean embedding (no tag noise)
// ---------------------------------------------------------------------------

// Sentinel wrapping a heading's text — lets splitIntoSections() find heading
// boundaries after tag-stripping, since plain text alone can't distinguish
// "Scale" the section header from any other line.
const HEADING_MARK = ' ';

// Converts <ul>/<ol> lists into comma-joined prose sentences instead of one
// line per <li>. The cross-encoder reranker (bge-reranker-base) scores
// newline-fragmented bullet text far below natural sentences for identical
// content — measured 0.07 vs 0.98 relevance score for the same list rendered
// as fragments vs. a sentence — which was silently rejecting correct answers
// whenever reranking was enabled. Vector embeddings and BM25 also read prose
// more naturally than bare fragments.
//
// Processes innermost lists first (repeats until no <ul>/<ol> remains) so
// nested lists — e.g. a sub-list under "Started with:" — resolve correctly;
// a single regex pass can't correctly bound a <ul>...</ul> that contains
// another <ul> of the same tag name.
function listsToProse(html: string): string {
  let result = html;
  let prev: string;
  do {
    prev = result;
    result = result.replace(
      /<(ul|ol)[^>]*>((?:(?!<ul\b|<ol\b)[\s\S])*?)<\/\1>/gi,
      (_match, _tag, inner) => {
        const items = Array.from((inner as string).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
          .map(m => m[1]
            .replace(/<[^>]+>/g, ' ')       // inline tags (e.g. <strong>) become spaces...
            .replace(/\s+([.,;:!?])/g, '$1') // ...so collapse "1999 ." back to "1999."
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[.\s]+$/, ''))         // drop each item's own trailing period —
          .filter(Boolean);                  // one is added once after joining, not per item
        if (!items.length) return '\n\n';
        if (items.length === 1) return ` ${items[0]}.\n\n`;
        const joined = items.length === 2
          ? `${items[0]} and ${items[1]}`
          : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
        // Trailing \n\n guarantees a paragraph break after the list — without
        // it, whatever HTML tag immediately follows (here, the next <p>) gets
        // glued directly onto this text with no separator at all, since
        // nothing else inserts a newline before an *opening* tag.
        return ` ${joined}.\n\n`;
      },
    );
  } while (result !== prev);
  return result;
}

function htmlToTextInner(html: string): string {
  return listsToProse(html)
    .replace(/<br\s*\/?>/gi, '\n')
    // Headings become hard section boundaries (see splitIntoSections) instead
    // of just another line — without this, unrelated sections (e.g. "Scale")
    // can end up sharing a chunk with the section before them (e.g. "Core
    // Values"), and the LLM has no way to tell they're not related.
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, `\n\n${HEADING_MARK}$1${HEADING_MARK}\n\n`)
    // <li> is deliberately absent here — listsToProse() already consumed
    // every <ul>/<ol>/<li> above, so none remain by this point.
    .replace(/<\/(?:p|blockquote|tr|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

// Many admins style section labels as a bold word/phrase + colon at the start
// of a paragraph ("Personal Saving Accounts: These are...") instead of using
// a real heading — with no HTML relationship at all to whatever list follows
// it, the indexer has no way to know that list belongs to that label
// specifically. This turns a paragraph-initial short label ending in a colon
// into the same kind of hard section boundary a real heading gets, so
// e.g. "Personal Saving Accounts" and its list of sub-account-types become
// their own chunk, separate from "Diaspora Accounts" and the other sibling
// account types that follow — instead of one page-wide chunk where the LLM
// can no longer tell which items belong under which label.
function markPseudoHeadings(text: string): string {
  return text.replace(
    /(^|\n)([A-Z][A-Za-z0-9 &'/-]{1,45}?) *: */g,
    (_match, lineStart, label) => `${lineStart}\n\n${HEADING_MARK}${label}${HEADING_MARK}\n\n`,
  );
}

function htmlToText(html: string): string {
  return markPseudoHeadings(htmlToTextInner(html))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Splits htmlToText() output into sections at heading boundaries, so callers
// can chunk each section independently and never blend two unrelated topics
// into one chunk. Text before the first heading (if any) has heading: null.
function splitIntoSections(text: string): { heading: string | null; body: string }[] {
  const parts = text.split(HEADING_MARK);
  const sections: { heading: string | null; body: string }[] = [];
  if (parts[0]?.trim()) sections.push({ heading: null, body: parts[0].trim() });
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i]?.trim() || null;
    const body = parts[i + 1]?.trim() || '';
    if (heading || body) sections.push({ heading, body });
  }
  return sections.length ? sections : [{ heading: null, body: text.trim() }];
}

// Chunks text section-by-section so two unrelated headings (e.g. "Core
// Values" and "Scale") never end up sharing a chunk — chunkText() alone has
// no concept of topic boundaries and will happily pack adjacent sections
// together whenever they fit under maxChars. Each section's chunks are
// prefixed with its own heading so the topic label travels with the content
// even after overlap trimming.
function chunkStructuredText(prefix: string, text: string, maxChars: number, overlap: number): string[] {
  const sections = splitIntoSections(text);
  const chunks: string[] = [];
  for (const { heading, body } of sections) {
    if (!body) continue;
    // Every section gets the page identity (breadcrumb/page name), not just
    // the first one — otherwise a query like "When was NIB established?"
    // can't lexically or semantically anchor to an isolated "History"
    // section that (correctly, for a human reader) never repeats "NIB"
    // itself, since the reader already knows what page they're on.
    const label = [prefix, heading].filter(Boolean).join('\n');
    const sectionText = label ? `${label}\n${body}` : body;
    chunks.push(...chunkText(sectionText, maxChars, overlap));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Breadcrumb — walks parent chain upward
// ---------------------------------------------------------------------------

async function buildBreadcrumb(menuId: string): Promise<string> {
  const path: string[] = [];
  let currentId: string | null = menuId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const row: { name: string; parentId: string | null } | null = await prisma.menuItem.findUnique({
      where: { id: currentId },
      select: { name: true, parentId: true },
    });
    if (!row) break;
    path.unshift(row.name);
    currentId = row.parentId ?? null;
  }
  return path.join(' > ');
}

// ---------------------------------------------------------------------------
// Indexing
// ---------------------------------------------------------------------------

export async function deleteMenuChunks(menuId: string): Promise<void> {
  await prisma.kBChunk.deleteMany({ where: { menuId } });
}

// force=true: admin-initiated index — skips approval gate (menu must still be active + kbEnabled + static)
// force=false (default): auto-triggered on save/approve — only indexes fully-approved menus
export async function indexMenu(menuId: string, force = false): Promise<void> {
  const menu = await prisma.menuItem.findUnique({
    where: { id: menuId },
    select: {
      id: true, name: true, nameAm: true,
      content: true, contentAm: true, translations: true,
      isActive: true, approvalStatus: true, kbEnabled: true,
      responseType: true,
    },
  });

  if (!menu || !menu.isActive || !menu.kbEnabled) {
    await deleteMenuChunks(menuId);
    return;
  }

  // Only static-type menus carry human-authored text suitable for KB indexing.
  // API and report menus produce dynamic/live data that is meaningless when chunked.
  if (menu.responseType !== 'static') {
    await deleteMenuChunks(menuId);
    return;
  }

  // Approval gate: auto-triggered calls respect the checker workflow;
  // admin-forced calls can index pending menus immediately.
  if (!force && menu.approvalStatus !== 'approved') {
    await deleteMenuChunks(menuId);
    return;
  }

  const breadcrumb = await buildBreadcrumb(menuId);
  const config = await getKBConfig();

  // buildBreadcrumb() already ends with the menu's own (English) name, so
  // appending it again duplicates it ("About Us\nAbout Us\n..." in every
  // chunk). Only actually adds something new for a translated name, which
  // differs from the breadcrumb's English leaf segment.
  const withName = (name: string) =>
    breadcrumb.split(' > ').pop() === name ? breadcrumb : [breadcrumb, name].filter(Boolean).join('\n');

  // Build per-language (prefix, content) pairs — prefix (breadcrumb + page
  // name) is carried into every section's chunks by chunkStructuredText,
  // not just folded once into the front of the whole document.
  const langTexts: { lang: string; prefix: string; text: string }[] = [];

  const enText = htmlToText(menu.content ?? '');
  if (enText.trim().length > 10) {
    langTexts.push({ lang: 'en', prefix: withName(menu.name), text: enText });
  }

  const amText = htmlToText(menu.contentAm || menu.content || '');
  if (amText.trim().length > 10 && (menu.nameAm || menu.contentAm)) {
    langTexts.push({ lang: 'am', prefix: withName(menu.nameAm || menu.name), text: amText });
  }

  if (menu.translations && typeof menu.translations === 'object') {
    for (const [lang, val] of Object.entries(menu.translations as Record<string, any>)) {
      if (!lang || lang === 'en' || lang === 'am') continue;
      const name = typeof val?.name === 'string' ? val.name : '';
      const content = typeof val?.content === 'string' ? htmlToText(val.content) : '';
      if (content.trim().length > 10) {
        langTexts.push({ lang, prefix: withName(name || menu.name), text: content });
      }
    }
  }

  // Wipe stale chunks before re-indexing
  await deleteMenuChunks(menuId);

  for (const { lang, prefix, text } of langTexts) {
    const chunks = chunkStructuredText(prefix, text, config.chunkSize, config.chunkOverlap);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].trim();
      if (!chunk) continue;
      const row = await prisma.kBChunk.upsert({
        where: { menuId_chunkIndex_lang: { menuId, chunkIndex: i, lang } },
        create: { menuId, chunkIndex: i, text: chunk, lang, tokenCount: Math.ceil(chunk.length / 4) },
        update: { text: chunk, tokenCount: Math.ceil(chunk.length / 4) },
      });
      try {
        const vec = await embed(chunk, config.embeddingModel);
        const vecStr = `[${vec.join(',')}]`;
        await prisma.$executeRaw`
          UPDATE kb_chunks SET "embedding" = ${vecStr}::vector WHERE id = ${row.id}
        `;
      } catch (err) {
        console.error(`[KB] embed failed menuId=${menuId} chunkIndex=${i}:`, err);
        // Row exists but embedding is null — excluded from search until rebuilt
      }
    }
  }
}

export async function rebuildAll(): Promise<{ indexed: number; failed: number }> {
  const menus = await prisma.menuItem.findMany({
    where: { isActive: true, kbEnabled: true, responseType: 'static' },
    select: { id: true },
  });
  const articles = await prisma.kBArticle.findMany({
    where: { enabled: true },
    select: { id: true },
  });
  let indexed = 0;
  let failed = 0;
  for (const { id } of menus) {
    try {
      await indexMenu(id, true);
      indexed++;
    } catch (err) {
      failed++;
      console.error(`[KB] rebuild failed menuId=${id}:`, err);
    }
  }
  for (const { id } of articles) {
    try {
      await indexArticle(id);
      indexed++;
    } catch (err) {
      failed++;
      console.error(`[KB] rebuild failed articleId=${id}:`, err);
    }
  }
  return { indexed, failed };
}

// ---------------------------------------------------------------------------
// Article indexing
// ---------------------------------------------------------------------------

export async function deleteArticleChunks(articleId: string): Promise<void> {
  await prisma.kBChunk.deleteMany({ where: { articleId } });
}

export async function indexArticle(articleId: string): Promise<void> {
  const article = await prisma.kBArticle.findUnique({ where: { id: articleId } });
  if (!article) {
    await deleteArticleChunks(articleId);
    return;
  }

  // Disabled articles are still indexed (chunks + embeddings exist) so admin
  // "Test AI" can still search them — `enabled` only gates whether real
  // end-user queries can see them, via the ka.enabled check in hybridSearch().
  // Without this, a disabled article would have zero chunks and be
  // impossible to test at all, defeating the point of disabling it to
  // preview/QA before going live.
  const config = await getKBConfig();

  // Multi-language like indexMenu(): title/body is English, titleAm/bodyAm is
  // Amharic, translations covers any other configured language. article.body
  // etc. are admin-authored HTML (same WYSIWYG editor as menu content) — it
  // was never stripped here before, so every article chunk carried raw
  // <p>/<span style="..."> tag soup into both the embedding and the LLM
  // context. htmlToText() is exactly what indexMenu() already applies to
  // menu content; article bodies need the same treatment.
  const langTexts: { lang: string; title: string; text: string }[] = [];

  const enText = htmlToText(article.body);
  if (enText.trim().length > 10) langTexts.push({ lang: 'en', title: article.title, text: enText });

  const amText = htmlToText(article.bodyAm || '');
  if (amText.trim().length > 10) {
    langTexts.push({ lang: 'am', title: article.titleAm || article.title, text: amText });
  }

  if (article.translations && typeof article.translations === 'object') {
    for (const [lang, val] of Object.entries(article.translations as Record<string, any>)) {
      if (!lang || lang === 'en' || lang === 'am') continue;
      const title = typeof val?.title === 'string' ? val.title : article.title;
      const body = typeof val?.body === 'string' ? htmlToText(val.body) : '';
      if (body.trim().length > 10) langTexts.push({ lang, title, text: body });
    }
  }

  // Wipe stale chunks before re-indexing — matches indexMenu()'s pattern and
  // avoids needing to reconcile per-language chunk counts against a shared
  // "beyond current count" cutoff, which would risk deleting a different
  // language's valid chunks if languages produce different chunk counts.
  await deleteArticleChunks(articleId);
  if (!langTexts.length) return;

  for (const { lang, title, text } of langTexts) {
    const chunks = chunkStructuredText(title, text, config.chunkSize, config.chunkOverlap);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].trim();
      if (!chunk) continue;
      const tokenCount = Math.ceil(chunk.length / 4);

      const row = await prisma.kBChunk.create({
        data: { articleId, chunkIndex: i, text: chunk, lang, tokenCount },
      });
      try {
        const vec = await embed(chunk, config.embeddingModel);
        const vecStr = `[${vec.join(',')}]`;
        await prisma.$executeRaw`
          UPDATE kb_chunks SET embedding = ${vecStr}::vector WHERE id = ${row.id}
        `;
      } catch (err) {
        console.error(`[KB] article embed failed articleId=${articleId} lang=${lang} chunkIndex=${i}:`, err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Hybrid search — vector (pgvector) + BM25 (tsvector), merged via RRF
// Searches both menu chunks and article chunks in a single query.
// ---------------------------------------------------------------------------

type ChunkRow = {
  id: number;
  menuId: string;  // contains articleId for article-sourced chunks
  menuName: string;  // contains article title for article-sourced chunks
  text: string;
  vecScore: number;
};

// plainto_tsquery ANDs every word together — a question like "What are NIB's
// core values?" requires "what", "are", and "nib" to ALL appear in a chunk,
// which most short, topically-focused chunks won't contain even when they're
// exactly the right answer (e.g. a "Core Values" chunk with no reason to
// mention "NIB"). That silently zeroes out the BM25 half of hybrid search for
// most natural-language questions. OR-ing the terms instead makes BM25 do
// what it's actually for here — lexical recall — while the vector half and
// RRF fusion still provide precision.
function buildOrTsQuery(question: string): string {
  const words = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.join(' | ');
}

// ---------------------------------------------------------------------------
// Query normalization — neither embeddings nor the cross-encoder reranker
// have any built-in tolerance for misspellings, and the reranker in
// particular was measured to be highly sensitive to acronym casing: "NIB"
// scored 6x higher than "nib" against an identical passage, because lowercase
// "nib" also reads as an ordinary English word (a pen nib) unrelated to the
// bank, confusing the model's relevance judgment. A single typo on the one
// keyword anchoring a question ("vission" vs "vision") separately collapsed
// the reranker's score for the otherwise-correct chunk by ~400x. Correcting
// spelling AND restoring each term's dominant casing — as it actually appears
// in the indexed content — before embedding/reranking fixes both at the
// source, rather than trying to make retrieval tolerate them after the fact.
// ---------------------------------------------------------------------------

const VOCAB_CACHE_MS = 60_000; // vocabulary only changes when content is reindexed
type Vocabulary = { words: Set<string>; casing: Map<string, string> };
let cachedVocabulary: { data: Vocabulary; expiresAt: number } | null = null;

async function getVocabulary(): Promise<Vocabulary> {
  if (cachedVocabulary && cachedVocabulary.expiresAt > Date.now()) return cachedVocabulary.data;
  const rows = await prisma.kBChunk.findMany({ select: { text: true } });
  const words = new Set<string>();
  const casingCounts = new Map<string, Map<string, number>>();
  for (const { text } of rows) {
    for (const w of text.match(/[\p{L}\p{N}]+/gu) ?? []) {
      const lower = w.toLowerCase();
      if (lower.length < 3) continue;
      words.add(lower);
      const counts = casingCounts.get(lower) ?? new Map<string, number>();
      counts.set(w, (counts.get(w) ?? 0) + 1);
      casingCounts.set(lower, counts);
    }
  }
  // Pick whichever exact casing appears most often for each word — e.g. "NIB"
  // wins over "Nib" or "nib" because the content overwhelmingly writes it
  // that way when used as a standalone acronym.
  const casing = new Map<string, string>();
  for (const [lower, counts] of casingCounts) {
    let best = lower;
    let bestCount = 0;
    for (const [form, count] of counts) {
      if (count > bestCount) { bestCount = count; best = form; }
    }
    casing.set(lower, best);
  }
  const data = { words, casing };
  cachedVocabulary = { data, expiresAt: Date.now() + VOCAB_CACHE_MS };
  return data;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// A narrow KB vocabulary can't tell "genuine typo of a domain term" apart
// from "ordinary English word this KB just never happens to use verbatim" —
// checking "What are NIB's core values?" against real content corrected
// "What" to "that" (edit distance 1) purely because "what" never appears in
// this KB's text, silently mangling the question into "that are NIB's Core
// values?" and breaking retrieval. Exempting common function words (which
// are near-universally spelled correctly, so there's nothing to gain by
// "correcting" them anyway) from typo-correction avoids this without losing
// the ability to fix genuine domain-term typos like "vission" -> "vision".
const COMMON_WORDS = new Set([
  'what', 'when', 'where', 'who', 'whom', 'whose', 'which', 'why', 'how',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'do', 'does', 'did', 'doing', 'done',
  'have', 'has', 'had', 'having',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  'the', 'this', 'that', 'these', 'those',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'about', 'into', 'through',
  'and', 'or', 'but', 'if', 'then', 'else', 'so', 'because', 'as',
  'not', 'all', 'any', 'some', 'many', 'much', 'more', 'most', 'other',
  'you', 'your', 'yours', 'we', 'our', 'they', 'their', 'them', 'it', 'its', 'he', 'she', 'his', 'her',
  'please', 'tell', 'give', 'know', 'need', 'want', 'like', 'get', 'make',
]);

// Common phrasing gaps between how users ask and how content is written —
// not typos, genuinely different words for the same thing. Measured
// concretely: "head office" (idiomatic) scored the correct "Headquarters"
// chunk at 0.0225 on rerank (effectively noise level) and ranked it 8th by
// vector similarity, even though it's exactly the right answer, because
// neither the embedding model nor the reranker treat "head office" and
// "Headquarters" as close enough. Rewriting the query to the content's own
// wording before embedding/reranking closes that gap directly, rather than
// loosening thresholds system-wide (which would let genuine noise through
// on unrelated questions too). Extend this list as similar gaps get found —
// each entry should be a case that's actually been observed to fail.
const QUERY_SYNONYMS: [RegExp, string][] = [
  [/\bhead\s*office\b/gi, 'headquarters'],
  [/\bmain\s*office\b/gi, 'headquarters'],
  [/\bhq\b/gi, 'headquarters'],
];

function expandSynonyms(text: string): string {
  let result = text;
  for (const [pattern, replacement] of QUERY_SYNONYMS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// Corrects obvious misspellings against the KB's own vocabulary, and restores
// each recognized word's dominant casing from the indexed content (e.g.
// "nib" -> "NIB"). Typo correction is deliberately conservative — only words
// at least 4 letters long (shorter words have too many near-neighbors to
// correct safely), not a common word (see COMMON_WORDS above), not already
// in the vocabulary, and within a tight edit-distance budget scaled to word
// length; a missed typo just falls back to today's behavior, but an
// over-eager correction could silently change what the user asked. Casing
// restoration only ever changes letter case, never the word itself, so it
// carries no such risk and applies to every recognized word regardless of
// length.
async function normalizeQuery(question: string): Promise<string> {
  const { words, casing } = await getVocabulary();
  const tokens = question.split(/(\s+)/);
  return tokens.map(token => {
    const word = token.toLowerCase();
    if (!/^[\p{L}]+$/u.test(word) || word.length < 3) return token;

    if (words.has(word)) return casing.get(word) ?? token;
    if (word.length < 4 || COMMON_WORDS.has(word)) return token;

    // Ties matter: "vission" is exactly 1 edit from BOTH "vision" and
    // "mission" — confidently "correcting" to one of them is a coin flip
    // that was observed to silently answer about the wrong topic entirely.
    // Whichever one won before depended on Set iteration order (insertion
    // order of chunk rows), which shifts whenever content gets reindexed —
    // not a real signal of which correction is right. When multiple
    // candidates tie for best distance, it's genuinely ambiguous: leave the
    // word uncorrected rather than guess.
    const maxDist = word.length <= 5 ? 1 : 2;
    let best: string | null = null;
    let bestDist = Infinity;
    let tieCount = 0;
    for (const candidate of words) {
      if (Math.abs(candidate.length - word.length) > maxDist) continue;
      const dist = levenshtein(word, candidate);
      if (dist < bestDist) { bestDist = dist; best = candidate; tieCount = 1; }
      else if (dist === bestDist) { tieCount++; }
    }
    if (!best || bestDist > maxDist || tieCount > 1) return token;
    return casing.get(best) ?? best;
  }).join('');
}

async function hybridSearch(
  queryVec: number[],
  question: string,
  lang: string,
  fetchLimit: number,
  // Real end-user queries must never see disabled articles; the admin
  // "Test AI" tool passes true so an article can be authored/QA'd before
  // being switched on for the public.
  includeDisabledArticles: boolean = false,
): Promise<(ChunkRow & { score: number })[]> {
  const vecStr = `[${queryVec.join(',')}]`;
  const limit = fetchLimit;
  const orTsQuery = buildOrTsQuery(question);
  // 'simple' does no stemming at all — "contact" and "Contacts" are two
  // unrelated lexemes to it, so a lexically-obvious match can score zero.
  // 'english' stems both to the same root. Only English content benefits;
  // Amharic ('am') has no matching Postgres text-search config, so it stays
  // on 'simple' (still gets BM25 recall on exact word forms, just no stemming).
  const tsConfig = lang === 'en' ? 'english' : 'simple';

  const [vecRows, bm25Rows] = await Promise.all([
    prisma.$queryRaw<(ChunkRow & { vec_score: number })[]>`
      SELECT kc.id,
             COALESCE(kc."menuId", kc."articleId") AS "menuId",
             COALESCE(mi.name, ka.title)            AS "menuName",
             kc.text,
             (1 - (kc.embedding <=> ${vecStr}::vector))::float AS "vec_score"
      FROM   kb_chunks kc
      LEFT JOIN menu_items  mi ON kc."menuId"    = mi.id
      LEFT JOIN kb_articles ka ON kc."articleId" = ka.id
      WHERE  kc.lang = ${lang}
        AND  kc.embedding IS NOT NULL
        AND  (
               (kc."menuId"    IS NOT NULL AND mi."isActive" = true AND mi."kb_enabled" = true)
            OR (kc."articleId" IS NOT NULL AND (ka.enabled = true OR ${includeDisabledArticles}))
             )
      ORDER  BY kc.embedding <=> ${vecStr}::vector
      LIMIT  ${limit}
    `,
    orTsQuery ? prisma.$queryRaw<(ChunkRow & { bm25_score: number })[]>`
      SELECT kc.id,
             COALESCE(kc."menuId", kc."articleId") AS "menuId",
             COALESCE(mi.name, ka.title)            AS "menuName",
             kc.text,
             ts_rank(to_tsvector(${tsConfig}::regconfig, kc.text),
                     to_tsquery(${tsConfig}::regconfig, ${orTsQuery}))::float AS "bm25_score"
      FROM   kb_chunks kc
      LEFT JOIN menu_items  mi ON kc."menuId"    = mi.id
      LEFT JOIN kb_articles ka ON kc."articleId" = ka.id
      WHERE  kc.lang = ${lang}
        AND  to_tsvector(${tsConfig}::regconfig, kc.text) @@ to_tsquery(${tsConfig}::regconfig, ${orTsQuery})
        AND  (
               (kc."menuId"    IS NOT NULL AND mi."isActive" = true AND mi."kb_enabled" = true)
            OR (kc."articleId" IS NOT NULL AND (ka.enabled = true OR ${includeDisabledArticles}))
             )
      LIMIT  ${limit}
    ` : Promise.resolve([]),
  ]);

  // Build rank maps (1-based)
  const vecRank = new Map<number, number>();
  const bm25Rank = new Map<number, number>();
  vecRows.forEach((r, i) => vecRank.set(Number(r.id), i + 1));
  bm25Rows.forEach((r, i) => bm25Rank.set(Number(r.id), i + 1));

  // Merge unique chunks
  const chunkMap = new Map<number, ChunkRow & { vecScore: number }>();
  for (const r of vecRows) {
    chunkMap.set(Number(r.id), {
      id: Number(r.id), menuId: r.menuId, menuName: r.menuName,
      text: r.text, vecScore: r.vec_score,
    });
  }
  for (const r of bm25Rows) {
    if (!chunkMap.has(Number(r.id))) {
      chunkMap.set(Number(r.id), {
        id: Number(r.id), menuId: r.menuId, menuName: r.menuName,
        text: r.text, vecScore: 0,
      });
    }
  }

  // RRF: score = 1/(K+vec_rank) + 1/(K+bm25_rank)
  const K = 60;
  const scored = Array.from(chunkMap.values()).map(chunk => {
    const vr = vecRank.get(chunk.id) ?? (limit + 1);
    const br = bm25Rank.get(chunk.id) ?? (limit + 1);
    return { ...chunk, score: 1 / (K + vr) + 1 / (K + br) };
  });

  // Return the whole candidate pool (up to topK*4) — callers that don't rerank
  // should slice to topK themselves; rerankWithLLM needs the extra headroom.
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ---------------------------------------------------------------------------
// Cross-encoder reranking — calls a dedicated reranker microservice (e.g.
// bge-reranker-base served via a small FastAPI/sentence-transformers process,
// see reranker-service/). Unlike the generation/embedding models, a
// cross-encoder isn't an instruction-following chat model, so it can't run
// through Ollama's /api/chat — it needs its own service exposing POST /rerank.
// Falls back to plain RRF order (and vecScore-based confidence) on any
// failure so a down/slow reranker degrades gracefully instead of blocking.
// ---------------------------------------------------------------------------

export type RerankedChunk = ChunkRow & { score: number; rerankScore: number };

async function rerankWithCrossEncoder(
  question: string,
  candidates: (ChunkRow & { score: number })[],
  topK: number,
): Promise<RerankedChunk[] | null> {
  if (!candidates.length) return [];

  try {
    const res = await fetchWithRetry(`${RERANKER_URL}/rerank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: question,
        passages: candidates.map(c => c.text.slice(0, 512)),
      }),
      // Cross-encoder inference over a small pool is much cheaper than LLM
      // generation — a short timeout is enough, and keeps a down/slow
      // reranker service from stalling the whole query.
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Reranker service ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { scores?: number[] };
    if (!Array.isArray(data.scores) || data.scores.length !== candidates.length) {
      throw new Error('Reranker service returned malformed scores');
    }
    return candidates
      .map((c, i) => ({ ...c, rerankScore: data.scores![i] }))
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topK);
  } catch (err) {
    console.error('[KB] cross-encoder rerank failed, falling back to RRF order:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Security — question sanitization & rate limiting
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions?/i,
  /forget\s+(everything|all|previous)/i,
  /you\s+are\s+now\s+/i,
  /act\s+as\s+(?:a\s+)?(?:different|new|another)/i,
  /\bjailbreak\b/i,
  /^system\s*:/im,
  /\[system\]/i,
  /\[\/inst\]/i,
  /<\|im_start\|>/i,
];

export function sanitizeQuestion(raw: string): string {
  if (typeof raw !== 'string') throw Object.assign(new Error('invalid_question'), { code: 400 });
  const q = raw.trim().replace(/<[^>]*>/g, '');
  if (q.length === 0) throw Object.assign(new Error('empty_question'), { code: 400 });
  if (q.length > 500) throw Object.assign(new Error('question_too_long'), { code: 400 });
  for (const p of INJECTION_PATTERNS) {
    if (p.test(q)) throw Object.assign(new Error('invalid_question'), { code: 400 });
  }
  return q;
}

// In-memory rate limiter (per sessionId): 10 queries/minute
const rlMap = new Map<string, { count: number; resetAt: number }>();
const RL_LIMIT = 10;
const RL_WINDOW = 60_000;

function checkRateLimit(sessionId: string): void {
  const now = Date.now();
  const entry = rlMap.get(sessionId);
  if (!entry || entry.resetAt < now) {
    rlMap.set(sessionId, { count: 1, resetAt: now + RL_WINDOW });
    return;
  }
  if (entry.count >= RL_LIMIT) {
    throw Object.assign(new Error('rate_limit_exceeded'), { code: 429 });
  }
  entry.count++;
}

// Periodically clear expired rate-limit entries to prevent memory growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of rlMap) if (v.resetAt < now) rlMap.delete(k);
  }, 5 * 60_000);
}

// ---------------------------------------------------------------------------
// Public query API
// ---------------------------------------------------------------------------

export type KBSource = { menuId: string; menuName: string; score: number };

export type KBResult =
  | { noAnswer: true; suggestedMenus: { id: string; name: string }[]; queryLogId: number | null }
  | { noAnswer: false; answer: string; sources: KBSource[]; confidence: 'high' | 'medium' | 'low'; queryLogId: number | null };

// ---------------------------------------------------------------------------
// Evaluation trace — an optional, caller-supplied side channel (see
// src/lib/eval/runner.ts). When opts.trace below is passed, queryKB() fills
// it in as it goes so an evaluation run can score retrieval/context/
// generation against exactly what a real user's request would have done —
// without changing KBResult's shape or adding any cost for ordinary callers
// (/api/kb/query, admin Test AI), which never pass it.
// ---------------------------------------------------------------------------
export type QueryTraceChunk = { id: number; menuId: string; menuName: string; text: string; vecScore: number; score: number };
export type QueryTraceRerankedChunk = QueryTraceChunk & { rerankScore: number };

export type QueryTrace = {
  config?: Awaited<ReturnType<typeof loadKBConfig>>;
  searchQ?: string;
  pool?: QueryTraceChunk[];
  willRerank?: boolean;
  reranked?: QueryTraceRerankedChunk[] | null;
  usedVecConfidence?: boolean;
  isEnumeration?: boolean;
  backfilledIds?: number[];
  chunks?: (QueryTraceChunk & { rerankScore?: number })[];
  topScore?: number;
  scoreThreshold?: number;
  confidence?: 'high' | 'medium' | 'low';
  systemPrompt?: string;
  context?: string;
  noAnswer?: boolean;
  queryLogId?: number | null;
  timings?: {
    rewriteMs: number | null; normalizeMs: number | null; embedMs: number | null;
    retrieveMs: number | null; rerankMs: number | null; generateMs: number | null;
    totalMs: number;
  };
  error?: string;
};

export async function queryKB(
  question: string,
  lang: string,
  sessionId: string,
  opts: {
    includeDisabledArticles?: boolean;
    history?: { question: string; answer: string }[];
    // When provided, the final answer is generated via Ollama's streaming
    // API and fired here delta-by-delta as it arrives, instead of waiting
    // for the entire ~600-token answer before returning anything. Every
    // step before generation (retrieval, reranking, confidence gating)
    // is unchanged either way — it inherently can't stream since later
    // steps depend on its result.
    onToken?: (delta: string) => void;
    // Evaluation-only side channel — see QueryTrace above. Never set by
    // production callers.
    trace?: QueryTrace;
  } = {},
): Promise<KBResult> {
  const includeDisabledArticles = opts.includeDisabledArticles ?? false;
  const startMs = Date.now();
  const cleanQ = sanitizeQuestion(question);
  checkRateLimit(sessionId);

  const config = await getKBConfig();
  if (!config.enabled) {
    throw Object.assign(new Error('kb_disabled'), { code: 503 });
  }
  if (opts.trace) opts.trace.config = config;

  // ---- Per-stage timing accumulators (ms) ---------------------------------
  // Every stage below writes its wall-clock time here; null means "never ran
  // or was skipped" (important for analysis — a 0 looks like the stage ran
  // instantly, which is wrong). All values are written to the audit log by
  // the three INSERT statements below (answer / no-answer / error).
  //
  // Declared here, before the try, rather than inside it (as originally
  // written) — the catch block below reads these same variables for its own
  // error-path audit-log insert, but a `let` declared inside a try block is
  // out of scope in the corresponding catch block (confirmed via
  // `tsc --noEmit`: TS2304 "Cannot find name" on all eight names). That
  // catch path would have thrown a fresh ReferenceError the moment it ever
  // actually ran (Ollama down/timeout) instead of logging the failure.
  // Hoisting the declarations to function scope fixes that with no change
  // to what gets recorded on the success/no-answer paths.
  let rewriteMs: number | null = null;
  let normalizeMs: number | null = null;
  let embedMs: number | null = null;
  let retrieveMs: number | null = null;
  let rerankMs: number | null = null;
  let generateMs: number | null = null;
  let contextChunks: number | null = null;
  let tokensOut: number | null = null;
  const mark = () => Date.now();

  // Everything below can fail on a real infra problem (Ollama unreachable or
  // too slow to answer in time) rather than a KB content gap. Those two
  // outcomes need to be told apart in the logs: a low-confidence "No Answer"
  // means we looked and found nothing usable, while a caught exception here
  // means we never got to look. The catch below logs the latter case to both
  // kb_query_logs (errorType set) and interaction_logs (status: 'error'),
  // then rethrows so the API route's existing 503/500 handling is untouched.
  try {

    // The KB pipeline is otherwise fully stateless per request — a follow-up
    // like "How many are there?" has no antecedent for "there" on its own,
    // and was measured retrieving a completely unrelated chunk (branch/ATM
    // counts instead of the previous turn's core-values count) when sent
    // as-is. When the caller supplies the prior turn, resolve pronouns/
    // ellipsis against it first so retrieval runs on a standalone question.
    // Only runs when there's history (i.e. never adds latency to a first
    // turn), and any failure just falls back to the original question.
    let rewrittenQ: string | null = null;
    if (opts.history?.length) {
      const t0 = mark();
      rewrittenQ = await rewriteFollowUp(cleanQ, opts.history, config);
      rewriteMs = mark() - t0;
    }
    const effectiveQ = rewrittenQ ?? cleanQ;

    // Retrieval/generation use the typo-corrected, synonym-expanded question;
    // kb_query_logs and interactionLog below intentionally keep logging the
    // original `cleanQ` — audit trails should reflect what the user actually typed.
    const tNorm = mark();
    const searchQ = await normalizeQuery(expandSynonyms(effectiveQ));
    normalizeMs = mark() - tNorm;
    if (opts.trace) opts.trace.searchQ = searchQ;

    const tEmbed = mark();
    const qVec = await embed(searchQ, config.embeddingModel);
    embedMs = mark() - tEmbed;

    // Retrieve a wider pool when reranking so the cross-encoder has real
    // candidates to sort through (config.rerankPoolSize, e.g. 15 → rerank → topK).
    // Without reranking, RRF alone is noisier, so we still over-fetch topK*4.
    // Reranking only actually runs for English (see below), so non-English
    // queries use the same over-fetch as the reranker-disabled case.
    const willRerank = config.rerankerEnabled && lang === 'en';
    const fetchLimit = willRerank
      ? Math.max(config.rerankPoolSize, config.topK)
      : config.topK * 4;
    const tRet = mark();
    let pool = await hybridSearch(qVec, searchQ, lang, fetchLimit, includeDisabledArticles);
    retrieveMs = mark() - tRet;

    // A standalone rewrite necessarily names the entity the pronoun referred
    // to (e.g. "it" -> "NIB") to be valid on its own — but in a single-
    // organization KB, that name is ubiquitous across almost every chunk, so
    // adding it can dilute vector-similarity precision for a follow-up that
    // was already unambiguous by itself. Measured concretely: "When did it
    // start operations?" alone correctly matched the exact History chunk;
    // rewritten to "When did Nib International Bank start operations?" it
    // lost to a "25 years of operation" Scale chunk instead. Retrieving on
    // the original wording too and merging (keeping each chunk's best score
    // across both) recovers that case while keeping the rewrite's benefit
    // for follow-ups like "How many are there?", whose original wording
    // alone has no distinctive content word to retrieve on at all.
    if (rewrittenQ && rewrittenQ !== cleanQ) {
      const tN0 = mark();
      const rawSearchQ = await normalizeQuery(expandSynonyms(cleanQ));
      normalizeMs = (normalizeMs ?? 0) + (mark() - tN0);
      const tE0 = mark();
      const rawVec = await embed(rawSearchQ, config.embeddingModel);
      embedMs = (embedMs ?? 0) + (mark() - tE0);
      const tR0 = mark();
      const rawPool = await hybridSearch(rawVec, rawSearchQ, lang, fetchLimit, includeDisabledArticles);
      retrieveMs = (retrieveMs ?? 0) + (mark() - tR0);
      const merged = new Map<number, ChunkRow & { score: number }>();
      for (const c of [...pool, ...rawPool]) {
        const existing = merged.get(c.id);
        if (!existing || c.score > existing.score) merged.set(c.id, c);
      }
      pool = Array.from(merged.values()).sort((a, b) => b.score - a.score);
    }

    if (opts.trace) {
      opts.trace.willRerank = willRerank;
      opts.trace.pool = pool.map(c => ({
        id: c.id, menuId: c.menuId, menuName: c.menuName, text: c.text, vecScore: c.vecScore, score: c.score,
      }));
    }

    // Rerank (if enabled) before computing confidence — the cross-encoder's own
    // relevance score is what should gate the answer, not the pre-rerank RRF
    // order. A failed/timed-out reranker falls back to plain RRF + vecScore.
    //
    // Only applied for English: bge-reranker-base was measured scoring a
    // verified-correct Amharic chunk at 0.05 (vs 0.00006 for a wrong one —
    // real discrimination exists, but the whole scale sits far below
    // rerank_min_score). This looks like the model being poorly calibrated
    // for Amharic/Ge'ez script generally, not a threshold to retune — plain
    // vector search already handles Amharic well (0.70 for that same correct
    // chunk, comfortably above min_score), so non-English languages skip
    // reranking entirely rather than being gated by a scale that doesn't hold.
    let chunks: (ChunkRow & { score: number })[];
    let topScore: number;
    let scoreThreshold: number;
    // Tracks which score field actually determined confidence — normally
    // that's rerankScore whenever reranking ran, but the vector-confidence
    // fallback below can override that for a specific query, and the
    // per-chunk relevance filter further down needs to filter on whichever
    // field actually decided the outcome, not just "did reranking run."
    let usedVecConfidence = false;

    const tRerank = mark();
    const reranked = willRerank
      ? await rerankWithCrossEncoder(searchQ, pool, config.topK)
      : null;
    if (willRerank) rerankMs = mark() - tRerank;

    if (reranked) {
      chunks = reranked;
      topScore = reranked[0]?.rerankScore ?? 0;
      scoreThreshold = config.rerankMinScore;

      // Measured the cross-encoder scoring the *same correct chunk* at 0.09
      // for "Tell me about NIB's core values" but 0.44 for "what are nib bank
      // core values" — a ~5x swing on a trivial rewording, while that
      // chunk's plain vector similarity stayed stable (~0.56) across both.
      // A low rerank score alone isn't reliable enough to declare "No
      // Answer" when a more stable signal disagrees: if vector search is
      // confidently on-topic for the chunk the reranker itself ranked best,
      // trust that instead of the volatile cross-encoder verdict. Only
      // kicks in when the reranker would otherwise reject the answer, so a
      // genuinely confident rerank result is never second-guessed.
      const rerankConfidence: 'high' | 'medium' | 'low' =
        topScore >= 0.85 ? 'high' : topScore >= scoreThreshold ? 'medium' : 'low';
      if (rerankConfidence === 'low') {
        const vecTopScore = Math.max(0, ...chunks.map(c => c.vecScore));
        if (vecTopScore >= config.minScore) {
          topScore = vecTopScore;
          scoreThreshold = config.minScore;
          usedVecConfidence = true;
        }
      }
    } else {
      chunks = pool.slice(0, config.topK);
      // pool[0] is ranked by RRF (vector + BM25 blended), so it isn't
      // necessarily the chunk with the best raw vector score — a chunk can win
      // the combined ranking mostly on lexical/BM25 strength while its own
      // vecScore is mediocre. Gating confidence on pool[0] alone rejected
      // genuinely good answers whenever a lexically-strong-but-lower-vector
      // chunk happened to rank first. Use the best vecScore among the chunks
      // actually being sent to the LLM instead.
      topScore = Math.max(0, ...chunks.map(c => c.vecScore));
      scoreThreshold = config.minScore;
    }

    if (opts.trace) {
      opts.trace.reranked = reranked
        ? reranked.map(c => ({
          id: c.id, menuId: c.menuId, menuName: c.menuName, text: c.text,
          vecScore: c.vecScore, score: c.score, rerankScore: c.rerankScore,
        }))
        : null;
      opts.trace.usedVecConfidence = usedVecConfidence;
    }

    const confidence: 'high' | 'medium' | 'low' =
      topScore >= 0.85 ? 'high'
        : topScore >= scoreThreshold ? 'medium'
          : 'low';

    if (opts.trace) {
      opts.trace.topScore = topScore;
      opts.trace.scoreThreshold = scoreThreshold;
      opts.trace.confidence = confidence;
    }

    if (!chunks.length || confidence === 'low') {
      const suggested = await prisma.menuItem.findMany({
        where: { isActive: true, approvalStatus: 'approved' },
        select: { id: true, name: true },
        orderBy: { clickCount: 'desc' },
        take: 3,
      });
      const durationMs = Date.now() - startMs;
      let queryLogId: number | null = null;
      try {
        const rows = await prisma.$queryRaw<{ id: number }[]>`
          INSERT INTO kb_query_logs
            ("sessionId","question","noAnswer","lang","durationMs",
             "rewriteMs","normalizeMs","embedMs","retrieveMs","rerankMs","generateMs",
             "contextChunks","tokensOut")
          VALUES
            (${sessionId},${cleanQ},${true},${lang},${durationMs},
             ${rewriteMs},${normalizeMs},${embedMs},${retrieveMs},${rerankMs},${generateMs},
             ${contextChunks},${tokensOut})
          RETURNING id
        `;
        queryLogId = rows[0]?.id ?? null;
      } catch {
        // Audit-log failure must never block the response.
      }
      if (opts.trace) {
        opts.trace.noAnswer = true;
        opts.trace.queryLogId = queryLogId;
        opts.trace.timings = {
          rewriteMs, normalizeMs, embedMs, retrieveMs, rerankMs, generateMs,
          totalMs: durationMs,
        };
      }
      // Surfaced in Interaction Logs too (status 'failed', not 'error') — the
      // system worked correctly and honestly said it doesn't know; it's a KB
      // content gap to review, not an infra fault.
      prisma.interactionLog.create({
        data: {
          sessionId,
          userMessage: cleanQ,
          botResponse: '',
          status: 'failed',
          endpoint: '/api/kb/query',
          tags: ['kb_query', 'no_answer', `lang:${lang}`],
        },
      }).catch(console.error);
      return { noAnswer: true, suggestedMenus: suggested, queryLogId };
    }

    // Enumeration questions ("what types of X does the bank offer") need every
    // chunk belonging to the one dominant page, not just whichever individual
    // passages scored best against the exact question phrasing. A cross-encoder
    // reranker optimizes for "single best match," which reliably buries genuine
    // category members (e.g. "Diaspora Accounts") below irrelevant content once
    // a page has more sections than fit in topK — measured concretely: the
    // reranker scored a vague "we offer a variety of..." intro at 0.99 while
    // "Diaspora Accounts" (a literal correct answer) scored 0.003. If the top
    // chunk's page has more chunks sitting in the wider retrieval pool, that's
    // a signal the whole page is relevant, not just the one best-scoring
    // passage — pull the rest of that page's pooled chunks in too.
    //
    // NOTE: this must run BEFORE the per-chunk relevance filter below, because
    // enumeration backfill adds sibling chunks that scored below topK on their
    // own but belong to the same (already-confident) dominant page. Filtering
    // first and then backfilling would leave unfiltered siblings in the set
    // with no second-pass — see bug (B).
    const ENUMERATION_HINTS = /\b(types?|kinds?|categories|category|list|all|various|different|options|fees?|charges?|rates?|prices?|items?|products?|services?|what are|which are)\b/i;
    const isEnumeration = ENUMERATION_HINTS.test(cleanQ);
    // IDs of chunks that were added via enumeration backfill. These chunks
    // scored poorly *individually* (often 0.0x the best chunk) because the
    // reranker/vector search is scored per-passage, not per-page. But for an
    // enumeration query they are REQUIRED content — the whole point of
    // backfilling is to pull them in. Filtering them out in the per-chunk
    // relevance step below would be exactly bug (B) the comment above warns
    // about, so we tag them here and exempt them from RELATIVE_DROP later.
    const backfilledIds = new Set<number>();
    if (isEnumeration) {
      const topMenuId = chunks[0]?.menuId;
      if (topMenuId) {
        const included = new Set(chunks.map(c => c.id));
        const MAX_CHUNKS_AFTER_BACKFILL = 30;
        for (const c of pool) {
          if (chunks.length >= MAX_CHUNKS_AFTER_BACKFILL) break;
          if (c.menuId === topMenuId && !included.has(c.id)) {
            chunks.push(c);
            included.add(c.id);
            backfilledIds.add(c.id);
          }
        }
      }
    }

    // `chunks` so far is a fixed-size slice (pool.slice(0, topK) or the top
    // `topK` reranked results) plus, for enumeration queries, any sibling
    // chunks backfilled from the dominant page. The initial topScore/
    // confidence check above only gates on the *single best* chunk — so
    // anything else that merely filled out the slice (or got backfilled in
    // the enumeration step) still ends up in the LLM context and cited as a
    // source unless we explicitly drop it here.
    const isRerankMode = reranked && !usedVecConfidence;
    const scoreOf = (c: ChunkRow & { score: number }): number =>
      isRerankMode ? (c as RerankedChunk).rerankScore : c.vecScore;

    let filtered: (ChunkRow & { score: number })[];
    if (isRerankMode) {
      // Two filters, unchanged from the original calibration:
      //   1. Absolute threshold: same scoreThreshold that gated confidence.
      //      The chunk that produced topScore is guaranteed to survive this.
      //   2. Relative-to-best floor: chunks whose relevance score is more
      //      than a fixed gap below the best chunk are almost certainly
      //      off-topic filler that ranked inside topK by chance.
      // Reranker scores span ~0..1 widely enough (a confident match can be
      // 0.9+, noise near 0) that a multiplicative ratio meaningfully
      // separates "close to best" from "just riding along" — this mode is
      // untouched by the vector-mode fix below.
      filtered = chunks.filter(c => scoreOf(c) >= scoreThreshold);
      if (filtered.length) {
        const bestScore = scoreOf(filtered[0]);
        // Enumeration queries: sibling chunks (e.g. individual fee items
        // after a "Fees & Charges" heading) routinely score 1/5th or less of
        // the best chunk on their own, but they ARE the answer. Tightening
        // this filter to 0.50/0.10 of best is exactly what made a 14-item
        // list stop at 4.
        const RELATIVE_DROP = isEnumeration ? 0.10 : 0.50;
        const relFloor = Math.max(scoreThreshold, bestScore * RELATIVE_DROP);
        filtered = filtered.filter(c => scoreOf(c) >= relFloor || backfilledIds.has(c.id));
      }
    } else {
      // Vector-similarity (cosine) mode. The multiplicative relative floor
      // above does NOT work here: docs/AI_CONFIG.md measured genuinely
      // correct short/listy content scoring 0.37-0.55 cosine similarity —
      // scores cluster too tightly for any ratio-of-best to land above
      // minScore, so `Math.max(scoreThreshold, bestScore * ratio)` always
      // collapsed straight back to the flat scoreThreshold, silently
      // dropping any correct-but-not-best chunk below it. Measured
      // concretely: for "when is nib bank established," the chunk
      // containing "Established on May 26, 1999" ranked #5 in the retrieved
      // pool at vecScore 0.4683 — just under a 0.5 minScore — and was
      // silently excluded from context on both Ollama and OpenRouter alike
      // (this filtering is provider-independent), leaving neither model able
      // to answer a question its own top-ranked retrieval had already found
      // the answer to.
      //
      // A flat additive gap from the best score was tried first and
      // measurably overcorrected: it also pulled 3 unrelated pages
      // ("psychology", "Rag", "Opening Account") into the sources for a
      // plain "how are you doing" greeting, because that query's own best
      // match (0.537) was itself only barely above minScore, so a fixed gap
      // below it reached down into pure noise — exactly the "10+ unrelated
      // pages on greetings" failure this filter exists to prevent.
      //
      // The actual distinguishing signal, measured against both cases: the
      // History chunk sits on the SAME source page ("About Us") as the
      // chunk that set topScore — a sibling section of a page we already
      // have high confidence is relevant. The greeting's stray chunks are
      // all from OTHER, unrelated pages. So: a chunk from a different page
      // than the best match still needs to clear the ordinary confidence
      // bar on its own; only a same-page sibling gets the relaxed floor —
      // it's topically anchored by that page's own confident match, not
      // just coincidentally similar.
      const bestChunk = chunks.reduce((best, c) => (c.vecScore > best.vecScore ? c : best), chunks[0]);
      const SAME_PAGE_GAP = isEnumeration ? 0.25 : 0.15;
      filtered = chunks.filter(c =>
        c.vecScore >= scoreThreshold ||
        backfilledIds.has(c.id) ||
        (c.menuId === bestChunk.menuId && c.vecScore >= bestChunk.vecScore - SAME_PAGE_GAP),
      );
    }
    // Never end up with an empty set right after confidence said "answer" —
    // the absolute filter already preserved topScore's chunk, and the
    // relative floor is <= bestScore by construction, so this is just a
    // defensive guard.
    if (filtered.length) chunks = filtered;

    if (opts.trace) {
      opts.trace.isEnumeration = isEnumeration;
      opts.trace.backfilledIds = Array.from(backfilledIds);
      opts.trace.chunks = chunks.map(c => ({
        id: c.id, menuId: c.menuId, menuName: c.menuName, text: c.text, vecScore: c.vecScore, score: c.score,
        ...(reranked && !usedVecConfidence ? { rerankScore: (c as RerankedChunk).rerankScore } : {}),
      }));
    }

    // Labeling each block with its source menu/article keeps the model from
    // conflating facts across sources when several are in context together —
    // e.g. attributing a "Scale" figure to "Core Values" just because they're
    // adjacent in the prompt. This is internal grounding only; it's stripped
    // out of what actually reaches the user, who sees the `sources` array
    // rendered as separate clickable source links in the UI.
    const context = chunks.map((c, i) => `[${i + 1}] (Source: ${c.menuName}) ${c.text}`).join('\n\n');
    const systemPrompt =
      config.systemPrompt ||
      'You are NIB International Bank\'s virtual assistant. ' +
      'Answer ONLY using the context provided. ' +
      'Do not invent information not present in the context. ' +
      'Each context block is labeled with its source — do not attribute a fact to a ' +
      'different topic or source than the block it actually came from. ' +
      'Do not include the "(Source: ...)" labels or bracket numbers in your reply; ' +
      'they are for your reference only, not for the user. ' +
      'Always include complete dates with the full year (e.g. "May 26, 1999" not "May 26"), ' +
      'exact numbers, and proper names exactly as they appear in the context. ' +
      'Never abbreviate or omit any part of a date, year, or number. ' +
      'When the context describes a general category followed by several specifically ' +
      'named variants of it (e.g. a saving account type followed by a list of named ' +
      'saving account products), preserve that structure in your answer — group the ' +
      'variants under their parent category rather than listing every variant and the ' +
      'category itself as separate, equal-level items. ' +
      'If asked for a count of items that are explicitly listed in the context (e.g. ' +
      '"how many core values are there"), count the listed items yourself rather than ' +
      'saying the count isn\'t stated — but never count or estimate anything not ' +
      'actually enumerated in the context. ' +
      'IMPORTANT: When the user asks for a list, all items, all fees, all charges, ' +
      'all types, all categories, or any other enumeration-style question, you MUST ' +
      'list EVERY relevant item found in the context. Do NOT stop early, do NOT ' +
      'summarize with a partial list, and do NOT say "including" followed by just ' +
      'a few items. Enumerate every single applicable entry in full, each on its ' +
      'own line or as its own numbered/bulleted item, until you have covered them ' +
      'all. Double-check at the end that you haven\'t missed any entry from the ' +
      'context that matches the question. ' +
      'If the context does not contain a clear answer, say so honestly. ' +
      'Be helpful and clear. Reply in the same language as the user\'s question.';

    if (opts.trace) {
      opts.trace.context = context;
      opts.trace.systemPrompt = systemPrompt;
    }

    // isEnumeration + backfilledIds are already computed above (pre-filter),
    // so reuse the same flag here rather than re-running the regex.
    const userPrompt = `Context:\n${context}\n\nQuestion: ${searchQ}`;
    const genOpts = {
      temperature: config.temperature,
      // For long list/enumeration answers, 1500 tokens can still be tight
      // with Aya/Qwen-style models. 2500 tokens ≈ ~1875 chars of output,
      // enough for 20+ bullet items comfortably even if the model is verbose.
      numPredict: isEnumeration ? 2500 : 600,
    };
    contextChunks = chunks.length;
    const tGen = mark();
    const answer = opts.onToken
      ? await generateViaProviderStreaming(config, systemPrompt, userPrompt, genOpts, opts.onToken)
      : await generateViaProvider(config, systemPrompt, userPrompt, genOpts);
    generateMs = mark() - tGen;
    tokensOut = Math.ceil(answer.length / 4);

    // Sources are built strictly from `chunks` — the exact context actually
    // sent to the LLM for this answer — never from the wider retrieval pool or
    // "everything indexed"; a source only appears here if it was really used.
    //
    // Deduplicated by menuId (best chunk per source), and explicitly re-sorted
    // by relevance score afterward so the list is genuinely top-to-bottom, not
    // just whatever order chunks happened to be in. The score itself is
    // whichever metric actually determined that order: the cross-encoder's
    // rerankScore when reranking ran (showing vecScore there would be
    // misleading — a low-vecScore chunk can rank first on a high rerankScore),
    // otherwise vector similarity.
    const seenMenus = new Set<string>();
    const sources: KBSource[] = [];
    for (const c of chunks) {
      if (!seenMenus.has(c.menuId)) {
        seenMenus.add(c.menuId);
        const relevance = (reranked && !usedVecConfidence) ? (c as RerankedChunk).rerankScore : c.vecScore;
        sources.push({ menuId: c.menuId, menuName: c.menuName, score: relevance });
      }
    }
    sources.sort((a, b) => b.score - a.score);

    const durationMs = Date.now() - startMs;
    const sourceIds = sources.map(s => s.menuId);

    // Audit log — what the user asked and what the AI answered (non-blocking).
    // RETURNING id lets feedback (thumbs up/down, see /api/kb/feedback) and
    // the AI Evaluation system's runner correlate back to this specific
    // logged query later.
    let queryLogId: number | null = null;
    try {
      const rows = await prisma.$queryRaw<{ id: number }[]>`
        INSERT INTO kb_query_logs
          ("sessionId","question","answer","noAnswer","confidence","sourceMenuIds","lang","durationMs",
           "rewriteMs","normalizeMs","embedMs","retrieveMs","rerankMs","generateMs",
           "contextChunks","tokensOut")
        VALUES
          (${sessionId},${cleanQ},${answer},${false},${confidence},${sourceIds},${lang},${durationMs},
           ${rewriteMs},${normalizeMs},${embedMs},${retrieveMs},${rerankMs},${generateMs},
           ${contextChunks},${tokensOut})
        RETURNING id
      `;
      queryLogId = rows[0]?.id ?? null;
    } catch {
      // Audit-log failure must never block the response.
    }

    if (opts.trace) {
      opts.trace.noAnswer = false;
      opts.trace.queryLogId = queryLogId;
      opts.trace.timings = {
        rewriteMs, normalizeMs, embedMs, retrieveMs, rerankMs, generateMs,
        totalMs: durationMs,
      };
    }

    // General interaction log (non-blocking)
    prisma.interactionLog.create({
      data: {
        sessionId,
        userMessage: cleanQ,
        botResponse: answer,
        status: 'success',
        endpoint: '/api/kb/query',
        tags: ['kb_query', `lang:${lang}`, `confidence:${confidence}`],
      },
    }).catch(console.error);

    return { noAnswer: false, answer, sources, confidence, queryLogId };
  } catch (err: any) {
    // Rethrown below unchanged — this only adds logging. checkRateLimit()'s
    // 429 and the kb_disabled 503 above are deliberate, expected rejections
    // that never reach this catch; what lands here is a genuine failure
    // (Ollama down, or AbortSignal.timeout() firing on embed/generate).
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    const errorType = isTimeout ? 'timeout' : 'error';
    const durationMs = Date.now() - startMs;
    if (opts.trace) {
      opts.trace.error = String(err?.message ?? err);
      opts.trace.timings = {
        rewriteMs, normalizeMs, embedMs, retrieveMs, rerankMs, generateMs,
        totalMs: durationMs,
      };
    }
    prisma.$executeRaw`
      INSERT INTO kb_query_logs
        ("sessionId","question","noAnswer","lang","durationMs","errorType",
         "rewriteMs","normalizeMs","embedMs","retrieveMs","rerankMs","generateMs",
         "contextChunks","tokensOut")
      VALUES
        (${sessionId},${cleanQ},${true},${lang},${durationMs},${errorType},
         ${rewriteMs ?? null},${normalizeMs ?? null},${embedMs ?? null},
         ${retrieveMs ?? null},${rerankMs ?? null},${generateMs ?? null},
         ${contextChunks ?? null},${tokensOut ?? null})
    `.catch(() => null);
    prisma.interactionLog.create({
      data: {
        sessionId,
        userMessage: cleanQ,
        botResponse: '',
        status: 'error',
        endpoint: '/api/kb/query',
        errorDetails: String(err?.message ?? err).slice(0, 500),
        tags: ['kb_query', errorType, `lang:${lang}`],
      },
    }).catch(console.error);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Admin utilities (exported for API routes)
// ---------------------------------------------------------------------------

export { getKBConfig };

export type KBQueryLogRow = {
  id: number;
  sessionId: string;
  question: string;
  answer: string | null;
  noAnswer: boolean;
  confidence: string | null;
  sourceMenuIds: string[];
  // Human-readable names resolved from sourceMenuIds (which mixes menu_items
  // and kb_articles ids) — the admin Query Logs table needs to show which
  // source an answer actually came from, not raw UUIDs.
  sourceNames: string[];
  lang: string;
  durationMs: number | null;
  // -------- Per-stage timing breakdown (ms) — null means stage was skipped
  // or never reached before a failure/early exit.
  rewriteMs: number | null;
  normalizeMs: number | null;
  embedMs: number | null;
  retrieveMs: number | null;
  rerankMs: number | null;
  generateMs: number | null;
  // Context / output hints (useful for reading the timing breakdown):
  contextChunks: number | null;
  tokensOut: number | null;
  // Null for a normal answer or a plain low-confidence no-answer. Set to
  // 'timeout' or 'error' only when the query threw before either of those
  // could be produced (Ollama unreachable/too slow) — distinguishes "we
  // looked and found nothing" from "we never got to look."
  errorType: string | null;
  createdAt: Date;
};

export async function getKBQueryLogs(opts: {
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ rows: KBQueryLogRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const [rawRows, countResult] = await Promise.all([
    prisma.$queryRaw<Omit<KBQueryLogRow, 'sourceNames'>[]>`
      SELECT id, "sessionId", question, answer, "noAnswer", confidence,
             "sourceMenuIds", lang, "durationMs", "errorType", "createdAt",
             "rewriteMs", "normalizeMs", "embedMs", "retrieveMs", "rerankMs", "generateMs",
             "contextChunks", "tokensOut"
      FROM   kb_query_logs
      WHERE  (${opts.from ? opts.from : null}::timestamptz IS NULL OR "createdAt" >= ${opts.from ?? null}::timestamptz)
        AND  (${opts.to ? opts.to : null}::timestamptz IS NULL OR "createdAt" <= ${opts.to ?? null}::timestamptz)
      ORDER  BY "createdAt" DESC
      LIMIT  ${limit}
      OFFSET ${offset}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM   kb_query_logs
      WHERE  (${opts.from ? opts.from : null}::timestamptz IS NULL OR "createdAt" >= ${opts.from ?? null}::timestamptz)
        AND  (${opts.to ? opts.to : null}::timestamptz IS NULL OR "createdAt" <= ${opts.to ?? null}::timestamptz)
    `,
  ]);

  // sourceMenuIds mixes menu_items ids and kb_articles ids with no marker for
  // which is which, so resolve names against both tables.
  const allIds = Array.from(new Set(rawRows.flatMap(r => r.sourceMenuIds ?? [])));
  const nameMap = new Map<string, string>();
  if (allIds.length) {
    const [menus, articles] = await Promise.all([
      prisma.menuItem.findMany({ where: { id: { in: allIds } }, select: { id: true, name: true } }),
      prisma.kBArticle.findMany({ where: { id: { in: allIds } }, select: { id: true, title: true } }),
    ]);
    for (const m of menus) nameMap.set(m.id, m.name);
    for (const a of articles) nameMap.set(a.id, a.title);
  }

  const rows = rawRows.map(r => ({
    ...r,
    sourceNames: (r.sourceMenuIds ?? []).map(id => nameMap.get(id) ?? id),
  }));

  return { rows, total: Number(countResult[0]?.count ?? 0) };
}

export async function getKBStatus(): Promise<
  { id: string; name: string; status: string; approved: boolean; chunkCount: number; lastIndexed: string | null; kbEnabled: boolean }[]
> {
  const menus = await prisma.menuItem.findMany({
    where: { isActive: true, kbEnabled: true, responseType: 'static' },
    select: { id: true, name: true, kbEnabled: true, approvalStatus: true, kbChunks: true },
    orderBy: { name: 'asc' },
  });

  return menus.map(m => ({
    id: m.id,
    name: m.name,
    status: m.approvalStatus === 'approved' ? 'active' : m.approvalStatus ?? 'pending',
    approved: m.approvalStatus === 'approved',
    chunkCount: m.kbChunks.length,
    lastIndexed: m.kbChunks.length
      ? m.kbChunks.reduce<string>((latest, c) => {
        const t = new Date(c.indexedAt).toISOString();
        return t > latest ? t : latest;
      }, new Date(0).toISOString())
      : null,
    kbEnabled: m.kbEnabled,
  }));
}

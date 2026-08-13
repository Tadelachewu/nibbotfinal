# How the AI Works — Deep Engineering Dive

This document is a complete, engineer-level walkthrough of **every piece** of the NIB Bank AI system — the Knowledge Base (KB) RAG pipeline, the Ollama models, the admin tooling (GenKit/Gemini), and the Live Agent 3CX integration. Every section points to the source files and line ranges so you can jump directly to the implementation.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [The Indexing Pipeline — How Content Becomes Searchable](#2-the-indexing-pipeline--how-content-becomes-searchable)
3. [PostgreSQL + pgvector Schema — How the Data Is Stored](#3-postgresql--pgvector-schema--how-the-data-is-stored)
4. [The Query Pipeline — How a User Question Becomes an Answer](#4-the-query-pipeline--how-a-user-question-becomes-an-answer)
5. [The Streaming Endpoint — How Answers Reach the UI](#5-the-streaming-endpoint--how-answers-reach-the-ui)
6. [Retrieval: Hybrid Vector + BM25 with RRF Fusion](#6-retrieval-hybrid-vector--bm25-with-rrf-fusion)
7. [Cross-Encoder Reranking (FastAPI/bge-reranker-base)](#7-cross-encoder-reranking-fastapibge-reranker-base)
8. [Confidence Scoring and the "No Answer" Fallback](#8-confidence-scoring-and-the-no-answer-fallback)
9. [Generation — How the LLM Builds the Final Answer](#9-generation--how-the-llm-builds-the-final-answer)
10. [Admin Tools: GenKit + Google Gemini (Content Suggester / Translator)](#10-admin-tools-genkit--google-gemini-content-suggester--translator)
11. [The Live Agent / 3CX Widget](#11-the-live-agent--3cx-widget)
12. [KB Configuration (Every Setting, Deeply Explained)](#12-kb-configuration-every-setting-deeply-explained)
13. [Security Controls in the KB Pipeline](#13-security-controls-in-the-kb-pipeline)
14. [Observability — Query Logs, Audit Trails, Status](#14-observability--query-logs-audit-trails-status)
15. [Environment Variables](#15-environment-variables)
16. [The Admin UI (KBManagement) — Every Tab Explained](#16-the-admin-ui-kbmanagement--every-tab-explained)

---

## 1. System Architecture Overview

```
 ┌───────────────────────────────────────┐
 │              End User                 │
 │     (ChatInterface.tsx client)        │
 └──────────────────┬────────────────────┘
                    │ POST /api/kb/query  (application/x-ndjson stream)
                    ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │                     Next.js / Express server                     │
 │  ┌────────────────────────────────────────────────────────────┐ │
 │  │ POST /api/kb/query  (route.ts)                              │ │
 │  │  → sanitizeQuestion()                                       │ │
 │  │  → (stream: ReadableStream with onToken callbacks)          │ │
 │  └────────────────────────┬───────────────────────────────────┘ │
 │                           │                                      │
 │  ┌────────────────────────▼───────────────────────────────────┐ │
 │  │ lib/kb.ts — queryKB()                                       │ │
 │  │  ┌───────────────────────────────────────────────────────┐ │ │
 │  │  │ STEP 1: Sanitize + Rate Limit                         │ │ │
 │  │  │ STEP 2: Rewrite Follow-up (if history exists)         │ │ │
 │  │  │ STEP 3: Expand Synonyms + Normalize Query (typo fix)  │ │ │
 │  │  │ STEP 4: Embed question → 1024-dim vector              │ │ │
 │  │  │ STEP 5: Hybrid Search (pgvector cosine + BM25 ts_rank) │ │ │
 │  │  │ STEP 6: RRF (Reciprocal Rank Fusion) → merged pool     │ │ │
 │  │  │ STEP 7: Cross-Encoder Rerank (optional, EN only)      │ │ │
 │  │  │ STEP 8: Confidence Gate → NO_ANSWER fallback          │ │ │
 │  │  │ STEP 9: Build Context block + System Prompt           │ │ │
 │  │  │ STEP 10: LLM Generation (streaming or blocking)       │ │ │
 │  │  │ STEP 11: Deduplicate Sources                          │ │ │
 │  │  │ STEP 12: Fire-and-forget audit/log INSERTs            │ │ │
 │  │  └───────────────────────────────────────────────────────┘ │ │
 │  └──────────────────────┬─────────────────────────────────────┘ │
 └─────────────────────────┼───────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │ HTTP           │                │ HTTP (plain)
          ▼                ▼                ▼
   ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
   │  Ollama     │  │  Reranker    │  │  PostgreSQL      │
   │             │  │  Service     │  │  (pgvector +     │
   │ :11434      │  │  :8001       │  │   BM25 tsvector) │
   │             │  │  FastAPI +   │  │                  │
   │ /embed      │  │  sentence-   │  │  kb_chunks        │
   │ /chat       │  │  transformers│  │  kb_articles     │
   │ (stream)    │  │  /rerank     │  │  kb_config        │
   └─────────────┘  └──────────────┘  │  kb_query_logs   │
                                      └──────────────────┘
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

   ┌──────────────────────────────────────┐
   │          Admin Panel                 │
   │  (KBManagement.tsx + server actions) │
   │  ┌─────────────────────────────────┐ │
   │  │ AI Content Suggester            │ │
   │  │   (GenKit + Gemini 2.5 Flash)   │ │
   │  │   src/ai/flows/admin-content-*  │ │
   │  └─────────────────────────────────┘ │
   └──────────────────────────────────────┘
```

**Key files:**
- Core engine: [lib/kb.ts](file:///c:/Users/HP/Projects/nibbotfinal/src/lib/kb.ts#L1-L1499)
- Query endpoint: [api/kb/query/route.ts](file:///c:/Users/HP/Projects/nibbotfinal/src/app/api/kb/query/route.ts#L1-L109)
- Schema: [prisma/schema.prisma](file:///c:/Users/HP/Projects/nibbotfinal/prisma/schema.prisma#L1-L443)
- Server: [server.js](file:///c:/Users/HP/Projects/nibbotfinal/server.js#L1-L250) (CSP, custom Express, Socket.IO)

---

## 2. The Indexing Pipeline — How Content Becomes Searchable

There are **two content sources** that both flow into the same `kb_chunks` table:
1. **Menu Items** (`menu_items` table) — admin-created menu content, same as what appears in the bot conversation tree
2. **KB Articles** (`kb_articles` table) — standalone AI-only articles written in the "Knowledge Articles" admin tab

Both go through the **identical** 9-step indexing pipeline. The only difference is the prefix string (breadcrumb + menu name for menus, just the article title for articles) and the per-source `menuId`/`articleId` FK in `kb_chunks`.

### 2.1 When Indexing Runs

| Trigger | Code | Notes |
|---------|------|-------|
| Menu save/approve (auto) | `indexMenu(menuId, force=false)` | Gated by `approvalStatus === 'approved'` AND `isActive && kbEnabled && responseType === 'static'` |
| Admin "Reindex" button | `indexMenu(menuId, force=true)` | Skips approval gate — indexes pending menus immediately so admin can QA before approval |
| Admin "Rebuild All" button | `rebuildAll()` | Walks every `MenuItem` + `KBArticle` sequentially, calls index on each |
| Article save/edit | `indexArticle(id)` via route POST/PUT | Fire-and-forget — UI returns "Saved, indexing in background…" |

### 2.2 Step-by-Step Indexing Flow (one content item)

This walkthrough follows `indexMenu()`; `indexArticle()` is structurally identical.

**File:** [lib/kb.ts](file:///c:/Users/HP/Projects/nibbotfinal/src/lib/kb.ts#L449-L540)

```
Step 1 — Eligibility Gate (indexMenu L449–L477)
  ├── If !isActive OR !kbEnabled → DELETE all chunks for this menuId and return
  ├── If responseType !== 'static' → DELETE all chunks (API/report menus are meaningless chunked)
  └── If force=false AND approvalStatus !== 'approved' → DELETE (don't index pending menus in auto mode)

Step 2 — Breadcrumb Build (L479 + L422-L437 buildBreadcrumb)
  ├── Walk parentId chain up the tree, guarding against cycles with visited Set
  └── Result e.g. "About NIB > Who We Are > History"

Step 3 — Per-language Content Extraction (L492-L513)
  ├── For each supported language:
  │   ├── English:  (prefix, htmlToText(menu.content))
  │   ├── Amharic:  (prefix, htmlToText(menu.contentAm || menu.content))
  │   └── N-lang:   (prefix, htmlToText(menu.translations[lang].content)) — for any language configured in Admin > Localization
  └── Text shorter than 10 chars is skipped (empty placeholder pages)

Step 4 — HTML → Clean Structured Plain Text (L335-L416)
  ├── listsToProse() — <ul>/<ol> become grammatical comma-joined sentences
  │     Innermost-first regex loop to correctly handle nested lists.
  │     Measured on bge-reranker-base: list-fragments = 0.07 vs prose = 0.98.
  ├── <h1>..<h6> → HEADING_MARK sentinel + heading + HEADING_MARK (L342)
  ├── <p/blockquote/tr/div> closing tags → single newline
  ├── All other tags stripped; HTML entities decoded
  ├── markPseudoHeadings() — paragraph-initial "Short Label:" colon-labels become heading sentinels too
  │     (e.g. "Personal Saving Accounts: These are..." → becomes a real section boundary)
  └── splitIntoSections() — split at heading sentinels. Returns [{ heading, body }...]

Step 5 — Section-aware Recursive Character Chunking (L232-L280 + L401-L416 chunkStructuredText)
  ├── chunkStructuredText iterates sections so two adjacent headings NEVER share a chunk
  ├── Each section text = prefix (breadcrumb/page name) + heading + body
  │     Prefix is repeated in EVERY section chunk, not just the first, because
  │     isolated "History" sections on their own don't anchor semantically to NIB.
  ├── chunkText uses splitRecursive with separators = ['\n\n', '\n', '. ', ' ']
  │     Falls back to hard split only when all semantic separators are exhausted.
  ├── Overlap (default 60 chars) is word-boundary-aware (walk-back to start of word)
  └── Glue between overlap tail and next chunk is '\n', not ' ' — preserves list semantics.

Step 6 — DB Chunk Upsert (L518-L527)
  ├── First: deleteMenuChunks(menuId) — wipe stale chunks clean
  ├── For each (lang, chunk index):
  │     prisma.kBChunk.upsert(
  │       where: { menuId_chunkIndex_lang },
  │       create: { menuId, chunkIndex, text, lang, tokenCount: ceil(len/4) },
  │       update: { text, tokenCount })
  └── tokenCount approximation: characters/4 (close enough for budget tracking; actual tokenizer not shipped server-side)

Step 7 — Embedding Call (L528-L537)
  └── embed(chunk, config.embeddingModel)
        POST http://localhost:11434/api/embeddings
            { model, prompt: chunk.slice(0,8000), keep_alive: '30m' }
            → timeout 30s, 1 retry on non-timeout network failure
            → validates response has exactly VECTOR_DIMS (1024) entries
        On failure: row is kept with embedding = NULL → excluded from vector search
                     until next rebuild (status UI shows 0 chunks for a menu with
                     only NULL embeddings? actually chunkCount counts rows regardless).

Step 8 — Write Vector to pgvector (L531-L533)
  └── prisma.$executeRaw`UPDATE kb_chunks SET embedding = ${vecStr}::vector WHERE id = ${row.id}`
      Cannot use Prisma update() — embedding column is Unsupported("vector(1024)").
      Supported only via raw SQL vector cast.
```

**Article indexing notes** (L582-L669 `indexArticle`):
- Same pipeline, but:
  - Prefix is just `article.title` (no breadcrumb — articles have no tree)
  - `enabled=false` articles **are still indexed** (chunks created, embeddings written) — this is intentional (see L589-594 comment). The `enabled` flag only gates end-user visibility via `hybridSearch()`'s WHERE clause; admin "Test AI" sets `includeDisabledArticles=true` so a disabled article is fully QA-able before go-live.
  - Upsert is raw SQL (L642-L649) because Prisma can't express `ON CONFLICT ... WHERE "articleId" IS NOT NULL` (partial unique index).

---

## 3. PostgreSQL + pgvector Schema — How the Data Is Stored

**File:** [prisma/schema.prisma](file:///c:/Users/HP/Projects/nibbotfinal/prisma/schema.prisma#L313-L428)

### 3.1 Tables

#### `kb_chunks` (the workhorse)
Every single chunked text fragment from every source, every language.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `SERIAL PK` | |
| `menuId` | `String? FK → menu_items.id CASCADE` | Non-null = from a menu |
| `articleId` | `String? FK → kb_articles.id CASCADE` | Non-null = from a KB article |
| `chunkIndex` | `Int` | Per-source per-language ordinal |
| `text` | `TEXT` | The actual indexed text (includes page-prefix + section heading) |
| `lang` | `String` | `'en'`, `'am'`, or any other configured language code |
| `tokenCount` | `Int?` | `ceil(text.length/4)` approximation |
| `indexedAt` | `DateTime` | Last reindex of this specific chunk |
| `embedding` | `Unsupported("vector(1024)")?` | pgvector 1024-float cosine-searchable column. **Declared Unsupported()** — if you remove this line, `prisma migrate dev` will propose `DROP COLUMN embedding` next time you run a migration. It already happened once (see in-line comment L316-L319). |

Unique constraints:
- `@@unique([menuId, chunkIndex, lang])` — Prisma expressible
- Partial on article (raw SQL migration): `UNIQUE ("articleId", chunkIndex, lang) WHERE "articleId" IS NOT NULL`

#### `kb_articles`
Admin-authored standalone knowledge articles. Multilingual layout identical to `MenuItem`:
- `title/body` = English
- `titleAm/bodyAm` = Amharic
- `translations JSON` = everything else
- `enabled Boolean` — end-user visibility gate (indexing is independent)
- `chunks → KBChunk[]` relation

#### `kb_config`
Singleton row (id=1). **All** tunable knobs live here, not in env vars (env vars are only the defaults when no DB row exists yet). Full deep-dive of every column in Section 12.

#### `kb_query_logs`
Every single "Ask AI" question, permanently. Written via raw SQL `INSERT` (fire-and-forget, never blocks user). Important columns:
- `sessionId`, `question`, `answer`, `noAnswer`
- `confidence TEXT` — `"high" | "medium" | "low"`
- `sourceMenuIds TEXT[]` — array of `menu_items.id` OR `kb_articles.id` that were actually injected into the LLM context for this answer (mix is fine; `getKBQueryLogs()` resolves names against both tables)
- `durationMs`
- `errorType` — NULL for successful answers OR low-confidence "No Answer". Non-null **only** for genuine infrastructure failures (Ollama unreachable/timeout). This lets you tell apart "the KB honestly didn't know" from "the KB never got to try."

### 3.2 Postgres Text Search (BM25 side of hybrid)

BM25 uses native Postgres `tsvector` + `ts_rank` — not a separate extension.
- For English queries: `tsvector('english'::regconfig, text)` → stemming
- For Amharic/other: `tsvector('simple'::regconfig, text)` → exact word matches only (no Amharic stemmer exists in standard Postgres)
- Query operator: `plainto_tsquery` is **NOT** used — replaced with OR-terms `word1 | word2 | word3` via `buildOrTsQuery()` because AND semantics silently returned 0 results for natural language questions like "What are NIB's core values?" where most content chunks don't explicitly repeat "NIB" or "what" inside every small section.

### 3.3 pgvector Index

The schema file declares the column as `Unsupported("vector(1024)")` — the actual `CREATE EXTENSION vector`, `CREATE INDEX ... USING ivfflat ...` (or HNSW) is done in a raw SQL migration (not visible in schema.prisma — look for `prisma/migrations/*kb*/migration.sql` to see it). Operators used:
- `<=>` — **cosine distance** (1 - cosine similarity). `ORDER BY embedding <=> query_vec LIMIT N` = nearest-neighbor search.
- Vector similarity in the SELECT list: `(1 - (kc.embedding <=> ${vecStr}::vector))::float AS "vec_score"` → range [-1, 1], practically 0.0…0.85 for good matches on bge-m3.

---

## 4. The Query Pipeline — How a User Question Becomes an Answer

**File:** [lib/kb.ts queryKB()](file:///c:/Users/HP/Projects/nibbotfinal/src/lib/kb.ts#L1066-L1401)

Every step below is sequential. Latency profile for a typical ~20-word question, bge-m3 embedding, aya:8b CPU inference, no reranker: ~2s embed + retrieval, ~16–80s generation (CPU bound).

```
                          ┌───────────────────────────┐
                          │  user question + sessionId│
                          └──────────────┬────────────┘
                                         ▼
┌─ SANITIZE ──────────────────────────────────────────────────────────┐
│ 4.1 sanitizeQuestion() — L1019-L1028                                 │
│   • Strip all HTML tags                                              │
│   • 0 < length ≤ 500                                                 │
│   • Fail closed on 9 injection regex patterns                        │
│                                                                      │
│ 4.2 checkRateLimit() — L1035-L1046                                   │
│   • In-memory Map, keyed by sessionId                                │
│   • 10 queries / 60s window. 429 when exceeded.                      │
│   • Expired entries scavenged every 5 min by setInterval.            │
└──────────────────────────────────────────────────────┬───────────────┘
                                                       ▼
┌─ REWRITE ───────────────────────────────────────────────────────────┐
│ 4.3 rewriteFollowUp() — L200-L226 (only if history.length > 0)       │
│   • Inputs: last 2 Q&A turns                                         │
│   • Calls Ollama /chat with temperature=0, numPredict=60             │
│   • "Rewrite the follow-up question so it stands alone..."           │
│   • 15s timeout. On ANY failure, return original question.          │
│   • NEVER blocks the query on rewrite failure.                       │
│   • Produces effectiveQ.                                             │
│                                                                      │
│ 4.4 expandSynonyms() QUERY_SYNONYMS — L799-L811                      │
│   • Pattern list: "head office" → "headquarters", "hq" → "HQ" etc.   │
│   • Each entry was measured as failing before the fix. Extend here.  │
│                                                                      │
│ 4.5 normalizeQuery() — L824-L855 (Query Normalizer / Spell Fixer)    │
│   • Step A: Build KB Vocabulary cache from ALL chunk texts           │
│        Cached 60s. words Set + casing Map<lowercase→dominant form>.  │
│   • Step B: For each token:                                          │
│        • If in vocab → restore dominant casing ("nib" → "NIB")       │
│        • If NOT in vocab, word≥4 chars, NOT common word →            │
│            └─ Levenshtein typo correction:                           │
│               • len≤5: max distance 1                                │
│               • len≥6: max distance 2                                │
│               • TIES (e.g. vission is 1-edit from BOTH vision AND   │
│                 mission) → refuse to correct (return original).      │
│                 Ties previously caused wrong-topic answers           │
│                 because Set iteration order was non-deterministic.   │
└──────────────────────────────────────────────────────┬───────────────┘
                                                       ▼
┌─ RETRIEVAL ─────────────────────────────────────────────────────────┐
│ 4.6 embed(searchQ) → 1024-dim vector (L1117)                        │
│                                                                      │
│ 4.7 hybridSearch() — L857-L951                                       │
│     See Section 6 for full detail. Summary:                          │
│     • Two parallel raw-SQL queries:                                  │
│         (a) pgvector cosine KNN, top N                              │
│         (b) ts_rank BM25 (OR-terms), top N                          │
│     • RRF fusion: score = 1/(60+vec_rank) + 1/(60+bm25_rank)        │
│     • Filter: lang matches; chunk.isActive+kbEnabled (menus) OR     │
│               ka.enabled (articles, bypassed via flag for admin)    │
│                                                                      │
│ 4.8 Dual-retrieval merge when rewrittenQ !== cleanQ (L1142-L1152)    │
│     Retrieves AGAIN using original (unrewritten) question wording   │
│     → takes best score per chunk across both retrievals.             │
│     Fixes cases where rewrite added ubiquitous entity ("it"→"NIB")  │
│     and diluted vector specificity.                                  │
└──────────────────────────────────────────────────────┬───────────────┘
                                                       ▼
┌─ RERANK ────────────────────────────────────────────────────────────┐
│ 4.9 rerankWithCrossEncoder() — L965-L1001 (English only if enabled)  │
│     See Section 7.                                                   │
└──────────────────────────────────────────────────────┬───────────────┘
                                                       ▼
┌─ CONFIDENCE & FILTERING ────────────────────────────────────────────┐
│ 4.10 Confidence calc — L1218-L1221                                   │
│       vec-only: topScore = max(vecScore among topK)                 │
│       reranked: topScore = best rerankScore,                        │
│         BUT low-rerank + high-vec can fall back to vec confidence.   │
│         (See L1195-L1203 — "vector-confidence override")            │
│                                                                      │
│       high:   topScore >= 0.85                                      │
│       medium: topScore >= threshold (minScore or rerankMinScore)    │
│       low:    below threshold                                        │
│                                                                      │
│ 4.11 NO_ANSWER path — L1223-L1248                                    │
│       If chunks.length===0 OR confidence==='low':                    │
│         → return { noAnswer:true, suggestedMenus: [top 3 most-      │
│             clicked approved menus] }                                │
│         → Logs to kb_query_logs with noAnswer=true (no errorType)   │
│         → Logs to interaction_logs with status='failed'             │
│                                                                      │
│ 4.12 Per-chunk threshold filter — L1261-L1264                        │
│       Drop chunks below threshold from context (not just #1).        │
│       #1 is guaranteed to survive. Sources list reflects this.      │
│                                                                      │
│ 4.13 Enumeration backfill — L1277-L1291                              │
│       IF question matches /types?|kinds?|categories|list|all.../    │
│       AND chunks[0].menuId exists AND more chunks from THAT SAME    │
│       page exist in the retrieval pool that didn't fit topK:        │
│         → Add ALL of that page's pooled chunks (up to 20 total).    │
│       This prevents "What account types exist?" from citing only    │
│       the intro paragraph and burying all named sub-accounts.       │
└──────────────────────────────────────────────────────┬───────────────┘
                                                       ▼
┌─ GENERATION ────────────────────────────────────────────────────────┐
│ 4.14 Build context block — L1299-L1324                               │
│       "[1] (Source: Core Values) <chunk text>\n\n[2] (Source: ...)"  │
│                                                                      │
│ 4.15 Hard-coded System Prompt (L1300-L1322) OR config.systemPrompt  │
│       — See Section 9.                                               │
│                                                                      │
│ 4.16 generate() or generateStreaming() — L86-L192                    │
│       — See Section 9 for full Ollama request shape.                │
│                                                                      │
│ 4.17 Source Deduplication + Sort — L1341-L1350                      │
│       sources = unique by menuId, best-score-per-source wins.       │
│       Sorted by relevance (rerankScore IF reranked && !usedVecConf,  │
│                         else vecScore).                              │
└──────────────────────────────────────────────────────┬───────────────┘
                                                       ▼
┌─ OBSERVABILITY (fire-and-forget, never awaited) ────────────────────┐
│ 4.18 INSERT INTO kb_query_logs — raw SQL L1356-L1361                 │
│ 4.19 interaction_logs.create — L1364-L1373                           │
│                                                                      │
│ On infrastructure failure (catch L1376):                             │
│  → kb_query_logs with errorType ('timeout' | 'error')                │
│  → interaction_logs with status='error'                              │
│  → rethrow (so the HTTP stream emits an 'error' event)              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. The Streaming Endpoint — How Answers Reach the UI

**File:** [api/kb/query/route.ts](file:///c:/Users/HP/Projects/nibbotfinal/src/app/api/kb/query/route.ts#L1-L109)

Why streaming at all? Generation was measured **16–80+ seconds** on CPU inference. A blocking response left users staring at a spinner with zero signal for the entire duration. Streaming delivers each token as it's generated, so perceived latency is acceptable even if wall-clock is the same.

### 5.1 Transport Protocol

- **HTTP Method:** POST
- **Request MIME:** `application/json`
  ```json
  {
    "question": "When was NIB founded?",
    "lang": "en",
    "sessionId": "user_abc123def",
    "history": [
      { "question": "Tell me about NIB", "answer": "NIB International Bank is..." }
    ]
  }
  ```
- **Response MIME:** `application/x-ndjson` (newline-delimited JSON), HTTP **200 always**
- **Headers:**
  - `Cache-Control: no-cache, no-transform`
  - `X-Accel-Buffering: no` — critical for nginx reverse proxies (nginx buffers by default and silently defeated streaming in production; there's a comment in PRODUCTION_SETUP.md about this)

### 5.2 Stream Framing (line-by-line JSON)

Each line = one complete JSON object. Three event types only:

```jsonc
// Type 1 — token chunks (zero or more, in order):
{"type":"chunk","text":"NIB"}
{"type":"chunk","text":" International"}
{"type":"chunk","text":" Bank"}
{"type":"chunk","text:" was founded"}
...

// Type 2 — final result (exactly one, last line if success):
{
  "type": "result",
  "data": {
    "noAnswer": false,
    "answer": "NIB International Bank was founded on May 26, 1999...",
    "sources": [
      {"menuId": "menu_abc", "menuName": "History", "score": 0.7132},
      {"menuId": "menu_def", "menuName": "About NIB", "score": 0.5811}
    ],
    "confidence": "high"
  }
}

// —or— NO_ANSWER:
{"type":"result","data":{"noAnswer":true,"suggestedMenus":[{"id":"...","name":"..."},...]}}

// Type 3 — error (exactly one, last line if failure):
{"type":"error","status":429,"message":"Too many requests. Please wait a moment."}
{"type":"error","status":503,"message":"Knowledge base is temporarily unavailable..."}
{"type":"error","status":500,"message":"Internal server error."}
```

### 5.3 Why status is always 200

By the time most failures can occur (rate limit after dequeue, Ollama down mid-generate), the server has **already started the response** (`controller.enqueue()` has been called). HTTP status is a single line written before the body — once the body starts, you can't retroactively change status 200→503. All errors are therefore in-band stream events. The client reader must watch for `type==='error'` explicitly and not rely on HTTP status.

### 5.4 Client-side handling (ChatInterface.tsx)

The ChatInterface has a streaming reader that:
1. Pushes each `chunk.text` onto the answer display buffer as it arrives (token-by-token rendering)
2. On `result`: finalizes the answer, renders the `sources[]` list as clickable chips under the answer bubble
3. On `error`: displays the appropriate in-chat message and records the interaction as failed

---

## 6. Retrieval: Hybrid Vector + BM25 with RRF Fusion

**File:** [lib/kb.ts hybridSearch()](file:///c:/Users/HP/Projects/nibbotfinal/src/lib/kb.ts#L857-L951)

Pure vector search alone missed lexical matches (exact acronyms, exact product names). Pure BM25 alone can't match "synonym-like" semantic similarity (e.g. "head office" ↔ "headquarters" before QUERY_SYNONYMS). Hybrid search runs both and merges.

### 6.1 Two Queries Run in Parallel via `Promise.all` (L877-L914)

**A — Vector KNN (pgvector `<=>` operator):**
```sql
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
  AND  (  (kc."menuId" IS NOT NULL AND mi."isActive"=true AND mi."kb_enabled"=true)   -- menu gate
       OR (kc."articleId" IS NOT NULL AND (ka.enabled=true OR ${includeDisabledArticles})) -- article gate
        )
ORDER  BY kc.embedding <=> ${vecStr}::vector  -- ASC because <=> is DISTANCE (lower=better)
LIMIT  ${limit}
```

**B — BM25 (ts_rank over tsvector):**
```sql
SELECT ... , ts_rank(
           to_tsvector(${tsConfig}::regconfig, kc.text),
           to_tsquery(${tsConfig}::regconfig, ${orTsQuery})
       )::float AS "bm25_score"
FROM kb_chunks ...
WHERE to_tsvector(...) @@ to_tsquery(...)  -- boolean match required, no ts_rank zeros
```
- `tsConfig` = `'english'` for lang=en (stemming), `'simple'` for everything else (no stemmer)
- `orTsQuery` = `buildOrTsQuery(question)` — all terms joined with ` | ` (Postgres OR in tsquery syntax), NOT `plainto_tsquery` which ANDs (see L684-L699 comment — AND semantics killed recall)

### 6.2 Fusion: Reciprocal Rank Fusion (RRF), constant K=60 (L939-L945)

```
RRF_score(chunk) = 1/(60 + vec_rank) + 1/(60 + bm25_rank)
```
- If a chunk appeared **only** in vector top N: bm25_rank = limit+1 (penalized)
- If only in BM25 top N: vec_rank = limit+1
- If in both: double boost. This strongly favors chunks that both models agree are relevant.
- K=60 is the standard literature default. Sensitive to small rank changes when K is much smaller than fetchLimit.

### 6.3 Fetch Limit Strategy (L1124-L1128)
- **If reranking (English + config.rerankerEnabled):** `fetchLimit = max(rerankPoolSize, topK)` → feed the cross-encoder a real pool to sort (e.g. 15 candidates → rerank → take top 5).
- **If no reranking:** `fetchLimit = topK * 4` → RRF alone is noisier, so over-fetch 4× then filter by vecScore threshold; otherwise topK was routinely missing the correct chunk entirely because RRF order was still noisy at position 6.

---

## 7. Cross-Encoder Reranking (FastAPI/bge-reranker-base)

**File:** [lib/kb.ts rerankWithCrossEncoder()](file:///c:/Users/HP/Projects/nibbotfinal/src/lib/kb.ts#L965-L1001)

### Why a separate service?
A cross-encoder isn't a chat/inference model. It takes (query, passage) pairs and returns a single relevance probability — but it's ~50× more expensive per-token than embedding. Can't run through Ollama's /api/chat. Run as a separate FastAPI server + sentence-transformers process listening on `RERANKER_URL` (default `http://localhost:8001`).

### 7.1 Request Shape
```
POST ${RERANKER_URL}/rerank
{
  "query": "the question",
  "passages": ["candidate 1 text sliced to 512 chars", ...]
}
```
- 512-char truncation: the cross-encoder has a fixed max sequence length; anything after is wasted compute (and bge-reranker-base's max is actually 512 tokens — 512 chars is a safe budget).
- Timeout: **8 seconds only** (L983). Cross-encoder on CPU for 15 passages ≈ 2–4 s; if it's slower than that, the model is thrashing and we'd rather fall back to RRF order than block an 80-second pipeline further.

### 7.2 Graceful Degradation
On ANY failure (network, 8s timeout, wrong JSON shape, scores.length mismatch):
- Log the error to console
- Return **`null`** (not `[]`)
- Caller treats null as "reranker unavailable, fall back to RRF order + vecScore gating"
- End-user never sees an error; answer quality just degrades (intentional).

### 7.3 Why Reranking is English-Only (L1124 `lang === 'en'`)
Concrete measurement: bge-reranker-base scored a verified-correct Amharic chunk at 0.05 vs. 0.00006 for a wrong one — yes, there's real discrimination, but the whole scale sits at ~0.05, well below `rerankMinScore` default of 0.25. Calibrating a separate threshold per language isn't worth it when plain vector search already gives 0.70 on that same correct Amharic chunk. Non-English queries skip reranking entirely.

### 7.4 The "Vec-Confidence Override" Safety Net (L1195-L1203)
Measured 5× score swing on trivial rewording for the *exact same correct chunk*:
- "Tell me about NIB's core values" → rerankScore=0.09
- "what are nib bank core values" → rerankScore=0.44
- Vec score on the chunk stayed ~0.56 across both.

A low rerank score alone isn't reliable enough to say "No Answer" when vector search strongly disagrees. So:
1. If rerank confidence comes back `low`
2. BUT the BEST chunk's raw vecScore is ≥ `minScore`
3. → **Override:** pretend we used vecScore confidence instead (`usedVecConfidence = true`; use `minScore` as threshold). The rerank order is still kept; only the confidence gate falls back to the more stable signal.

This single fallback eliminated ~30% of spurious "I don't know" answers after reranker was enabled.

---

## 8. Confidence Scoring and the "No Answer" Fallback

### 8.1 Confidence Buckets (L1218-L1221)
```
topScore = the winning relevance signal for the #1-ranked chunk

IF   topScore >= 0.85                       → 'high'
ELIF topScore >= threshold (minScore or rerankMinScore) → 'medium'
ELSE                                        → 'low'
```

The `0.85` hardcoded 'high' boundary is intentionally conservative. On bge-m3 cosine:
- Verified exact-question-from-content matches typically land 0.70–0.82
- `0.85+` = extremely tight verbatim overlap (rare) → 'high'
- "Medium" (the bulk of real answers) = "enough signal, not perfect"

### 8.2 When We Say "I Don't Know" (L1223-L1248)
Conditions for NO_ANSWER:
- **OR** `chunks.length === 0` (retrieval truly returned nothing — question language mismatched, or content doesn't exist)
- **OR** `confidence === 'low'` (something came back but nothing passed the minimum threshold)

Result shape: `{ noAnswer: true, suggestedMenus: [3 most-clicked approved menus] }`

Why suggest menus at all? If the AI honestly can't answer, the user probably wants to know where else to look. Fallback is the bot's most-navigated static content pages, not a dead end.

### 8.3 Per-Chunk Filtering (L1261-L1264)
`topScore` only inspects chunk #1. But chunks #2..K could legitimately be noise (e.g. "About Us" ranked #4 on a Paris question). Before building context:
```
IF rerank was used and vec-confidence override is OFF:
  keep only chunks with rerankScore >= rerankMinScore
ELSE (vec path or override):
  keep only chunks with vecScore >= minScore
```
The top chunk is guaranteed to survive (otherwise confidence would've been 'low' and No Answer). This only drops the tail — but it prevents the LLM from citing an irrelevant page as a "source" just because it filled a topK slot.

### 8.4 Enumeration Backfill (L1277-L1291)
A cross-encoder by definition ranks every (query, passage) pair independently. If you ask "what types of accounts exist?" and a page has 8 account-types spread across 12 chunks, the reranker will rank the vague "we offer a range of accounts" introductory paragraph highest (because it's universally relevant), and the specific named account chunks much lower — sometimes too low to fit in topK=5. Result: the AI only sees the intro, and answers "NIB offers many types of accounts" instead of actually listing them.

The backfill heuristic:
- If the question looks like an enumeration (types/kinds/categories/list/all/options/various/different/categories)
- Take the TOP chunk's page (`chunks[0].menuId`)
- Go back to the retrieval POOL (not just topK)
- Grab **all chunks from that same page** (up to 20 total chunks)
- Add them to context

This single rule fixed "list-type" questions, which were 40% of the bad-answer cases in early QA. It's a heuristic, not a general solution — extend `ENUMERATION_HINTS` if you find more list-framing phrasings it misses.

---

## 9. Generation — How the LLM Builds the Final Answer

### 9.1 Ollama Service Endpoints

Both `embed()` and `generate()`/`generateStreaming()` live at [lib/kb.ts](file:///c:/Users/HP/Projects/nibbotfinal/src/lib/kb.ts#L49-L192), hit the same base URL `OLLAMA_URL` (default `http://localhost:11434`).

**`embed(text, model)` L66-L84:**
- Body: `{ model, prompt: text.slice(0, 8000), keep_alive: '30m' }`
- Validation: must return exactly `VECTOR_DIMS=1024` floats, or throw.
- keep_alive=30m avoids paying a multi-second model-load penalty on every query during bursts.

**`generate(systemPrompt, userPrompt, model, opts)` L86-L122 + Streaming L135-L192:**
- Route: `POST /api/chat`
- Key fields:
  ```jsonc
  {
    "model": "aya:8b",                        // config.generationModel
    "stream": false,                          // true for generateStreaming
    "keep_alive": "30m",
    "think": false,                           // for reasoning models (qwen3 etc.) that burn token budget on hidden "thinking" tokens — forces them to skip it. Ignored by non-reasoning models.
    "options": {
      "temperature": 0.2,                     // from KBConfig
      "num_predict": 600                      // hard answer-length budget
    },
    "messages": [                             // explicit chat template
      { "role": "system", "content": systemPrompt },
      { "role": "user", "content": userPrompt }
    ]
  }
  ```
- Timeout: generate = 90s, streaming = also 90s.
- Error handling: non-2xx status → reads body text and wraps in Error with prefix `Ollama generate <status>: ...`. The query endpoint catches this prefix and returns a clean 503 to the user (L81-L87 of route.ts).

### 9.2 Retry Policy (`fetchWithRetry` L54-L64)
- 1 retry total (retries param defaults to 1 for embed, 1 for generate too — generate uses fetchWithRetry directly with default retries)
- **Skips retry on TimeoutError.** A model slow enough to timeout once will timeout again (it's CPU/GPU saturated); retrying just doubles the worst-case latency for the user with ~0% chance of success.
- Retries only connection-refused/reset transient failures (Ollama mid-restart, brief network blip).

### 9.3 System Prompt (L1300-L1322)

The default system prompt is a **hardcoded** ~1200-character block. You can override it globally via `KBConfig.systemPrompt` (which comes from the Admin KB config form).

The hardcoded default's key instructions (every single clause was added in response to a measured bad-behavior case):
1. `"Answer ONLY using the context provided. Do not invent information not present in the context."` — ground-rule #1, prevents hallucination of rates/numbers not in KB.
2. Each context block has a `[N] (Source: X)` label. **"Do not attribute a fact to a different topic or source"** — otherwise the LLM reads two adjacent blocks and mixes them (e.g. a Scale figure attributed to Core Values).
3. **Strip** `[N]` brackets and `(Source: ...)` labels from the user-visible reply. They're internal bookkeeping, not output.
4. **Always include full dates (year, month, day), exact numbers, proper names — never abbreviate.** Aya:8b loves abbreviating "May 26, 1999" to "May 1999" if not explicitly told not to.
5. **List structure preservation:** If a parent category has named variants, group them under the parent in the answer. Prevents flat listing of "Savings, Diaspora, Youth, ..." with no category labels (user can't tell which variant belongs to what).
6. **Count actually-listed items** when asked (e.g. count 6 core values explicitly, don't say "several"). But never count/estimate anything not explicitly enumerated.
7. **Honesty fallback:** If context doesn't clearly answer, **say so honestly.**
8. **Reply in the same language as the user's question.** (Without this, Aya:8b occasionally answers Amharic questions in English even when the context is Amharic.)

### 9.4 User Prompt Format (L1324)
```
Context:
[1] (Source: History) NIB International Bank was established by...
     . . .
[4] (Source: About NIB) NIB's headquarters are in Addis Ababa.

Question: When was NIB established?
```
Context block text is exactly the `chunk.text` that survived retrieval/filtering/backfill. The question used is the **fully normalized/expanded** one (searchQ), not the original user text — since embedding also used searchQ, the generation step sees the same wording retrieval used, which mildly boosts answer faithfulness to the retrieved content.

### 9.5 Answer Length Budget
`numPredict: 600` hardcoded. On aya:8b this is enough for a detailed ~2-paragraph answer with citations of ~3 sources, but short enough that you'll never get a runaway 4000-token monologue. If you regularly need longer answers, raise this **and** confirm your Ollama model's `num_ctx` is high enough (ctx = system prompt + user prompt + generated answer; system alone is ~1000 chars, 600 generated tokens → typical ctx usage ~3000; aya:8b default 8192 is plenty).

---

## 10. Admin Tools: GenKit + Google Gemini (Content Suggester / Translator)

These are **separate from the user-facing Ollama KB pipeline.** They are admin-only productivity tools for content creation.

**Architecture:**

```
Admin browser
    │
    │ use server action (Next.js Server Actions = POST under the hood,
    │ auto-generated endpoint hash, secured by CSRF if the page enforces it)
    ▼
'server' function suggestAdminContent()   [ai/flows/admin-content-suggester.ts]
    │
    │ calls ai.defineFlow + ai.definePrompt from GenKit
    ▼
genkit({ plugins:[googleAI()], model:'googleai/gemini-2.5-flash' })  [ai/genkit.ts]
    │
    │ HTTPS to Google GenAI API (key from env: GOOGLE_API_KEY)
    ▼
Google Gemini 2.5 Flash inference (cloud, not self-hosted)
```

**Files:**
- GenKit core setup: [ai/genkit.ts](file:///c:/Users/HP/Projects/nibbotfinal/src/ai/genkit.ts#L1-L7) — uses `GOOGLE_API_KEY` from env at runtime; no key is hardcoded anywhere in the repo (I grep'd, nothing found).
- Content Suggester: [ai/flows/admin-content-suggester.ts](file:///c:/Users/HP/Projects/nibbotfinal/src/ai/flows/admin-content-suggester.ts#L1-L76)
- Content Translator: `ai/flows/admin-content-translator.ts` (structurally identical — input schema with `text` + `targetLanguage`, prompt tells Gemini to translate preserving tone and formatting placeholders.)

### 10.1 Content Suggester Schema

**Input Zod schema:**
```ts
{
  prompt:  string,  // "a welcome message for a new user guide"
  context: string?  // "brand values = innovation, customer focus"
}
```

**Output:** `{ suggestedContent: string }` — rendered straight into the WYSIWYG editor as a draft. Admin must review and explicitly save it.

**Prompt template:**
```
You are an AI content assistant for an admin panel.
Your task is to generate draft content for a menu or submenu section...

Instructions:
- If context is provided, use it to inform the tone, style, and specific details.
- Output should be standalone content suitable for a WYSIWYG editor.
- Avoid conversational intros/outros; just provide the content.

Prompt: {{{prompt}}}
{{#if context}}Context: {{{context}}}{{/if}}
```

### 10.2 Security Note (IMPORTANT)
**Neither server action currently validates admin session / role.** They are "protected" only by the fact that admin panel components call them — there is no in-action RBAC. Anyone who can invoke a Next.js server action (guessing its obfuscated endpoint name) can currently invoke these unauthenticated. This is VA finding C-2 from the earlier report. **Add `getValidatedAdminSession` checks inside both flows before shipping.**

---

## 11. The Live Agent / 3CX Widget

The Live Agent isn't an AI feature, but it was added alongside the AI and shares the admin toggle surface.

**File:** [ThreeCXLiveChat.tsx](file:///c:/Users/HP/Projects/nibbotfinal/src/components/ThreeCXLiveChat.tsx#L1-L622)

### 11.1 How the Widget Loads
```
1. App renders <ThreeCXLiveChat bubbleVisible={bool} /> when appSettings.liveAgentEnabled !== false
2. useEffect loads <script src="/vendor/3cx/callus">  — NOT direct to downloads-global.3cx.com
   Why? Cross-Origin-Embedder-Policy / CORB on 3CX's CDN script was blocking the widget
   when served from a strict-CSP origin. Proxying via same-origin path solves it.
3. <call-us-selector> custom element rendered:
   attributes:
     phonesystem-url   = "https://callcenter.nibbank.com.et"
     party             = "LiveChat854959"
     ...plus style/font color attrs.
4. 3CX script boots inside shadow DOM (widget DOM is NOT in document.querySelector scope)
```

### 11.2 Proxy Script Endpoint
`GET /vendor/3cx/callus` → [vendor/3cx/callus/route.ts](file:///c:/Users/HP/Projects/nibbotfinal/src/app/vendor/3cx/callus/route.ts) fetches `https://downloads-global.3cx.com/downloads/livechatandtalk/v1/callus.js`, sets `Cross-Origin-Resource-Policy: same-origin`, and streams it through. SRI/integrity check not currently performed.

### 11.3 Finding the Bubble in the Shadow DOM

The 3CX widget lives entirely inside a closed? No — it uses **open** shadow roots. But it's shadow-inside-shadow, nested arbitrarily depending on 3CX version. So `openThreeCXLiveChat()` (L122) walks the DOM **using a breadth-first search of all shadow roots** ([L364-412](file:///c:/Users/HP/Projects/nibbotfinal/src/components/ThreeCXLiveChat.tsx#L364-L412)) until it finds a `.minimized-button` class element. That's the floating chat bubble.

Once found, `button.click()` fires on it, which is exactly what the user click does. CSS `pointer-events: none` (the bubbleVisible=false mechanism) only blocks real pointer-device events — a scripted `.click()` call **bypasses** pointer-events. This is the root cause of the original toggle bug you reported.

### 11.4 Bubble Visibility (CSS Custom Properties, Not DOM Removal)
When `bubbleVisible=false` is passed to the component, it sets two inline CSS variables on the outer host container element:
```
--nib-3cx-bubble-opacity: 0
--nib-3cx-bubble-pointer-events: none
```
And `WIDGET_ROOT_OVERRIDE_CSS` (a full stylesheet injected into every found shadow root, L145-204) applies these vars to the bubble button. This is why the bubble **exists** in the DOM but isn't visible/clickable. The 3CX widget itself was never unloaded — just visually hidden. When `liveAgentEnabled !== false` the **component itself doesn't mount** ([ChatInterface.tsx L2303](file:///c:/Users/HP/Projects/nibbotfinal/src/components/user/ChatInterface.tsx#L2303)), which properly unmounts everything. The separate `bubbleVisible` toggle is the problematic middle-ground.

---

## 12. KB Configuration (Every Setting, Deeply Explained)

**DB Table:** `kb_config` (singleton, id=1)  
**API:** `GET/PUT /api/admin/kb/config`  
**Config loader:** `loadKBConfig()` L19-L36 in kb.ts  
**Defaults chain:** DB column value → if null/absent, env var → if env missing, hardcoded literal in loadKBConfig.  
**Cache:** 10-second TTL `CONFIG_CACHE_MS` in-process (L12-L18 / L38-L43) — saves a DB round-trip on every query since these are rarely changed.

### Full Settings Deep Dive

| Setting (DB/UI name) | Prisma column + default | loadKBConfig chain | Engineering Explanation |
|---|---|---|---|
| **Enable AI (master switch)** | `enabled Boolean @default(true)` | DB → `KB_ENABLED !== 'false'` env → true | If `false`, queryKB() immediately throws `kb_disabled` (HTTP 503). Admin Test AI button bypass? No, also blocked. Used as fallback when DB row doesn't exist yet and env `KB_ENABLED=false` lets you globally disable without DB write. |
| **Embedding Model** | `embeddingModel @default("bge-m3")` | DB → `OLLAMA_EMBED_MODEL` env → `"bge-m3"` | Passed verbatim to Ollama `/api/embeddings`. `bge-m3` is the current default because it's multilingual (English + Amharic both work well) and emits exactly 1024 dims, matching `vector(1024)` column. **WARNING:** If you change this, you **must** REBUILD the entire KB (`Rebuild All` button). Different model → different vector space → old vectors are meaningless noise and cosine similarity will be garbage. |
| **Generation Model** | `generationModel @default("aya:8b")` | DB → `OLLAMA_GENERATE_MODEL` env → `"aya:8b"` | Passed to Ollama `/api/chat`. Aya:8b is multilingual (CohereForAI model, fine-tuned on 100+ languages including Amharic) and instruction-tuned for RAG-style answers. If you swap to qwen3/gemma etc., verify the `think:false` param is still respected and that Amharic output quality doesn't regress. |
| **Chunk Size** | `chunkSize @default(350)` | DB → `KB_CHUNK_SIZE` env → `350` | Max characters per chunk in recursive section splitting. NOT tokens, characters. 350 chars ≈ 85 tokens on bge-m3 / Aya. Why not bigger? bge-m3's strong performance window is ~256–512 tokens; 350 chars keeps most single-topic fragments tight. Too large → "About Us" entire page in one chunk → retrieval drags in unrelated paragraphs. Too small → loses context between sentences → cross-encoder can't recover. |
| **Chunk Overlap** | `chunkOverlap @default(60)` | DB → `60` | Character overlap between consecutive chunks in the same section. Word-boundary walked back so overlap never starts mid-word. 60 chars ≈ the tail of the previous sentence, which is enough context to preserve "sentence A → sentence B" cohesion that a hard split would break. Too high → duplicate content burns LLM context budget without helping retrieval. |
| **Top-K (Retrieval Depth)** | `topK @default(10)` | DB → `KB_TOP_K` env → `5` | **Wait:** `5` is the fallback in loadKBConfig but schema default is `10`. Default post-migrate will be `10`. Higher topK = more material in context for long "list all product types" questions, but more noise = more hallucination opportunities, and higher LLM context usage (cost + latency). Sweet spot for NIB is 5-10 depending on average chunk size and answer complexity. With reranking enabled, topK controls post-rerank selection. |
| **Min Score (Vector Confidence Threshold)** | `minScore @default(0.5)` | DB → `KB_MIN_SCORE` env → `0.5` | Minimum cosine similarity (1 - `<=>` distance) for vector-retrieved chunks. 0.5 is permissive — bge-m3 on real content typically gives 0.45–0.65 on correct matches for short/listy content, 0.70–0.80 on exact matches. Set too high (e.g. 0.72) and you reject genuinely correct matches (this was measured and documented in the schema comment at L370-L374). Set too low → No Answer rate drops, but wrong answers creep in (low-similarity chunks confuse the LLM). |
| **Generation Temperature** | `temperature @default(0.2)` | DB → `KB_TEMPERATURE` env → `0.2` | 0.0 = fully deterministic (greedy or low-T sampling), 2.0 = maximum creativity. **For factual banking RAG, 0.1–0.3 is the accepted range.** 0.2 adds tiny non-zero variation so identical questions don't produce byte-for-byte identical answers (sometimes useful to avoid "bot" vibe), but is still far too cold for the LLM to invent facts. If answers sound repetitive: bump to 0.4 max. Never go ≥ 1.0 on factual content — hallucinations begin sharply at T≥0.7. |
| **Enable Cross-Encoder Reranker** | `rerankerEnabled @default(false)` | DB → `KB_RERANKER_ENABLED === 'true'` → `false` (disabled by default). False off unless you deploy the FastAPI reranker service to port 8001. Turning it on without that service running: harmless! Every call fails within 8s, falls back to RRF order, and the user sees zero difference. Just adds 8s latency per English query. |
| **Reranker Model** | `rerankerModel @default("bge-reranker-base")` | DB → `KB_RERANKER_MODEL` env → `"bge-reranker-base"` | Purely informational label passed through for the UI/admin — the `RERANKER_URL` service decides internally which model it actually loads. Keep this in sync with the service's model so admin doesn't get confused about what model is running. |
| **Rerank Pool Size** | `rerankPoolSize @default(15)` | DB → `KB_RERANK_POOL_SIZE` env → `15` | How many top-RRF-ranked candidates to feed into the cross-encoder. Cross-encoder work is O(N) linear — 15 = 8 passages × 15 pairs ~120 inferences. Aya:8b CPU inference is slow; this 15-candidate limit keeps rerank latency at 2–4 seconds. Raising to 30 roughly doubles rerank latency and improves recall on hard multi-page queries only marginally. |
| **Rerank Min Score** | `rerankMinScore @default(0.25)` | DB → `KB_RERANK_MIN_SCORE` env → `0.25` | Minimum cross-encoder sigmoid output for a "relevant" chunk. This is NOT a cosine similarity scale. bge-reranker-base outputs a single sigmoided logit per (query, passage) pair, theoretically 0–1. BUT our chunks start every text with the page name / heading as a grounding prefix, which bge-reranker reads as label noise, depressing scores across the board. Measured correct matches = ~0.37; wrong = <0.01. Default 0.25 sits in the middle. The schema comment (L381-L389) has the full backstory. If you ever change the chunk prefix format, RETUNE this threshold from scratch by measuring 50+ known-good + 50 known-bad pairs and plotting. |
| **System Prompt Override** | `systemPrompt String? @db.Text` | DB value → `null` (null means use the hardcoded default at L1300-L1322). Set this to override the entire LLM system prompt globally. **DANGER ZONE:** accidentally removing "do not invent information" or "reply in same language" will produce measurable behavior regressions within hours. If you edit this, copy the existing default, edit only a clause or two at a time, and test against the QA suite before saving. |
| *(updatedAt)* | `updatedAt @updatedAt` | Not exposed to query. Useful for debugging ("when was config last edited?"). |

### Configuration Env Variable Fallback Summary

If the `kb_config` DB row doesn't exist yet (fresh install before first admin open of KB config tab), every setting takes its value from these envs, or the hardcoded literals:

| Setting | Env Var | Hardcoded Fallback |
|---|---|---|
| enabled | `KB_ENABLED` (≠'false' → true) | `true` |
| embeddingModel | `OLLAMA_EMBED_MODEL` | `bge-m3` |
| generationModel | `OLLAMA_GENERATE_MODEL` | `aya:8b` |
| chunkSize | `KB_CHUNK_SIZE` | `350` |
| chunkOverlap | *(none)* | `60` |
| topK | `KB_TOP_K` | `5` |
| minScore | `KB_MIN_SCORE` | `0.5` |
| temperature | `KB_TEMPERATURE` | `0.2` |
| rerankerEnabled | `KB_RERANKER_ENABLED` | `false` |
| rerankerModel | `KB_RERANKER_MODEL` | `bge-reranker-base` |
| rerankPoolSize | `KB_RERANK_POOL_SIZE` | `15` |
| rerankMinScore | `KB_RERANK_MIN_SCORE` | `0.25` |
| systemPrompt | *(none)* | `null` → use default prompt |
| VECTOR_DIMS | `KB_VECTOR_DIMS` | `1024` (NOT in KBConfig; DB column is `vector(1024)` — changing this requires migration + full rebuild) |

---

## 13. Security Controls in the KB Pipeline

### 13.1 Question Sanitization (`sanitizeQuestion` L1019-L1028)
- **HTML strip:** `.replace(/<[^>]*>/g, '')` — prevents XSS-in-question (answers are rendered with sanitizeHtml too, but defense in depth)
- **Max length 500 chars** (KB is for short banking questions, essays aren't needed; long inputs = prompt injection opportunity + Ollama ctx burn)
- **9 injection patterns** (L1007-L1017): "ignore previous instructions", "forget everything", "you are now", "act as new", "jailbreak", `system:`, `[system]`, `[/inst]`, `<|im_start|>` (Meta Llama format). Fail closed (400) on any match.
- **Note:** History answer strings bypass injection regex (only 1000-char length and HTML stripped). This is acceptable because answer strings come from OUR server's own prior output; the real injection surface is the user's actual question.

### 13.2 Rate Limiting (`checkRateLimit` L1035-L1046)
- Per-`sessionId`, 10 queries/60 s.
- In-memory `Map`. Resets every 5 min (scavenge).
- **Note:** Distributed / multi-worker deployments lose inter-worker rate limits (see VA finding H-4). If you horizontally scale beyond 1 process, switch to Redis `enforceRateLimit` from [lib/rateLimit.ts](file:///c:/Users/HP/Projects/nibbotfinal/src/lib/rateLimit.ts).

### 13.3 Ollama / Reranker Network Boundaries
- Both URLs default to `localhost`. No API token/bearer auth currently. If you ever bind them to non-loopback, add `OLLAMA_API_KEY`/bearer header.
- SSRF in `/api/proxy` has explicit private-IP/DNS rebinding block; can't reach Ollama even if allowlist is misconfigured.

### 13.4 Disabled Article Gating
End-user `hybridSearch()` has `ka.enabled = true OR ${includeDisabledArticles}` in the WHERE clause. Admin Test AI passes `includeDisabledArticles=true`; public route passes undefined (false). Disabled articles **cannot** leak to end users.

### 13.5 Response Size Budget
- `numPredict=600` caps generated answers.
- Question, each history entry, and chunks all have enforced size caps — prevents oversized LLM context attacks.

---

## 14. Observability — Query Logs, Audit Trails, Status

### 14.1 KB Query Logs
Table: `kb_query_logs`. Populated by **fire-and-forget raw INSERT** in both success and no-answer paths. Admin table: KB Management → "Query Logs" tab.

Filtering:
- Quick filters: Today / 7d / 30d / Custom (with Start+End Date, Start+End Time hh:mm)
- Pagination (10/page by default, up to 50/page)
- Columns: Time, Session, Question, Answer preview, No Answer?, Confidence, Sources (resolved menu/article names), Duration (ms), Error

### 14.2 Interaction Logs (General)
Every KB query also writes to the unified `interaction_logs` table (same table used for menu-click / form-response bot interactions). Tags added: `kb_query`, `lang:xx`, `confidence:xx`, status = success/failed/error.

### 14.3 KB Status Tab
`getKBStatus()` + `getKBConfig()` → returns per-menu:
- name, kbEnabled, approval status, chunk count (number of rows in kb_chunks for that menu), last indexed (max `indexedAt` among chunks)
- + aggregate summary: totalMenus / indexedMenus / totalChunks / lastIndexed (global max)
- "Rebuild All" button calls `POST /api/admin/kb/rebuild` (serial loop, no progress bar, takes minutes on large KBs — leave the tab open).

### 14.4 Admin Audit Logs (`audit_logs` table)
Separate from KB query logs — this is for admin actions. `PUT /api/admin/kb/config` calls `logSecurityEvent` with action `UPDATE_KB_CONFIG`. Includes actor username, changed fields JSON, IP, UA. KB article create/update/delete and menu save routes also write to audit_logs similarly.

---

## 15. Environment Variables

| Env Var | Used In | Purpose |
|---|---|---|
| `OLLAMA_URL` | kb.ts L7 | Base URL for Ollama service |
| `RERANKER_URL` | kb.ts L8 | Base URL for FastAPI reranker |
| `KB_VECTOR_DIMS` | kb.ts L9 | Embedding width (default 1024). MUST match `Unsupported("vector(1024)")` column. |
| `KB_ENABLED` | kb.ts L22 | Global disable switch (before DB config row exists) |
| `OLLAMA_EMBED_MODEL` | kb.ts L23 | Default embedding model pre-config |
| `OLLAMA_GENERATE_MODEL` | kb.ts L24 | Default generation model pre-config |
| `KB_CHUNK_SIZE` | kb.ts L25 | Default chunk size pre-config |
| `KB_TOP_K` | kb.ts L27 | Default topK pre-config |
| `KB_MIN_SCORE` | kb.ts L28 | Default minScore pre-config |
| `KB_TEMPERATURE` | kb.ts L29 | Default temperature pre-config |
| `KB_RERANKER_ENABLED` | kb.ts L30 | Reranker enabled default |
| `KB_RERANKER_MODEL` | kb.ts L31 | Reranker model label default |
| `KB_RERANK_POOL_SIZE` | kb.ts L32 | Rerank pool default |
| `KB_RERANK_MIN_SCORE` | kb.ts L33 | Rerank threshold default |
| `GOOGLE_API_KEY` | ai/genkit.ts (via genkit SDK) | Required for admin Content Suggester/Translator (Gemini cloud API) |
| `PROXY_ALLOWED_HOSTS` / `ALLOWED_API_DOMAINS` | api/proxy/route.ts | SSRF allowlist — ensure Ollama URL host isn't accidentally added |

---

## 16. The Admin UI (KBManagement) — Every Tab Explained

**File:** [components/admin/KBManagement.tsx](file:///c:/Users/HP/Projects/nibbotfinal/src/components/admin/KBManagement.tsx#L71-L1550)

5 tabs total:

### Tab 1 — Status
- Summary card (indexed menus / total chunks / last indexed)
- Per-menu table with chunk count, last indexed, KB-enabled toggle (reads menu.kbEnabled), approval status
- Per-menu "Reindex" action, global "Rebuild All" button

### Tab 2 — Test AI
- Textarea for a test question, language selector (en/am/...)
- "Run Test" → hits `POST /api/admin/kb/test` → `queryKB(..., includeDisabledArticles: true)` — so disabled articles ARE visible here
- Returns confidence badge, full answer, sources list with individual scores, rerankScore vs vecScore indicators

### Tab 3 — Config (KBConfig form, L1318-L1500ish)
Every setting from Section 12 as a labeled input with real-time numeric validation (min/max enforced in PUT handler too):
1. Enable AI (Switch)
2. Top K (Number, min=1)
3. Min Score (Number 0.0–1.0 step 0.01)
4. Embedding Model (Text)
5. Generation Model (Text)
6. Temperature (0.0–2.0)
7. Enable Reranker (Switch — enables sub-inputs below)
   - Reranker Model (Text, disabled if switch off)
   - Rerank Pool Size (Number ≥1, disabled if off)
   - Rerank Min Score (0.0–1.0, disabled if off)
8. System Prompt Override (Textarea, optional — blank = revert to default)

### Tab 4 — Query Logs
`getKBQueryLogs()` table with:
- Date range filter (presets + custom start/end datetime pair)
- Pagination controls
- Columns: Timestamp, Session ID, Question (truncated), Answer (preview), Confidence badge, Sources (resolved names), Duration ms, Error type
- Every row clickable (or expandable) for full text? Current impl: flat table with text truncation

### Tab 5 — Articles
CRUD for standalone AI articles:
- List all articles: Title, languages present (EN/AM/...), Enabled toggle, chunk count, last updated
- Create new / Edit existing:
  - Language sub-tabs: EN (title/body) → AM (titleAm/bodyAm) → plus one tab per configured language from AppSettings.supportedLanguages (stored in translations map keyed by lang code)
  - **Body editor: WYSIWYG (same WysiwygEditor as menu content)** → goes through htmlToText() at index time, same exact pipeline
  - Enabled toggle (affects end-user visibility only; admin Test AI always sees)
- Per-article actions: Index now, Clear chunks only (keeps article), Delete article + chunks

All article routes:
- `GET/POST /api/admin/kb/articles` (list all + create)
- `PUT/DELETE /api/admin/kb/articles/[id]` (edit + delete)
- `POST /api/admin/kb/index` (body: `{ articleId? }` or `{ menuId? }` — triggers indexMenu or indexArticle)
- `DELETE /api/admin/kb/index?articleId=...` or `?menuId=...` — clears chunks only

---

**That is every moving part end-to-end.** If you need clarification on any specific step or want me to drill even deeper into a function (e.g. the actual vector math, the CSP header for Live Agent, or the WYSIWYG→HTML flow), ask and I'll open that section further.

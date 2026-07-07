# AI / Knowledge Base configuration guide

This covers every tunable knob behind the "Ask AI" (KB) feature — what each one
does, where it lives, and how to re-tune it safely. For how to *write content*
that the AI can find, see `KB_CONTENT_GUIDELINES.md`. For first-time setup, see
`../RUNBOOK.md`. For running/restarting/troubleshooting the reranker
microservice itself, see `RERANKER_SERVICE.md`.

## Where configuration lives

Everything is a single row in the `kb_config` table (id=1), editable at
**Admin → Knowledge Base → Config**. Environment variables (`.env`) are only
fallback defaults used if that row doesn't exist yet — once the row exists,
changing `.env` has no effect. Config is cached in-memory for 10 seconds
(`CONFIG_CACHE_MS` in `src/lib/kb.ts`), so a saved change takes effect within
10 seconds, not instantly.

## Reference

| Field (admin UI label) | DB column | Default | What it controls |
|---|---|---|---|
| Embedding model | `embedding_model` | `bge-m3` | Ollama model used to embed both content chunks and incoming questions. **Changing this requires a full reindex** (Rebuild All) — old and new embeddings aren't comparable. If the new model's output dimension differs from 1024, see "Changing embedding dimensions" below. |
| Generation model | `generation_model` | `aya:8b` (this deployment currently uses `qwen3:8b`) | Ollama model that writes the final answer from retrieved context. See "Reasoning/thinking models" below before switching models. |
| Generation temperature | `temperature` | 0.2 | Lower = more deterministic, literal answers. Don't raise this for a factual Q&A bot — it increases the chance of paraphrasing away exact numbers/dates the system prompt otherwise insists on preserving. |
| Top-K results | `top_k` | 10 | How many chunks are sent to the LLM as context per query. See "Why top_k=10, not 5" below — don't drop this back to a small number without re-testing, especially on content-heavy pages. |
| Minimum confidence score | `min_score` | 0.5 | Vector cosine-similarity threshold (0–1). Below this, the query returns "No Answer" instead of risking a bad answer. This is **not** a generic "quality knob" — see "Why min_score=0.5, not 0.72" below; it's calibrated to `bge-m3`'s actual score range on this content, not an arbitrary confidence percentage. |
| Chunk size / overlap | `chunk_size` / `chunk_overlap` | 350 / 60 chars | How content is split before embedding. Changing this **requires a full reindex**. Larger chunks capture more context per chunk but blur distinct facts together; smaller chunks are more precise but need a higher `top_k` to give the LLM enough coverage. |
| Enable cross-encoder reranking | `reranker_enabled` | `false` | Adds a second-pass relevance scoring step via a separate microservice (see `../reranker-service/`). Off by default because it requires standing up that service; see "The reranker" below for what it actually does and its real tradeoffs. |
| Reranker model | `reranker_model` | `bge-reranker-base` | Informational only — the actual model is whatever the reranker microservice is configured to serve. This field isn't sent anywhere; it's a label for your own reference. |
| Rerank pool size | `rerank_pool_size` | 15 | How many candidates are retrieved (before reranking) for the cross-encoder to sort through. Must be ≥ `top_k` to have anything to gain from reranking. |
| Post-rerank confidence threshold | `rerank_min_score` | 0.25 | Cross-encoder relevance-probability threshold, used **instead of** `min_score` when reranking is enabled. Do not compare this number to `min_score` — they're different scales (see below). |
| System prompt | `system_prompt` | built-in NIB prompt | Full override of the instructions given to the generation model. Leave blank to use the default (identifies the bank, forbids inventing facts, insists on exact dates/numbers, matches the user's language). |

## Why `top_k=10`, not 5

Content is chunked per-section (every heading is a hard chunk boundary — see
`KB_CONTENT_GUIDELINES.md`), so a single well-organized page can produce 10+
sibling chunks. With `top_k=5`, the correct chunk was routinely just outside
the cutoff whenever its page had many sections — confirmed by direct testing:
lowering `top_k` reintroduced false "No Answer" responses on questions that
worked at `top_k=10`. If your content is mostly short, single-topic pages, a
lower value works fine; if pages commonly have 5+ headings, don't go below 10
without re-testing against real questions first.

## Why `min_score=0.5`, not 0.72

`bge-m3` cosine similarity for genuinely correct short/listy bank content
measured in the **0.37–0.55** range during testing — nowhere near 0.72, even
for verified-correct matches. 0.72 was an untested guess; 0.5 is calibrated
against real measured scores, confirmed via direct queries against the live
database (see the debugging approach below). If you raise this, verify with
real questions first — it's very easy to make the bot say "No Answer" to
things it actually knows.

## Query normalization (typo correction + casing restoration)

Before a question ever reaches embedding or reranking, `normalizeQuery()` in
`src/lib/kb.ts` runs it against a vocabulary built from the KB's own indexed
content (cached 60s — see `VOCAB_CACHE_MS`). It does two things, not
configurable and not something you should need to touch:

- **Corrects obvious misspellings** of domain terms against that vocabulary
  (e.g. "vission" → "vision"). Deliberately conservative: only words ≥4
  letters, not a common English word (see `COMMON_WORDS`), within a tight
  edit-distance budget. A missed typo just falls back to normal behavior.
- **Restores each word's dominant casing** as it actually appears in your
  content — e.g. "nib" → "NIB". This matters more than it sounds: the
  cross-encoder reranker scored an identical passage **6x lower** for
  lowercase "nib" than "NIB", because lowercase "nib" also reads as an
  ordinary English word (a pen nib) unrelated to the bank, confusing the
  model's relevance judgment.

**Why a stopword list exists**: an earlier version corrected *any* word not
in the vocabulary, including ordinary English words the KB just never happens
to use verbatim — it "corrected" "What" to "that" (edit distance 1) purely
because "what" doesn't appear in the indexed content, silently turning "What
are NIB's core values?" into "that are NIB's Core values?" and breaking
retrieval. `COMMON_WORDS` exempts question words, articles, prepositions, and
other function words from typo-correction entirely, since they're
near-universally spelled correctly and there's nothing to gain by "fixing"
them. If you see a query get mangled in an unexpected way, this list — not
the edit-distance threshold — is the first place to check.

## Enumeration questions ("what types of X does the bank offer")

A cross-encoder reranker scores each candidate passage independently against
the query — it optimizes for "single best-matching passage," not "every
member of the category being asked about." Measured concretely on "What types
of deposit accounts does NIB offer?": the reranker scored a vague intro
sentence ("we offer a variety of deposit accounts") at **0.99** — the highest
of all candidates — while "Diaspora Accounts," a literal correct answer,
scored **0.003**. Left alone, this structurally buries genuine category
members below irrelevant content once a page has more sections than fit in
`top_k`.

`queryKB()` in `src/lib/kb.ts` detects enumeration-style phrasing (`types`,
`kinds`, `categories`, `list`, `all`, `various`, `different`, `options` —
see `ENUMERATION_HINTS`) and, when matched, pulls in every chunk belonging to
the top-ranked chunk's page from the wider retrieval pool — not just whichever
individual passages the reranker scored highest — capped at 20 total chunks.
This only fires for enumeration-shaped questions; ordinary single-fact
questions are unaffected and don't pay the extra context/token cost.

If you notice a "list all X" style question still coming back incomplete,
check whether it actually contains one of the `ENUMERATION_HINTS` words —
phrasing that doesn't match (e.g. "what deposit accounts can I open" with no
"types/kinds/all/list") won't trigger the backfill.

## Reasoning / "thinking" models

Some models (e.g. `qwen3` family) emit an internal chain-of-thought "thinking"
block before the real answer. Left unchecked, this was observed burning the
**entire** token budget on thinking and returning empty content — causing both
slow responses and outright timeouts. `src/lib/kb.ts`'s `generate()` always
sends `think: false` to Ollama to disable this; it's a no-op for models that
don't support thinking mode, so this is safe regardless of which generation
model you pick. If you add a new generation model, no config change is needed
here — this is handled in code, not per-model config.

## The reranker: what it actually buys you, and its real cost

Reranking adds a second HTTP call (to the separate `reranker-service/`
microservice) that re-scores the `rerank_pool_size` retrieved candidates using
a real cross-encoder, then keeps the top `top_k`. This catches cases where
plain vector+BM25 ranking put the wrong chunk first even though the right one
was retrieved somewhere in the pool.

**Cost**: measured at roughly 170–250ms per candidate passage on this
deployment's CPU — so a `rerank_pool_size` of 15 costs ~2.5–3.5s per query, and
30 costs ~5.3–7.4s. This is a real, user-visible latency cost, not a rounding
error — don't raise `rerank_pool_size` without weighing it against response
time. It also requires that microservice to be running (see
`RERANKER_SERVICE.md` for setup, restarting, and running it as a persistent
service). If it's down or slow, queries silently fall back to the plain
(non-reranked) path — reranking is never a hard dependency.

**Reranking only runs for English, by design** (`lang === 'en'` check in
`queryKB()`). `bge-reranker-base` was measured scoring a verified-correct
Amharic chunk at **0.05** — real discrimination existed (a wrong chunk scored
0.00006), but the entire scale sat far below `rerank_min_score`, while plain
vector search scored that same correct chunk at 0.70 (comfortably above
`min_score`). This isn't a threshold to retune per language — it looks like
the model being poorly calibrated for Amharic/Ge'ez script generally, so
non-English queries skip reranking entirely and rely on vector+BM25, which
already handles them well. If you add a reranker model with real multilingual
support later, this per-language gate is the place to revisit.

**A real interaction to know about**: every chunk is prefixed with its page
name and section heading for lexical/vector grounding (so a question like
"When was NIB established?" can match an isolated "History" section that
doesn't repeat the word "NIB" itself). `bge-reranker-base` reads that
prefix as label noise and scores everything lower than it would score clean
prose — measured ~0.37 for a verified-correct match with the prefix present,
vs. 0.98 for the same content with no prefix. This is *why* `rerank_min_score`
is 0.25, not something like 0.6–0.8 as cross-encoder scores are often
described in the abstract. If you ever change how chunks are prefixed or
labeled, re-measure this threshold rather than assuming it still holds — the
scale is specific to this system's chunk format, not a general cross-encoder
property.

## Changing the embedding model / dimensions

If the new embedding model outputs the same vector size (1024, matching
`bge-m3`), just: pull the model in Ollama, set it in the config UI, then
**Rebuild All**. If the dimension differs, this requires a schema migration
(`kb_chunks.embedding` is `vector(1024)` with an HNSW index built for that
size) before you can reindex — see `KB_VECTOR_DIMS` in `.env` and the
migration pattern used in `prisma/migrations/20260703120000_restore_kb_embedding_column/`.

## How to re-tune any of this yourself

The values above weren't guessed — they came from directly querying the
database to see real scores for real questions, not from trusting the
top-level "No Answer" / "here's an answer" result alone. If retrieval quality
regresses after a content or model change, the fastest diagnosis path is:

1. Embed the failing question directly and run a raw `ORDER BY embedding <=>
   ...` query against `kb_chunks` — is the correct chunk in the results at
   all, and what's its actual score?
2. If reranking is on, call the reranker service's `/rerank` endpoint directly
   with the question and the candidate chunk texts — is it scoring the right
   one highest, and by how much versus wrong candidates?
3. Compare those real numbers to the configured thresholds — a threshold is
   only correct relative to the actual score distribution it's gating, not as
   an abstract "confidence percentage."

Don't tune `min_score` / `rerank_min_score` by guessing a "safer-sounding"
number — measure the real score for a known-correct case and a known-wrong
case first, then pick a threshold with margin on both sides.

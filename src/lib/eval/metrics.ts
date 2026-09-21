// ---------------------------------------------------------------------------
// Deterministic retrieval/context/abstention metrics for the AI Evaluation
// system. Pure functions only — no I/O, no Prisma, no LLM calls — so every
// number here is reproducible and independently unit-testable
// (tests/unit/eval.metrics.test.ts).
//
// Ground truth is resolved primarily at PAGE level (menuId/articleId), not
// chunk level: kb_chunks.id is an autoincrement that changes on every
// reindex (see the KBChunk doc comment in prisma/schema.prisma), so a
// dataset keyed on raw chunk ids would silently go stale after the next
// "Rebuild All." Page-level ground truth also matches how this system's own
// citations already work — KBResult.sources is deduplicated by menuId, never
// by chunk. Chunk-level ground truth is supported as an optional, best-effort
// secondary signal, validated against the live kb_chunks table by the caller.
// ---------------------------------------------------------------------------

export const DEFAULT_KS = [3, 5, 10, 20];

/** Per-rank relevance vector — the minimal shared representation every metric below operates on. */
export type RelevanceVector = boolean[];

export function hitRateAtK(rel: RelevanceVector, k: number): number {
  return rel.slice(0, k).some(Boolean) ? 1 : 0;
}

export function precisionAtK(rel: RelevanceVector, k: number): number {
  const top = rel.slice(0, k);
  if (!top.length) return 0;
  return top.filter(Boolean).length / top.length;
}

/** `totalRelevant` is the size of the ground-truth relevant set — NOT the count found in `rel`. */
export function recallAtK(rel: RelevanceVector, k: number, totalRelevant: number): number {
  if (totalRelevant <= 0) return 0;
  return rel.slice(0, k).filter(Boolean).length / totalRelevant;
}

export function mrr(rel: RelevanceVector): number {
  const idx = rel.findIndex(Boolean);
  return idx === -1 ? 0 : 1 / (idx + 1);
}

/** Binary-relevance nDCG@K (gain = 1 for a relevant hit, 0 otherwise). */
export function ndcgAtK(rel: RelevanceVector, k: number, totalRelevant: number): number {
  const top = rel.slice(0, k);
  const dcg = top.reduce((sum, hit, i) => sum + (hit ? 1 / Math.log2(i + 2) : 0), 0);
  const idealHits = Math.min(totalRelevant, k);
  if (idealHits <= 0) return 0;
  let idcg = 0;
  for (let i = 0; i < idealHits; i++) idcg += 1 / Math.log2(i + 2);
  return idcg === 0 ? 0 : dcg / idcg;
}

export type MetricsAtK = { k: number; hitRate: number; recall: number; precision: number; ndcg: number };
export type MetricsReport = { mrr: number; byK: MetricsAtK[] };

function metricsFromRelevance(rel: RelevanceVector, totalRelevant: number, ks: number[]): MetricsReport {
  return {
    mrr: mrr(rel),
    byK: ks.map(k => ({
      k,
      hitRate: hitRateAtK(rel, k),
      recall: recallAtK(rel, k, totalRelevant),
      precision: precisionAtK(rel, k),
      ndcg: ndcgAtK(rel, k, totalRelevant),
    })),
  };
}

function dedupeByMenu<T extends { menuId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item.menuId)) {
      seen.add(item.menuId);
      out.push(item);
    }
  }
  return out;
}

/**
 * Page-level metrics: dedupe the ranked chunk list down to one entry per
 * distinct source page (first occurrence wins — i.e. the page's own best
 * rank), then score that ranked-page list against relevantMenuIds. Returns
 * null when the test case has no page-level ground truth at all (nothing to
 * score against — not the same as "found nothing," which is a rel vector of
 * all-false).
 */
export function computePageLevelMetrics(
  rankedChunks: { menuId: string }[],
  relevantMenuIds: string[],
  ks: number[] = DEFAULT_KS,
): MetricsReport | null {
  if (!relevantMenuIds.length) return null;
  const relevantSet = new Set(relevantMenuIds);
  const rankedPages = dedupeByMenu(rankedChunks);
  const rel = rankedPages.map(p => relevantSet.has(p.menuId));
  return metricsFromRelevance(rel, relevantSet.size, ks);
}

/**
 * Chunk-level metrics: best-effort, only computed against relevantChunkIds
 * that still exist in the live kb_chunks table (`validChunkIds`, supplied by
 * the caller — the runner queries this once per run, not once per case).
 * Stale ids (referencing a chunk deleted by a since-run reindex) are
 * reported separately rather than silently miscounted into the score.
 */
export function computeChunkLevelMetrics(
  rankedChunks: { id: number }[],
  relevantChunkIds: number[],
  validChunkIds: Set<number>,
  ks: number[] = DEFAULT_KS,
): (MetricsReport & { staleIds: number[] }) | null {
  const staleIds = relevantChunkIds.filter(id => !validChunkIds.has(id));
  const valid = relevantChunkIds.filter(id => validChunkIds.has(id));
  if (!valid.length) return null;
  const relevantSet = new Set(valid);
  const rel = rankedChunks.map(c => relevantSet.has(c.id));
  return { ...metricsFromRelevance(rel, relevantSet.size, ks), staleIds };
}

export type AbstentionOutcome =
  | 'correct_abstention'
  | 'incorrect_abstention'
  | 'hallucinated_answer'
  | 'correct_answer'
  | 'not_applicable';

/**
 * Deterministic — no judge needed for this core classification. The judge's
 * own `abstention.correct` verdict (a softer, semantic check — e.g. did the
 * model produce an answer-shaped non-answer like "I don't have details on
 * that") is stored separately on JudgeEvaluation, never merged into this.
 */
export function computeAbstentionOutcome(answerable: boolean, noAnswer: boolean): AbstentionOutcome {
  if (answerable) return noAnswer ? 'incorrect_abstention' : 'correct_answer';
  return noAnswer ? 'correct_abstention' : 'hallucinated_answer';
}

import {
  hitRateAtK,
  precisionAtK,
  recallAtK,
  mrr,
  ndcgAtK,
  computePageLevelMetrics,
  computeChunkLevelMetrics,
  computeAbstentionOutcome,
} from '../../src/lib/eval/metrics';

describe('eval/metrics — relevance-vector primitives', () => {
  test('hitRateAtK: 1 if any relevant item within top K, else 0', () => {
    expect(hitRateAtK([false, false, true, false], 3)).toBe(1);
    expect(hitRateAtK([false, false, true, false], 2)).toBe(0);
    expect(hitRateAtK([false, false, false], 5)).toBe(0);
  });

  test('precisionAtK: fraction of top K that are relevant', () => {
    expect(precisionAtK([true, false, true, false], 4)).toBeCloseTo(0.5);
    expect(precisionAtK([true, true], 5)).toBeCloseTo(1); // slicing beyond length is fine
    expect(precisionAtK([], 5)).toBe(0);
  });

  test('recallAtK: relevant-found-in-top-K divided by TOTAL relevant (not found count)', () => {
    // 1 of 3 total relevant items appears in the top 2
    expect(recallAtK([true, false, false, false], 2, 3)).toBeCloseTo(1 / 3);
    expect(recallAtK([true, true, true], 3, 3)).toBeCloseTo(1);
    expect(recallAtK([true], 1, 0)).toBe(0); // no ground truth => 0, not divide-by-zero garbage
  });

  test('mrr: reciprocal rank of the first relevant hit, 0 if none', () => {
    expect(mrr([false, false, true, true])).toBeCloseTo(1 / 3);
    expect(mrr([true, false])).toBe(1);
    expect(mrr([false, false])).toBe(0);
  });

  test('ndcgAtK: perfect ranking scores 1.0, no hits scores 0', () => {
    expect(ndcgAtK([true, true, false], 3, 2)).toBeCloseTo(1);
    expect(ndcgAtK([false, false, false], 3, 2)).toBe(0);
    // Worse ranking (relevant item pushed to rank 3 instead of rank 1) scores strictly less than ideal
    const ideal = ndcgAtK([true, false, false], 3, 1);
    const worse = ndcgAtK([false, false, true], 3, 1);
    expect(ideal).toBeCloseTo(1);
    expect(worse).toBeLessThan(ideal);
  });
});

describe('eval/metrics — computePageLevelMetrics', () => {
  test('returns null when the test case has no page-level ground truth', () => {
    expect(computePageLevelMetrics([{ menuId: 'a' }], [])).toBeNull();
  });

  test('dedupes multiple chunks from the same page before scoring', () => {
    // Same page appears 3 times in a row at the top — should count as ONE
    // hit at rank 1, not inflate precision/recall by repetition.
    const ranked = [
      { menuId: 'relevant-page' },
      { menuId: 'relevant-page' },
      { menuId: 'other-page' },
      { menuId: 'relevant-page' },
    ];
    const result = computePageLevelMetrics(ranked, ['relevant-page'], [3]);
    expect(result).not.toBeNull();
    expect(result!.mrr).toBe(1);
    const at3 = result!.byK.find(m => m.k === 3)!;
    // Deduped ranked-page list is [relevant-page, other-page] — precision@3 over 2 items = 1/2
    expect(at3.precision).toBeCloseTo(0.5);
    expect(at3.recall).toBeCloseTo(1); // the one relevant page was found
  });

  test('reproduces the documented rerank_pool_size bug: a narrower pool misses a relevant page entirely', () => {
    // Simulates enumeration backfill's dependency on pool width (see
    // docs/AI_CONFIG.md and src/lib/kb.ts's fetchLimit) — a page with many
    // sibling chunks only shows up if the pool was wide enough to contain it.
    const widePool = [
      { menuId: 'fees-page' }, { menuId: 'other' }, { menuId: 'fees-page' }, { menuId: 'fees-page' },
    ];
    const narrowPool = [{ menuId: 'other' }, { menuId: 'unrelated' }];
    const relevant = ['fees-page'];
    expect(computePageLevelMetrics(widePool, relevant, [3])!.byK[0].recall).toBe(1);
    expect(computePageLevelMetrics(narrowPool, relevant, [3])!.byK[0].recall).toBe(0);
  });
});

describe('eval/metrics — computeChunkLevelMetrics', () => {
  test('returns null when no relevantChunkIds survive validation against live kb_chunks', () => {
    const validIds = new Set([10, 11]);
    expect(computeChunkLevelMetrics([{ id: 10 }], [999], validIds)).toBeNull();
  });

  test('reports stale ids separately instead of silently miscounting them', () => {
    const validIds = new Set([10, 11]);
    const result = computeChunkLevelMetrics([{ id: 10 }, { id: 12 }], [10, 999], validIds, [5]);
    expect(result).not.toBeNull();
    expect(result!.staleIds).toEqual([999]);
    expect(result!.byK[0].recall).toBe(1); // the one valid relevant id (10) was found
  });
});

describe('eval/metrics — computeAbstentionOutcome', () => {
  test('answerable question, answer given => correct_answer', () => {
    expect(computeAbstentionOutcome(true, false)).toBe('correct_answer');
  });
  test('answerable question, no answer given => incorrect_abstention', () => {
    expect(computeAbstentionOutcome(true, true)).toBe('incorrect_abstention');
  });
  test('unanswerable question, no answer given => correct_abstention', () => {
    expect(computeAbstentionOutcome(false, true)).toBe('correct_abstention');
  });
  test('unanswerable question, an answer was still generated => hallucinated_answer', () => {
    expect(computeAbstentionOutcome(false, false)).toBe('hallucinated_answer');
  });
});

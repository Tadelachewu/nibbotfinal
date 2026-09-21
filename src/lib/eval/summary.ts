// ---------------------------------------------------------------------------
// Aggregates one EvaluationRun's per-question EvaluationResult/JudgeEvaluation
// rows into the numbers the admin dashboard actually shows. Deliberately
// keeps "success" (retrieval + generation quality) and "failure/safety"
// (errors, hallucination, incorrect abstention, judge parse failures)
// as separate groups, never blended into one score — see §25 of the eval
// spec ("do not create a fake overall score").
// ---------------------------------------------------------------------------
import prisma from '@/lib/prisma';
import { DEFAULT_KS, type MetricsReport } from '@/lib/eval/metrics';

type RetrievalAgg = {
  mrr: number;
  byK: { k: number; hitRate: number; recall: number; precision: number; ndcg: number }[];
  sampleSize: number;
};

export interface RunSummary {
  runId: number;
  totalCases: number;
  completedCases: number;
  failedCases: number;
  errorRate: number | null;

  retrieval: {
    pool: RetrievalAgg | null;
    reranked: RetrievalAgg | null;
    context: RetrievalAgg | null;
  };

  generation: {
    faithfulness: number | null;
    correctness: number | null;
    relevance: number | null;
    completeness: number | null;
    contextRelevance: number | null;
    overallScore: number | null;
    sampleSize: number;
  };

  safety: {
    hallucinationRate: number | null;
    unsupportedClaimRate: number | null;
    abstentionAccuracy: number | null;
    incorrectAbstentionRate: number | null;
    hallucinatedAnswerRate: number | null;
    judgeParseFailureRate: number | null;
    abstentionSampleSize: number;
  };

  citations: {
    correctness: number | null;
    completeness: number | null;
  };

  performance: {
    p50Ms: number | null;
    p95Ms: number | null;
    p99Ms: number | null;
    avgEmbedMs: number | null;
    avgRetrieveMs: number | null;
    avgRerankMs: number | null;
    avgGenerateMs: number | null;
  };
}

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
}

function averageMetricsReports(reports: MetricsReport[]): RetrievalAgg | null {
  if (!reports.length) return null;
  const mrr = avg(reports.map(r => r.mrr))!;
  const byK = DEFAULT_KS.map(k => {
    const rows = reports.map(r => r.byK.find(b => b.k === k)).filter((b): b is NonNullable<typeof b> => !!b);
    return {
      k,
      hitRate: avg(rows.map(r => r.hitRate)) ?? 0,
      recall: avg(rows.map(r => r.recall)) ?? 0,
      precision: avg(rows.map(r => r.precision)) ?? 0,
      ndcg: avg(rows.map(r => r.ndcg)) ?? 0,
    };
  });
  return { mrr, byK, sampleSize: reports.length };
}

export async function computeRunSummary(runId: number): Promise<RunSummary | null> {
  const run = await prisma.evaluationRun.findUnique({ where: { id: runId } });
  if (!run) return null;

  const results = await prisma.evaluationResult.findMany({
    where: { runId },
    include: { judgeEvaluation: true },
  });

  const errorRate = results.length ? results.filter(r => r.status !== 'success').length / results.length : null;

  // ---- Retrieval (deterministic, from traceJson-derived retrievalMetrics/contextMetrics stored per result) ----
  const poolReports: MetricsReport[] = [];
  const rerankedReports: MetricsReport[] = [];
  const contextReports: MetricsReport[] = [];
  for (const r of results) {
    const rm = r.retrievalMetrics as any;
    const cm = r.contextMetrics as any;
    if (rm?.pool?.pageLevel) poolReports.push(rm.pool.pageLevel);
    if (rm?.reranked?.pageLevel) rerankedReports.push(rm.reranked.pageLevel);
    if (cm?.pageLevel) contextReports.push(cm.pageLevel);
  }

  // ---- Generation quality (from judged, successfully-parsed results only) ----
  const judged = results.map(r => r.judgeEvaluation).filter((j): j is NonNullable<typeof j> => !!j);
  const parsedJudged = judged.filter(j => j.parsedOk);

  // ---- Safety ----
  const applicableAbstention = results.filter(r => r.abstentionOutcome !== 'not_applicable');
  const abstentionAccuracy = applicableAbstention.length
    ? applicableAbstention.filter(r => r.abstentionOutcome === 'correct_abstention' || r.abstentionOutcome === 'correct_answer').length / applicableAbstention.length
    : null;
  const incorrectAbstentionRate = applicableAbstention.length
    ? applicableAbstention.filter(r => r.abstentionOutcome === 'incorrect_abstention').length / applicableAbstention.length
    : null;
  const hallucinatedAnswerRate = applicableAbstention.length
    ? applicableAbstention.filter(r => r.abstentionOutcome === 'hallucinated_answer').length / applicableAbstention.length
    : null;

  const judgedWithHallucinationFlag = judged.filter(j => j.hallucinationDetected !== null);
  const hallucinationRate = judgedWithHallucinationFlag.length
    ? judgedWithHallucinationFlag.filter(j => j.hallucinationDetected).length / judgedWithHallucinationFlag.length
    : null;

  const claimCounts = parsedJudged.filter(j => j.supportedClaims != null && j.unsupportedClaims != null);
  const totalSupported = claimCounts.reduce((s, j) => s + (j.supportedClaims ?? 0), 0);
  const totalUnsupported = claimCounts.reduce((s, j) => s + (j.unsupportedClaims ?? 0), 0);
  const unsupportedClaimRate = (totalSupported + totalUnsupported) > 0
    ? totalUnsupported / (totalSupported + totalUnsupported)
    : null;

  const judgeParseFailureRate = judged.length
    ? judged.filter(j => !j.parsedOk).length / judged.length
    : null;

  // ---- Latency (percentiles via raw SQL — Prisma has no portable percentile aggregate) ----
  const latencyRows = await prisma.$queryRaw<{ p50: number | null; p95: number | null; p99: number | null }[]>`
    SELECT
      percentile_cont(0.5)  WITHIN GROUP (ORDER BY "totalMs") AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY "totalMs") AS p95,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY "totalMs") AS p99
    FROM evaluation_results
    WHERE "runId" = ${runId} AND "totalMs" IS NOT NULL
  `;
  const latency = latencyRows[0] ?? { p50: null, p95: null, p99: null };

  return {
    runId,
    totalCases: run.totalCases,
    completedCases: run.completedCases,
    failedCases: run.failedCases,
    errorRate,

    retrieval: {
      pool: averageMetricsReports(poolReports),
      reranked: averageMetricsReports(rerankedReports),
      context: averageMetricsReports(contextReports),
    },

    generation: {
      faithfulness: avg(parsedJudged.map(j => j.faithfulnessScore).filter((v): v is number => v != null)),
      correctness: avg(parsedJudged.map(j => j.correctnessScore).filter((v): v is number => v != null)),
      relevance: avg(parsedJudged.map(j => j.relevanceScore).filter((v): v is number => v != null)),
      completeness: avg(parsedJudged.map(j => j.completenessScore).filter((v): v is number => v != null)),
      contextRelevance: avg(parsedJudged.map(j => j.contextRelevanceScore).filter((v): v is number => v != null)),
      overallScore: avg(parsedJudged.map(j => j.overallScore).filter((v): v is number => v != null)),
      sampleSize: parsedJudged.length,
    },

    safety: {
      hallucinationRate,
      unsupportedClaimRate,
      abstentionAccuracy,
      incorrectAbstentionRate,
      hallucinatedAnswerRate,
      judgeParseFailureRate,
      abstentionSampleSize: applicableAbstention.length,
    },

    citations: {
      correctness: avg(parsedJudged.map(j => j.citationCorrectnessScore).filter((v): v is number => v != null)),
      completeness: avg(parsedJudged.map(j => j.citationCompletenessScore).filter((v): v is number => v != null)),
    },

    performance: {
      p50Ms: latency.p50,
      p95Ms: latency.p95,
      p99Ms: latency.p99,
      avgEmbedMs: avg(results.map(r => r.embedMs).filter((v): v is number => v != null)),
      avgRetrieveMs: avg(results.map(r => r.retrieveMs).filter((v): v is number => v != null)),
      avgRerankMs: avg(results.map(r => r.rerankMs).filter((v): v is number => v != null)),
      avgGenerateMs: avg(results.map(r => r.generateMs).filter((v): v is number => v != null)),
    },
  };
}

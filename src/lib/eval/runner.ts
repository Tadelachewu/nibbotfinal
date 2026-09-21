// ---------------------------------------------------------------------------
// AI Evaluation runner. Calls the REAL production RAG pipeline (queryKB())
// for every test case — this is deliberately not a reimplementation of
// retrieval/generation, so eval results reflect exactly what a real user
// would get. Runs as a fire-and-forget background job, the same pattern
// already used for KB reindexing (src/app/api/admin/kb/rebuild/route.ts):
// the API route returns 202 immediately, the client polls EvaluationRun's
// status/completedCases/failedCases for progress.
// ---------------------------------------------------------------------------
import prisma from '@/lib/prisma';
import { queryKB, type QueryTrace, type QueryTraceChunk } from '@/lib/kb';
import {
  computePageLevelMetrics,
  computeChunkLevelMetrics,
  computeAbstentionOutcome,
  DEFAULT_KS,
} from '@/lib/eval/metrics';
import { runJudge, DEFAULT_JUDGE_WEIGHTS, type JudgeOutput } from '@/lib/eval/judge';
import type { EvaluationRun, EvaluationTestCase } from '@prisma/client';

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let idx = 0;
  async function lane(): Promise<void> {
    while (idx < items.length) {
      const item = items[idx++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, lane));
}

async function isCancelled(runId: number): Promise<boolean> {
  const row = await prisma.evaluationRun.findUnique({ where: { id: runId }, select: { cancelRequested: true } });
  return row?.cancelRequested ?? false;
}

function retrievalMetricsFor(
  chunks: QueryTraceChunk[] | undefined,
  testCase: EvaluationTestCase,
  validChunkIds: Set<number>,
) {
  if (!chunks) return null;
  return {
    pageLevel: computePageLevelMetrics(chunks, testCase.relevantMenuIds, DEFAULT_KS),
    chunkLevel: computeChunkLevelMetrics(chunks, testCase.relevantChunkIds, validChunkIds, DEFAULT_KS),
  };
}

function buildCitationRows(claims: JudgeOutput['claims'], chunks: QueryTraceChunk[]) {
  return claims.map((c, i) => {
    const cited = c.citedIndex && c.citedIndex >= 1 && c.citedIndex <= chunks.length
      ? chunks[c.citedIndex - 1]
      : null;
    return {
      order: i,
      claimText: c.claim,
      citedSourceRef: cited?.menuId ?? null,
      citationExists: !!cited,
      // Citations are only ever drawn from the same `chunks` array the judge
      // was given as context, so a valid index is definitionally "points to
      // something retrieved" — this mainly guards against an out-of-range
      // index the judge invented.
      pointsToRetrieved: !!cited,
      supportsClaim: c.status === 'supported' || c.status === 'partial',
    };
  });
}

async function processTestCase(
  run: EvaluationRun,
  testCase: EvaluationTestCase,
  validChunkIds: Set<number>,
): Promise<void> {
  const sessionId = `eval:${run.id}:${testCase.id}`;
  const trace: QueryTrace = {};
  const start = Date.now();

  let attempt = 0;
  let lastError: unknown = null;
  let ok = false;

  while (attempt <= run.maxRetries && !ok) {
    try {
      const result = await queryKB(testCase.question, testCase.language, sessionId, {
        includeDisabledArticles: run.includeDisabledArticles,
        trace,
      });

      const abstentionOutcome = computeAbstentionOutcome(testCase.answerable, result.noAnswer);
      const retrievalMetrics = {
        pool: retrievalMetricsFor(trace.pool, testCase, validChunkIds),
        reranked: retrievalMetricsFor(trace.reranked ?? undefined, testCase, validChunkIds),
      };
      const contextMetrics = retrievalMetricsFor(trace.chunks, testCase, validChunkIds);

      let judgeCreateData: any = undefined;
      // Judge gating — three short-circuits skip the (expensive) judge call:
      //   1. This run was created with `judgeEnabled=false` (either the global
      //      EvalJudgeConfig.enabled default or an explicit per-run override
      //      supplied in the runs/POST body).
      //   2. The KB produced a "No Answer" — judging an empty response is
      //      meaningless, the abstention outcome already classifies it.
      //   3. (Existing behaviour) no answer was produced by queryKB().
      const judgeWanted = !!run.judgeEnabled;
      if (judgeWanted && !result.noAnswer) {
        const judgeConfigRow = await prisma.evalJudgeConfig.findUnique({ where: { id: 1 } });
        const judgeResult = await runJudge(
          {
            question: testCase.question,
            context: trace.context ?? '',
            answer: result.answer,
            expectedAnswer: testCase.expectedAnswer,
            noAnswer: result.noAnswer,
          },
          {
            provider: run.judgeProvider,
            model: run.judgeModel,
            temperature: run.judgeTemperature,
            // Fallbacks match EvalJudgeConfig's schema defaults (see
            // prisma/schema.prisma) — realistic for CPU-only Ollama
            // inference, not the original untested 60s/1500-token guess.
            maxTokens: judgeConfigRow?.maxTokens ?? 600,
            timeoutMs: judgeConfigRow?.timeoutMs ?? 240_000,
            retryCount: judgeConfigRow?.retryCount ?? 2,
            weights: (judgeConfigRow?.weightsJson as Record<string, number> | null) ?? DEFAULT_JUDGE_WEIGHTS,
          },
        );

        const out = judgeResult.output;
        judgeCreateData = {
          create: {
            judgeProvider: run.judgeProvider,
            judgeModel: run.judgeModel,
            judgeTemperature: run.judgeTemperature,
            rawResponse: judgeResult.rawResponse,
            parsedOk: judgeResult.parsedOk,
            retryCount: judgeResult.retryCount,
            faithfulnessScore: out?.faithfulness.score ?? null,
            supportedClaims: out?.faithfulness.supportedClaims ?? null,
            unsupportedClaims: out?.faithfulness.unsupportedClaims ?? null,
            correctnessScore: out?.correctness.score ?? null,
            relevanceScore: out?.relevance.score ?? null,
            completenessScore: out?.completeness.score ?? null,
            contextRelevanceScore: out?.contextRelevance.score ?? null,
            hallucinationDetected: out?.hallucination.detected ?? null,
            hallucinationSeverity: out?.hallucination.severity ?? null,
            citationCorrectnessScore: out?.citationCorrectness.score ?? null,
            citationCompletenessScore: out?.citationCompleteness.score ?? null,
            abstentionCorrect: out?.abstention.correct ?? null,
            overallScore: judgeResult.overallScore,
            weightsJson: judgeResult.weights,
            reasoning: out?.reasoning ?? null,
            claims: out
              ? { create: out.claims.map((c, i) => ({
                order: i,
                claimText: c.claim,
                supportStatus: c.status,
                supportingChunkRef: c.citedIndex != null && trace.chunks?.[c.citedIndex - 1]
                  ? trace.chunks[c.citedIndex - 1].menuId
                  : null,
                confidence: c.confidence,
              })) }
              : undefined,
            citations: out
              ? { create: buildCitationRows(out.claims, trace.chunks ?? []) }
              : undefined,
          },
        };
      }

      const totalMs = Date.now() - start;
      await prisma.evaluationResult.create({
        data: {
          runId: run.id,
          testCaseId: testCase.id,
          question: testCase.question,
          expectedAnswer: testCase.expectedAnswer,
          generatedAnswer: result.noAnswer ? null : result.answer,
          noAnswer: result.noAnswer,
          confidence: result.noAnswer ? null : result.confidence,
          sources: result.noAnswer ? [] : result.sources,
          traceJson: trace as any,
          retrievalMetrics: retrievalMetrics as any,
          contextMetrics: contextMetrics as any,
          abstentionOutcome,
          rewriteMs: trace.timings?.rewriteMs ?? null,
          normalizeMs: trace.timings?.normalizeMs ?? null,
          embedMs: trace.timings?.embedMs ?? null,
          retrieveMs: trace.timings?.retrieveMs ?? null,
          rerankMs: trace.timings?.rerankMs ?? null,
          generateMs: trace.timings?.generateMs ?? null,
          totalMs,
          status: 'success',
          judgeEvaluation: judgeCreateData,
        },
      });

      await prisma.evaluationRun.update({
        where: { id: run.id },
        data: { completedCases: { increment: 1 } },
      });
      ok = true;
    } catch (err) {
      lastError = err;
      attempt++;
    }
  }

  if (!ok) {
    const isTimeout = lastError instanceof Error && lastError.name === 'TimeoutError';
    await prisma.evaluationResult.create({
      data: {
        runId: run.id,
        testCaseId: testCase.id,
        question: testCase.question,
        expectedAnswer: testCase.expectedAnswer,
        noAnswer: false,
        abstentionOutcome: 'not_applicable',
        traceJson: trace as any,
        totalMs: Date.now() - start,
        status: isTimeout ? 'timeout' : 'error',
        errorMessage: String((lastError as Error)?.message ?? lastError).slice(0, 2000),
      },
    });
    await prisma.evaluationRun.update({
      where: { id: run.id },
      data: { failedCases: { increment: 1 } },
    });
  }
}

/**
 * Starts (or resumes) an evaluation run. Fire-and-forget from the API route
 * — never awaited by the HTTP request. Resumability: only test cases that
 * don't already have a `status:'success'` EvaluationResult for this run are
 * (re)processed, so calling this again on a partially-failed run picks up
 * exactly where it left off, with no extra state beyond the results table
 * itself.
 */
export async function startEvaluationRun(runId: number): Promise<void> {
  const run = await prisma.evaluationRun.findUnique({ where: { id: runId } });
  if (!run) return;

  await prisma.evaluationRun.update({
    where: { id: runId },
    data: { status: 'running', startedAt: run.startedAt ?? new Date(), cancelRequested: false },
  });

  try {
    const where: any = { datasetId: run.datasetId, isActive: true };
    if (run.categoryFilter.length) where.category = { in: run.categoryFilter };
    if (run.testCaseIdFilter.length) where.id = { in: run.testCaseIdFilter };

    const allCases = await prisma.evaluationTestCase.findMany({ where });
    const alreadySucceeded = await prisma.evaluationResult.findMany({
      where: { runId, status: 'success' },
      select: { testCaseId: true },
    });
    const doneIds = new Set(alreadySucceeded.map(r => r.testCaseId));
    const pending = allCases.filter(tc => !doneIds.has(tc.id));

    // Any earlier failed/error EvaluationResult rows for these cases are
    // superseded by this attempt — clear them so results stay one-row-per-
    // (run,testCase) without violating the unique constraint on retry.
    if (pending.length) {
      await prisma.evaluationResult.deleteMany({
        where: { runId, testCaseId: { in: pending.map(tc => tc.id) }, status: { in: ['error', 'timeout'] } },
      });
    }

    await prisma.evaluationRun.update({
      where: { id: runId },
      data: { totalCases: allCases.length },
    });

    const validChunkIds = new Set((await prisma.kBChunk.findMany({ select: { id: true } })).map(c => c.id));

    await runWithConcurrency(pending, run.concurrency, async testCase => {
      if (await isCancelled(runId)) return;
      await processTestCase(run, testCase, validChunkIds);
    });

    const cancelled = await isCancelled(runId);
    const finalRun = await prisma.evaluationRun.findUnique({ where: { id: runId } });
    const status = cancelled
      ? 'cancelled'
      : (finalRun?.failedCases ?? 0) > 0
        ? 'completed_with_failures'
        : 'completed';

    await prisma.evaluationRun.update({
      where: { id: runId },
      data: { status, completedAt: new Date() },
    });
  } catch (err) {
    console.error(`[eval] run ${runId} crashed:`, err);
    await prisma.evaluationRun.update({
      where: { id: runId },
      data: { status: 'failed', completedAt: new Date() },
    }).catch(() => null);
  }
}

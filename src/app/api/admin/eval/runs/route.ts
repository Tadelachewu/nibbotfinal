import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session';
import { logSecurityEvent } from '@/lib/logger';
import { isEvalAdmin } from '@/lib/eval/authz';
import { getKBConfig } from '@/lib/kb';
import { startEvaluationRun } from '@/lib/eval/runner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20));

  const [runs, total] = await Promise.all([
    prisma.evaluationRun.findMany({
      orderBy: { createdAt: 'desc' },
      skip: page * pageSize,
      take: pageSize,
      include: { dataset: { select: { name: true } } },
    }),
    prisma.evaluationRun.count(),
  ]);

  return NextResponse.json({
    status: 'success',
    data: runs,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }
  if (!(await isEvalAdmin(session.username))) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const datasetId = Number(body?.datasetId);
  if (!Number.isInteger(datasetId)) {
    return NextResponse.json({ status: 'error', message: 'datasetId is required.' }, { status: 400 });
  }
  const dataset = await prisma.evaluationDataset.findUnique({ where: { id: datasetId } });
  if (!dataset) {
    return NextResponse.json({ status: 'error', message: 'Dataset not found.' }, { status: 404 });
  }

  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : `${dataset.name} — ${new Date().toISOString()}`;
  const categoryFilter = Array.isArray(body?.categoryFilter) ? body.categoryFilter.filter((v: unknown) => typeof v === 'string') : [];
  const testCaseIdFilter = Array.isArray(body?.testCaseIdFilter) ? body.testCaseIdFilter.filter((v: unknown) => Number.isInteger(v)) : [];
  // Default 1, not a higher number — see EvaluationRun.concurrency's schema
  // comment: concurrent generate() calls don't parallelize on CPU-only
  // Ollama inference, they just context-switch and can slow every case down.
  const concurrency = Number.isInteger(body?.concurrency) && body.concurrency >= 1 ? Math.min(body.concurrency, 10) : 1;
  const maxRetries = Number.isInteger(body?.maxRetries) && body.maxRetries >= 0 ? Math.min(body.maxRetries, 5) : 1;
  const includeDisabledArticles = typeof body?.includeDisabledArticles === 'boolean' ? body.includeDisabledArticles : false;

  // Snapshot both RAG and judge config as they stand right now — see
  // src/lib/eval/runner.ts's header comment on why this is a label
  // ("what was live when the run was created"), not a guarantee that every
  // case in the run used exactly this config if an admin changes KBConfig
  // mid-run. queryKB() always uses the live config, same as it would for a
  // real user — the per-case trace snapshot captured on each EvaluationResult
  // is the source of truth for what actually ran for that specific case.
  const kbConfig = await getKBConfig();
  const judgeConfig = await prisma.evalJudgeConfig.findUnique({ where: { id: 1 } });
  const systemPromptHash = createHash('sha256').update(kbConfig.systemPrompt ?? '').digest('hex').slice(0, 16);
  // judgeEnabled precedence:
  //   1. Explicit boolean in the POST body (per-run override — allows a single
  //      retrieval-only debug run without touching global defaults)
  //   2. EvalJudgeConfig.enabled from the DB row
  //   3. EVAL_JUDGE_ENABLED env var (default true)
  const judgeEnabledFromEnv = process.env.EVAL_JUDGE_ENABLED !== 'false';
  const judgeEnabled = typeof body?.judgeEnabled === 'boolean'
    ? body.judgeEnabled
    : (judgeConfig?.enabled ?? judgeEnabledFromEnv);

  const run = await prisma.evaluationRun.create({
    data: {
      name,
      datasetId,
      datasetVersion: dataset.version,
      concurrency,
      maxRetries,
      categoryFilter,
      testCaseIdFilter,
      includeDisabledArticles,
      embeddingModel: kbConfig.embeddingModel,
      generationModel: kbConfig.generationModel,
      chunkSize: kbConfig.chunkSize,
      chunkOverlap: kbConfig.chunkOverlap,
      topK: kbConfig.topK,
      minScore: kbConfig.minScore,
      temperature: kbConfig.temperature,
      rerankerEnabled: kbConfig.rerankerEnabled,
      rerankerModel: kbConfig.rerankerModel,
      rerankPoolSize: kbConfig.rerankPoolSize,
      rerankMinScore: kbConfig.rerankMinScore,
      systemPromptHash,
      judgeEnabled,
      judgeProvider: judgeConfig?.provider ?? 'ollama',
      judgeModel: judgeConfig?.model ?? 'qwen3:8b',
      judgeTemperature: judgeConfig?.temperature ?? 0,
      createdBy: session.username,
    },
  });

  await logSecurityEvent({
    actor: session.username,
    action: 'CREATE_EVAL_RUN',
    target: `evaluation_run:${run.id}`,
    details: { datasetId, name, concurrency },
    ip: session.ip,
    userAgent: session.userAgent,
  });

  // Fire-and-forget — same pattern as /api/admin/kb/rebuild. The client
  // polls GET /api/admin/eval/runs/[id] for live progress.
  startEvaluationRun(run.id).catch(err => console.error(`[eval] run ${run.id} failed to start:`, err));

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json(
    { status: 'success', message: 'Run started. Poll /api/admin/eval/runs/:id for progress.', data: run },
    { status: 202 },
  );
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

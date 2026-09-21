import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session';
import { logSecurityEvent } from '@/lib/logger';
import { isEvalAdmin } from '@/lib/eval/authz';
import { DEFAULT_JUDGE_WEIGHTS } from '@/lib/eval/judge';

export const dynamic = 'force-dynamic';

// Singleton row (id=1), same pattern as /api/admin/kb/config.
export async function GET() {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }

  const config = await prisma.evalJudgeConfig.findUnique({ where: { id: 1 } });
  // Read EVAL_JUDGE_ENABLED env once as the seed default for the synthetic
  // row returned before the admin saves the first time — a server operator
  // who starts with the judge disabled via env won't see a misleading "on"
  // in the UI preview.
  const envEnabledDefault = process.env.EVAL_JUDGE_ENABLED !== 'false';
  return NextResponse.json({
    status: 'success',
    data: config ?? {
      id: 1, enabled: envEnabledDefault, provider: 'ollama', model: 'qwen3:8b',
      temperature: 0, maxTokens: 600, timeoutMs: 240000, retryCount: 2,
      weightsJson: DEFAULT_JUDGE_WEIGHTS,
    },
  });
}

export async function PUT(req: NextRequest) {
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
  const data: Record<string, unknown> = {};
  if (typeof body?.enabled === 'boolean') data.enabled = body.enabled;
  if (typeof body?.provider === 'string' && body.provider.trim()) data.provider = body.provider.trim();
  if (typeof body?.model === 'string' && body.model.trim()) data.model = body.model.trim();
  if (Number.isFinite(body?.temperature) && body.temperature >= 0 && body.temperature <= 2) data.temperature = body.temperature;
  if (Number.isInteger(body?.maxTokens) && body.maxTokens >= 100) data.maxTokens = body.maxTokens;
  if (Number.isInteger(body?.timeoutMs) && body.timeoutMs >= 1000) data.timeoutMs = body.timeoutMs;
  if (Number.isInteger(body?.retryCount) && body.retryCount >= 0 && body.retryCount <= 5) data.retryCount = body.retryCount;
  if (body?.weightsJson && typeof body.weightsJson === 'object') data.weightsJson = body.weightsJson;

  if (!Object.keys(data).length) {
    return NextResponse.json({ status: 'error', message: 'No valid fields to update.' }, { status: 400 });
  }

  const config = await prisma.evalJudgeConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  await logSecurityEvent({
    actor: session.username,
    action: 'UPDATE_EVAL_JUDGE_CONFIG',
    target: 'eval_judge_config:1',
    details: data,
    ip: session.ip,
    userAgent: session.userAgent,
  });

  const nextToken = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', data: config });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

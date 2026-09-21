import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session';
import { logSecurityEvent } from '@/lib/logger';
import { getKBConfig } from '@/lib/kb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getValidatedAdminSession(false);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  const config = await getKBConfig();
  return NextResponse.json({ status: 'success', data: config });
}

export async function PUT(req: Request) {
  const session = await getValidatedAdminSession(true);
  if (!session?.username) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized.' }, { status: 401 });
  }
  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    return NextResponse.json({ status: 'error', message: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'error', message: 'Invalid request body.' }, { status: 400 });
  }

  const data: Record<string, any> = {};
  if (typeof body.enabled         === 'boolean') data.enabled         = body.enabled;
  if (typeof body.embeddingModel  === 'string' && body.embeddingModel.trim())
    data.embeddingModel = body.embeddingModel.trim();
  if (typeof body.generationModel === 'string' && body.generationModel.trim())
    data.generationModel = body.generationModel.trim();
  if (body.generationProvider === 'ollama' || body.generationProvider === 'openrouter')
    data.generationProvider = body.generationProvider;
  if (body.openrouterModel === null || typeof body.openrouterModel === 'string')
    data.openrouterModel = body.openrouterModel || null;
  if (Number.isFinite(body.chunkSize)   && body.chunkSize  >= 100) data.chunkSize  = body.chunkSize;
  if (Number.isFinite(body.chunkOverlap)&& body.chunkOverlap >= 0) data.chunkOverlap = body.chunkOverlap;
  if (Number.isFinite(body.topK)        && body.topK >= 1)         data.topK       = body.topK;
  if (Number.isFinite(body.minScore)    && body.minScore >= 0 && body.minScore <= 1)
    data.minScore = body.minScore;
  if (Number.isFinite(body.temperature) && body.temperature >= 0 && body.temperature <= 2)
    data.temperature = body.temperature;
  if (typeof body.rerankerEnabled === 'boolean') data.rerankerEnabled = body.rerankerEnabled;
  if (body.rerankerModel === null || typeof body.rerankerModel === 'string')
    data.rerankerModel = body.rerankerModel || null;
  if (Number.isFinite(body.rerankPoolSize) && body.rerankPoolSize >= 1)
    data.rerankPoolSize = body.rerankPoolSize;
  if (Number.isFinite(body.rerankMinScore) && body.rerankMinScore >= 0 && body.rerankMinScore <= 1)
    data.rerankMinScore = body.rerankMinScore;
  if (body.systemPrompt === null || typeof body.systemPrompt === 'string')
    data.systemPrompt = body.systemPrompt || null;

  if (!Object.keys(data).length) {
    return NextResponse.json({ status: 'error', message: 'No valid fields to update.' }, { status: 400 });
  }

  await prisma.kBConfig.upsert({
    where:  { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  await logSecurityEvent({
    actor:  session.username,
    action: 'UPDATE_KB_CONFIG',
    target: 'kb_config:1',
    details: data,
    ip:     session.ip,
    userAgent: session.userAgent,
  });

  const config     = await getKBConfig();
  const nextToken  = await rotateCsrfToken(session);
  const res = NextResponse.json({ status: 'success', data: config });
  res.headers.set('x-csrf-token', nextToken);
  return res;
}

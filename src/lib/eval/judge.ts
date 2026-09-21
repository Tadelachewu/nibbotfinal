// ---------------------------------------------------------------------------
// LLM-as-a-Judge for the AI Evaluation system. Runs only from the eval
// runner (src/lib/eval/runner.ts) — never on the production /api/kb/query
// path. Reuses kb.ts's exported `generate()` (retry/timeout/think:false
// handling already tested in production) instead of a second hand-rolled
// Ollama client.
// ---------------------------------------------------------------------------
import { z } from 'zod';
import { generate } from '@/lib/kb';

// ---------------------------------------------------------------------------
// Provider abstraction — §9 of the eval spec: "do not hard-code one
// provider." Only Ollama is wired up today (nothing else is configured in
// this deployment); adding a second provider later is implementing this
// interface and registering it in getJudgeProvider(), no other code changes.
// ---------------------------------------------------------------------------
export interface JudgeChatOptions {
  temperature: number;
  timeoutMs: number;
  maxTokens: number;
}

export interface JudgeProvider {
  chat(systemPrompt: string, userPrompt: string, opts: JudgeChatOptions): Promise<string>;
}

class OllamaJudgeProvider implements JudgeProvider {
  constructor(private model: string) {}
  async chat(systemPrompt: string, userPrompt: string, opts: JudgeChatOptions): Promise<string> {
    return generate(systemPrompt, userPrompt, this.model, {
      temperature: opts.temperature,
      timeoutMs: opts.timeoutMs,
      numPredict: opts.maxTokens,
    });
  }
}

export function getJudgeProvider(provider: string, model: string): JudgeProvider {
  switch (provider) {
    case 'ollama':
      return new OllamaJudgeProvider(model);
    default:
      throw new Error(`Unknown judge provider: "${provider}". Only "ollama" is implemented today.`);
  }
}

export interface JudgeRunConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  retryCount: number;
  weights?: Record<string, number>;
}

// Sums to 1.0. hallucination/abstention are safety flags, not part of the
// weighted score — never hidden inside one number (§25 of the eval spec).
export const DEFAULT_JUDGE_WEIGHTS: Record<string, number> = {
  faithfulness: 0.25,
  correctness: 0.25,
  relevance: 0.15,
  completeness: 0.15,
  contextRelevance: 0.05,
  citationCorrectness: 0.075,
  citationCompleteness: 0.075,
};

// ---------------------------------------------------------------------------
// Structured output schema (§8) — validated with zod (already a project
// dependency). `citedIndex` is 1-based and refers to the same `[i]` bracket
// numbering kb.ts's queryKB() already uses when building context — the
// runner maps it back to a real chunk/menuId deterministically rather than
// trusting a citation format invented for the judge.
// ---------------------------------------------------------------------------
const claimSchema = z.object({
  claim: z.string(),
  status: z.enum(['supported', 'unsupported', 'partial']),
  citedIndex: z.number().int().nullable().optional().default(null),
  confidence: z.number().min(0).max(1).nullable().optional().default(null),
});

export const judgeOutputSchema = z.object({
  faithfulness: z.object({
    score: z.number().min(0).max(1),
    supportedClaims: z.number().int().min(0),
    unsupportedClaims: z.number().int().min(0),
  }),
  correctness: z.object({ score: z.number().min(0).max(1) }),
  relevance: z.object({ score: z.number().min(0).max(1) }),
  completeness: z.object({ score: z.number().min(0).max(1) }),
  contextRelevance: z.object({ score: z.number().min(0).max(1) }),
  hallucination: z.object({
    detected: z.boolean(),
    severity: z.enum(['low', 'medium', 'high']).nullable().optional().default(null),
  }),
  citationCorrectness: z.object({ score: z.number().min(0).max(1) }),
  citationCompleteness: z.object({ score: z.number().min(0).max(1) }),
  abstention: z.object({ correct: z.boolean().nullable().optional().default(null) }),
  claims: z.array(claimSchema).default([]),
  reasoning: z.string().default(''),
});

export type JudgeOutput = z.infer<typeof judgeOutputSchema>;

export interface JudgeInput {
  question: string;
  /** The exact `[i] (Source: ...)` bracketed context string sent to the generation model (trace.context). */
  context: string;
  answer: string;
  expectedAnswer?: string | null;
  /** True when the pipeline answered "No Answer" — changes the rubric focus to abstention correctness. */
  noAnswer: boolean;
}

export interface JudgeResult {
  parsedOk: boolean;
  retryCount: number;
  rawResponse: string;
  output: JudgeOutput | null;
  overallScore: number | null;
  weights: Record<string, number>;
}

function buildSystemPrompt(): string {
  return (
    'You are a strict, evidence-based evaluator of a Retrieval-Augmented ' +
    'Generation (RAG) chatbot answer for a bank. Do not just judge "is this ' +
    'good" — apply the rubric below literally, claim by claim.\n\n' +
    'STEP 1 — Extract every distinct factual claim the ANSWER makes.\n' +
    'STEP 2 — For each claim, decide if the CONTEXT actually supports it:\n' +
    '  "supported"   — the claim is directly stated or clearly implied by the context.\n' +
    '  "partial"     — the context supports part of the claim but not all of it (e.g. right fact, wrong number).\n' +
    '  "unsupported" — the claim is not present in the context at all (this is a hallucination).\n' +
    'For each claim, if it is supported/partial, set citedIndex to the context block number ' +
    '(the integer in "[i]") that supports it; otherwise null.\n' +
    'STEP 3 — Score every rubric dimension below using ONLY the claims analysis above, not a vibe check:\n' +
    '  faithfulness: supportedClaims / (supportedClaims + unsupportedClaims), counting "partial" as supported ' +
    'for the count but noting it in reasoning.\n' +
    '  correctness: does the answer match the EXPECTED ANSWER (when given) in substance — exact numbers/dates ' +
    'must match to count as correct.\n' +
    '  relevance: does the answer actually address the QUESTION asked, independent of correctness.\n' +
    '  completeness: for list/enumeration-style questions, did the answer include every relevant item present ' +
    'in the context, not just some.\n' +
    '  contextRelevance: how relevant is the CONTEXT itself to the QUESTION (a retrieval-quality judgment, ' +
    'independent of how the answer used it).\n' +
    '  hallucination: detected=true if ANY claim is "unsupported"; severity reflects how central that claim is ' +
    'to the answer (low = minor aside, high = the core claim of the answer).\n' +
    '  citationCorrectness: of the claims that cite a context block, what fraction actually point to a block ' +
    'that supports them.\n' +
    '  citationCompleteness: of the claims that ARE supported, what fraction were given a citedIndex at all.\n' +
    '  abstention.correct: only meaningful when the answer says it doesn\'t know / has no information — is that ' +
    'the right call given the context? null if the answer isn\'t an abstention.\n\n' +
    'Return ONLY a single JSON object, no markdown fences, no commentary before or after it, matching exactly ' +
    'this shape:\n' +
    JSON.stringify({
      faithfulness: { score: 0.0, supportedClaims: 0, unsupportedClaims: 0 },
      correctness: { score: 0.0 },
      relevance: { score: 0.0 },
      completeness: { score: 0.0 },
      contextRelevance: { score: 0.0 },
      hallucination: { detected: false, severity: null },
      citationCorrectness: { score: 0.0 },
      citationCompleteness: { score: 0.0 },
      abstention: { correct: null },
      claims: [{ claim: '...', status: 'supported', citedIndex: 1, confidence: 0.9 }],
      reasoning: '...',
    }, null, 2)
  );
}

function buildUserPrompt(input: JudgeInput): string {
  return (
    `QUESTION:\n${input.question}\n\n` +
    `CONTEXT (numbered blocks, as given to the chatbot):\n${input.context || '(no context — the chatbot found nothing and abstained)'}\n\n` +
    `ANSWER (what the chatbot actually said):\n${input.answer || '(no answer given — the chatbot abstained)'}\n\n` +
    (input.expectedAnswer ? `EXPECTED ANSWER (ground truth, for correctness/completeness comparison):\n${input.expectedAnswer}\n\n` : '') +
    `The chatbot ${input.noAnswer ? 'DID' : 'did NOT'} abstain (return "No Answer") on this question.`
  );
}

/** Best-effort extraction of a JSON object from a model response that may include markdown fences or stray prose. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      // fall through
    }
  }
  throw new Error('No parseable JSON found in judge response');
}

function computeOverallScore(output: JudgeOutput, weights: Record<string, number>): number {
  const scores: Record<string, number> = {
    faithfulness: output.faithfulness.score,
    correctness: output.correctness.score,
    relevance: output.relevance.score,
    completeness: output.completeness.score,
    contextRelevance: output.contextRelevance.score,
    citationCorrectness: output.citationCorrectness.score,
    citationCompleteness: output.citationCompleteness.score,
  };
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (typeof scores[key] === 'number' && weight > 0) {
      weightedSum += scores[key] * weight;
      weightTotal += weight;
    }
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

/**
 * Runs the judge on one (question, context, answer) triple. Never throws —
 * a malformed/unparseable response after `config.retryCount` retries comes
 * back as `{ parsedOk: false, output: null, rawResponse: <last raw text> }`
 * so the caller can persist the failure and move on to the next test case
 * without aborting the whole evaluation run.
 */
export async function runJudge(input: JudgeInput, config: JudgeRunConfig): Promise<JudgeResult> {
  const provider = getJudgeProvider(config.provider, config.model);
  const weights = config.weights ?? DEFAULT_JUDGE_WEIGHTS;
  const systemPrompt = buildSystemPrompt();
  const baseUserPrompt = buildUserPrompt(input);

  let lastRaw = '';
  let attempt = 0;
  const maxAttempts = Math.max(1, config.retryCount + 1);

  while (attempt < maxAttempts) {
    const correctionNote = attempt > 0
      ? `\n\nYour previous response could not be parsed as valid JSON matching the required shape. ` +
        `Return ONLY the JSON object this time — no markdown fences, no extra text before or after it.`
      : '';
    try {
      lastRaw = await provider.chat(systemPrompt, baseUserPrompt + correctionNote, {
        temperature: config.temperature,
        timeoutMs: config.timeoutMs,
        maxTokens: config.maxTokens,
      });
      const parsedJson = extractJson(lastRaw);
      const result = judgeOutputSchema.safeParse(parsedJson);
      if (result.success) {
        return {
          parsedOk: true,
          retryCount: attempt,
          rawResponse: lastRaw,
          output: result.data,
          overallScore: computeOverallScore(result.data, weights),
          weights,
        };
      }
    } catch (err) {
      lastRaw = lastRaw || String((err as Error)?.message ?? err);
    }
    attempt++;
  }

  return {
    parsedOk: false,
    retryCount: attempt,
    rawResponse: lastRaw,
    output: null,
    overallScore: null,
    weights,
  };
}

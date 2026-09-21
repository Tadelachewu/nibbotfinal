// Follows this repo's actual Jest convention (see tests/unit/auth.login.test.ts):
// mock dependencies with jest.doMock, jest.resetModules(), then dynamically
// import the module under test so each test gets a fresh mock wiring.

function validJudgeJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    faithfulness: { score: 0.8, supportedClaims: 2, unsupportedClaims: 0 },
    correctness: { score: 0.9 },
    relevance: { score: 1.0 },
    completeness: { score: 0.7 },
    contextRelevance: { score: 0.6 },
    hallucination: { detected: false, severity: null },
    citationCorrectness: { score: 1.0 },
    citationCompleteness: { score: 0.5 },
    abstention: { correct: null },
    claims: [
      { claim: 'Debit card issuance costs Br. 100', status: 'supported', citedIndex: 1, confidence: 0.95 },
      { claim: 'Annual subscription is free', status: 'supported', citedIndex: 1, confidence: 0.9 },
    ],
    reasoning: 'Both claims map directly to context block [1].',
    ...overrides,
  });
}

describe('eval/judge — runJudge', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('parses a valid, well-formed response on the first attempt', async () => {
    const chatMock = jest.fn().mockResolvedValue(validJudgeJson());
    jest.doMock('@/lib/kb', () => ({ generate: chatMock }));
    const { runJudge } = await import('../../src/lib/eval/judge');

    const result = await runJudge(
      { question: 'How much is debit card issuance?', context: '[1] (Source: Fees) Br. 100', answer: 'Br. 100', expectedAnswer: null, noAnswer: false },
      { provider: 'ollama', model: 'qwen3:8b', temperature: 0, maxTokens: 1000, timeoutMs: 30000, retryCount: 2 },
    );

    expect(result.parsedOk).toBe(true);
    expect(result.retryCount).toBe(0);
    expect(result.output?.faithfulness.score).toBe(0.8);
    expect(result.overallScore).not.toBeNull();
    expect(result.overallScore).toBeGreaterThan(0);
    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  test('extracts JSON from a markdown-fenced response', async () => {
    const fenced = '```json\n' + validJudgeJson() + '\n```';
    const chatMock = jest.fn().mockResolvedValue(fenced);
    jest.doMock('@/lib/kb', () => ({ generate: chatMock }));
    const { runJudge } = await import('../../src/lib/eval/judge');

    const result = await runJudge(
      { question: 'Q', context: 'C', answer: 'A', expectedAnswer: null, noAnswer: false },
      { provider: 'ollama', model: 'qwen3:8b', temperature: 0, maxTokens: 1000, timeoutMs: 30000, retryCount: 0 },
    );

    expect(result.parsedOk).toBe(true);
  });

  test('retries once on malformed JSON, then succeeds — never throws', async () => {
    const chatMock = jest.fn()
      .mockResolvedValueOnce('not json at all, the model rambled instead')
      .mockResolvedValueOnce(validJudgeJson());
    jest.doMock('@/lib/kb', () => ({ generate: chatMock }));
    const { runJudge } = await import('../../src/lib/eval/judge');

    const result = await runJudge(
      { question: 'Q', context: 'C', answer: 'A', expectedAnswer: null, noAnswer: false },
      { provider: 'ollama', model: 'qwen3:8b', temperature: 0, maxTokens: 1000, timeoutMs: 30000, retryCount: 2 },
    );

    expect(result.parsedOk).toBe(true);
    expect(result.retryCount).toBe(1);
    expect(chatMock).toHaveBeenCalledTimes(2);
  });

  test('gives up after exhausting retries — returns parsedOk:false, never throws, keeps raw response', async () => {
    const chatMock = jest.fn().mockResolvedValue('still not json');
    jest.doMock('@/lib/kb', () => ({ generate: chatMock }));
    const { runJudge } = await import('../../src/lib/eval/judge');

    const result = await runJudge(
      { question: 'Q', context: 'C', answer: 'A', expectedAnswer: null, noAnswer: false },
      { provider: 'ollama', model: 'qwen3:8b', temperature: 0, maxTokens: 1000, timeoutMs: 30000, retryCount: 1 },
    );

    expect(result.parsedOk).toBe(false);
    expect(result.output).toBeNull();
    expect(result.overallScore).toBeNull();
    expect(result.rawResponse).toBe('still not json');
    expect(chatMock).toHaveBeenCalledTimes(2); // initial attempt + 1 retry
  });

  test('rejects a response that is valid JSON but violates the schema (score out of range)', async () => {
    const badScore = validJudgeJson({ faithfulness: { score: 4.2, supportedClaims: 2, unsupportedClaims: 0 } });
    const chatMock = jest.fn().mockResolvedValue(badScore);
    jest.doMock('@/lib/kb', () => ({ generate: chatMock }));
    const { runJudge } = await import('../../src/lib/eval/judge');

    const result = await runJudge(
      { question: 'Q', context: 'C', answer: 'A', expectedAnswer: null, noAnswer: false },
      { provider: 'ollama', model: 'qwen3:8b', temperature: 0, maxTokens: 1000, timeoutMs: 30000, retryCount: 0 },
    );

    expect(result.parsedOk).toBe(false);
  });

  test('overallScore respects custom configurable weights', async () => {
    const chatMock = jest.fn().mockResolvedValue(validJudgeJson());
    jest.doMock('@/lib/kb', () => ({ generate: chatMock }));
    const { runJudge } = await import('../../src/lib/eval/judge');

    // Weight everything onto correctness alone (0.9 in the fixture) — overall should equal it exactly.
    const result = await runJudge(
      { question: 'Q', context: 'C', answer: 'A', expectedAnswer: null, noAnswer: false },
      { provider: 'ollama', model: 'qwen3:8b', temperature: 0, maxTokens: 1000, timeoutMs: 30000, retryCount: 0, weights: { correctness: 1 } },
    );

    expect(result.overallScore).toBeCloseTo(0.9);
  });

  test('unknown provider throws synchronously rather than silently no-op-ing', async () => {
    jest.doMock('@/lib/kb', () => ({ generate: jest.fn() }));
    const { runJudge } = await import('../../src/lib/eval/judge');

    await expect(runJudge(
      { question: 'Q', context: 'C', answer: 'A', expectedAnswer: null, noAnswer: false },
      { provider: 'openai', model: 'gpt-x', temperature: 0, maxTokens: 1000, timeoutMs: 30000, retryCount: 0 },
    )).rejects.toThrow(/Unknown judge provider/);
  });
});

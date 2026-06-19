import { getClientIp } from '../../src/lib/rateLimit';

const makeReqWithHeaders = (headers: Record<string, string>) => {
  const lowercaseHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    headers: {
      get: (k: string) => lowercaseHeaders[k.toLowerCase()] ?? null,
    },
  } as any;
};

describe('Rate Limiting Client IP Extraction', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('when TRUST_PROXY is false, ignores client X-Forwarded-For and uses X-Direct-Client-Ip', () => {
    process.env.TRUST_PROXY = 'false';
    const req = makeReqWithHeaders({
      'X-Forwarded-For': '203.0.113.195',
      'X-Direct-Client-Ip': '198.51.100.1',
    });
    expect(getClientIp(req)).toBe('198.51.100.1');
  });

  test('when TRUST_PROXY is false and X-Direct-Client-Ip is missing, falls back to X-Forwarded-For (dev mode/next dev compatibility)', () => {
    process.env.TRUST_PROXY = 'false';
    const req = makeReqWithHeaders({
      'X-Forwarded-For': '203.0.113.195',
    });
    expect(getClientIp(req)).toBe('203.0.113.195');
  });

  test('when TRUST_PROXY is true, trusts X-Forwarded-For and ignores X-Direct-Client-Ip', () => {
    process.env.TRUST_PROXY = 'true';
    const req = makeReqWithHeaders({
      'X-Forwarded-For': '203.0.113.195',
      'X-Direct-Client-Ip': '198.51.100.1',
    });
    expect(getClientIp(req)).toBe('203.0.113.195');
  });

  test('normalizes complex/proxied X-Forwarded-For IPs', () => {
    process.env.TRUST_PROXY = 'true';
    const req = makeReqWithHeaders({
      'X-Forwarded-For': '192.0.2.1, 198.51.100.17',
    });
    expect(getClientIp(req)).toBe('192.0.2.1');
  });

  test('uses CF-Connecting-IP when CF header is present and trusted', () => {
    process.env.TRUST_PROXY = 'true';
    const req = makeReqWithHeaders({
      'CF-Connecting-IP': '198.51.100.42',
    });
    expect(getClientIp(req)).toBe('198.51.100.42');
  });
});

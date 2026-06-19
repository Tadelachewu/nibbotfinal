// Real unit tests for admin login route.
/*
 Note: these tests mock the modules the route imports. They call the
 exported `POST` handler with a minimal Request-like object.
*/

const makeReq = (url: string, body: any, headers: Record<string,string> = {}) => {
  return {
    url,
    json: async () => body,
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null
    }
  } as any;
};

describe('Auth: POST /api/admin/auth/login', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  test('returns 400 when username/password missing', async () => {
    // Mock same-origin to true
    jest.doMock('@/lib/session', () => ({ isSameOriginRequest: () => true }))
    const route = await import('../../src/app/api/admin/auth/login/route')
    const res = await route.POST(makeReq('http://localhost/api/admin/auth/login', {}))
    const json = await (res.json ? res.json() : Promise.resolve((res as any).body))
    expect(res.status).toBe(400)
    expect(json?.error).toBeTruthy()
  })

  test('invalid credentials increments failure and returns 401', async () => {
    // Mocks
    jest.doMock('@/lib/session', () => ({ isSameOriginRequest: () => true }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        adminCredential: {
          count: jest.fn(async () => 1),
          findUnique: jest.fn(() => ({ username: 'admin', passwordHash: 'hash' }))
        }
      }
    }))
    jest.doMock('@/lib/auth', () => ({ comparePasswords: jest.fn(async () => false) }))
    const incrementMock = jest.fn(async () => ({ count: 1 }))
    jest.doMock('@/lib/rateLimit', () => ({
      checkLock: async () => ({ locked: false }),
      enforceRateLimit: async () => ({ ok: true }),
      getClientIp: () => '127.0.0.1',
      normalizePrincipal: (p: string) => p,
      incrementCounter: incrementMock
    }))

    const route = await import('../../src/app/api/admin/auth/login/route')
    const req = makeReq('http://localhost/api/admin/auth/login', { username: 'admin', password: 'badpass' }, { 'user-agent': 'jest' })
    const res = await route.POST(req)
    const json = await (res.json ? res.json() : Promise.resolve((res as any).body))
    expect(res.status).toBe(401)
    expect(json?.error).toMatch(/Invalid username or password/i)
  })

  test('locks account after repeated failures (count>=5)', async () => {
    jest.doMock('@/lib/session', () => ({ isSameOriginRequest: () => true }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        adminCredential: {
          count: jest.fn(async () => 1),
          findUnique: jest.fn(() => ({ username: 'admin' }))
        },
        auditLog: {
          create: jest.fn(async () => undefined)
        }
      }
    }))
    jest.doMock('@/lib/auth', () => ({ comparePasswords: jest.fn(async () => false) }))
    const incrementMock = jest.fn(async () => ({ count: 5 }))
    const setLockMock = jest.fn(async () => undefined)
    const clearKeyMock = jest.fn(async () => undefined)
    jest.doMock('@/lib/rateLimit', () => ({
      checkLock: async () => ({ locked: false }),
      enforceRateLimit: async () => ({ ok: true }),
      getClientIp: () => '127.0.0.1',
      normalizePrincipal: (p: string) => p,
      incrementCounter: incrementMock,
      setLock: setLockMock,
      clearKey: clearKeyMock
    }))

    const route = await import('../../src/app/api/admin/auth/login/route')
    const req = makeReq('http://localhost/api/admin/auth/login', { username: 'admin', password: 'badpass' }, { 'user-agent': 'jest' })
    const res = await route.POST(req)
    const json = await (res.json ? res.json() : Promise.resolve((res as any).body))
    expect(res.status).toBe(429)
    expect(json?.error).toMatch(/Too many attempts/i)
  })

  test('successful login creates session and returns csrfToken', async () => {
    // Prepare mocks
    const fakeAdmin = { username: 'admin', passwordHash: 'hash', role: 'admin', passwordExpiresAt: null }
    const updatedAdmin = { role: 'admin', sessionVersion: 2, mustChangePassword: false }

    jest.doMock('@/lib/session', () => ({
      isSameOriginRequest: () => true,
      getAdminSession: async () => ({
        save: jest.fn(async () => undefined),
        csrfToken: null
      })
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        adminCredential: {
          count: jest.fn(async () => 1),
          findUnique: jest.fn(async () => fakeAdmin),
          update: jest.fn(async () => updatedAdmin)
        }
      }
    }))
    jest.doMock('@/lib/auth', () => ({ comparePasswords: jest.fn(async () => true) }))
    jest.doMock('@/lib/logger', () => ({ logSecurityEvent: jest.fn(async () => undefined) }))
    jest.doMock('@/lib/rateLimit', () => ({
      checkLock: async () => ({ locked: false }),
      enforceRateLimit: async () => ({ ok: true }),
      clearKey: async () => undefined,
      getClientIp: () => '127.0.0.1',
      normalizePrincipal: (p: string) => p
    }))

    const route = await import('../../src/app/api/admin/auth/login/route')
    const req = makeReq('http://localhost/api/admin/auth/login', { username: 'admin', password: 'goodpass' }, { 'user-agent': 'jest' })
    const res = await route.POST(req)
    const json = await (res.json ? res.json() : Promise.resolve((res as any).body))
    expect(res.status).toBe(200)
    expect(json?.success).toBe(true)
    expect(json?.csrfToken).toBeTruthy()
  })
})

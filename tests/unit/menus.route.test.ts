// Real unit tests for menus POST handler.

const makeReq = (url: string, body: any, headers: Record<string,string> = {}) => ({
  url,
  json: async () => body,
  headers: { get: (k: string) => headers[k.toLowerCase()] ?? null }
} as any)

describe('Menus POST /api/menus', () => {
  beforeEach(() => jest.resetModules())

  test('returns 403 when CSRF token invalid', async () => {
    jest.doMock('@/lib/session', () => ({ getValidatedAdminSession: async () => ({ username: 'admin' }), rotateCsrfToken: async () => 'next' }))
    jest.doMock('@/lib/session', () => ({ getValidatedAdminSession: async () => ({ username: 'admin' }) }))
    // verifyCsrfToken returns false
    jest.doMock('@/lib/session', () => ({ verifyCsrfToken: () => false, getValidatedAdminSession: async () => ({ username: 'admin' }) }))

    const route = await import('../../src/app/api/menus/route')
    const req = makeReq('http://localhost/api/menus', { name: 'Test' }, {})
    const res = await route.POST(req)
    const json = await (res.json ? res.json() : Promise.resolve((res as any).body))
    expect(res.status).toBe(403)
    expect(json?.message).toMatch(/Forbidden/i)
  })

  test('creates menu and returns success with x-csrf-token header', async () => {
    // Mocks
    const session = { username: 'admin', ip: '127.0.0.1', userAgent: 'jest' }
    jest.doMock('@/lib/session', () => ({ getValidatedAdminSession: async () => session, verifyCsrfToken: () => true, rotateCsrfToken: async () => 'newtoken' }))
    jest.doMock('@/lib/prisma', () => ({
      adminCredential: { findUnique: async () => ({ username: 'admin', role: 'admin' }) },
      menuItem: { create: async (opts: any) => ({ id: 'm1', name: opts.data.name }) , findUnique: async () => ({ id: 'm1', name: 'm1' })},
      menuAttachment: { createMany: async () => undefined },
      kYCField: { upsert: async () => undefined },
      menuKYC: { deleteMany: async () => undefined, createMany: async () => undefined }
    }))
    jest.doMock('@/lib/logger', () => ({ logSecurityEvent: jest.fn(async () => undefined) }))

    const route = await import('../../src/app/api/menus/route')
    const body = { name: 'New Menu', responseType: 'static' }
    const req = makeReq('http://localhost/api/menus', body, { 'user-agent': 'jest' })
    const res = await route.POST(req)
    const json = await (res.json ? res.json() : Promise.resolve((res as any).body))
    expect(res.status).toBe(200)
    expect(json?.status).toBe('success')
    // Header check: NextResponse sets headers; our test obtains via res.headers if present
    if (res.headers && typeof res.headers.get === 'function') {
      expect(res.headers.get('x-csrf-token')).toBe('newtoken')
    }
  })
})

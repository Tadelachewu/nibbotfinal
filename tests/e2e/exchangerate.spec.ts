import { test, expect, request } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

let server: ChildProcess | null = null
const serverScript = path.join(__dirname, '..', '..', 'banking-api', 'exchangerate.js')
const baseURL = 'http://localhost:3003'

test.beforeAll(async () => {
  server = spawn('node', [serverScript], { env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] })

  await new Promise<void>((resolve, reject) => {
    if (!server) return reject(new Error('no server'))
    const onData = (chunk: any) => {
      const s = String(chunk)
      if (s.includes('ETB Exchange API running')) {
        server?.stdout?.off('data', onData)
        resolve()
      }
    }
    server.stdout?.on('data', onData)

    // fallback timeout
    setTimeout(() => resolve(), 3000)
  })
})

test.afterAll(() => {
  if (server && !server.killed) server.kill()
})

test('health and convert endpoints (e2e)', async () => {
  const req = await request.newContext({ baseURL })

  const health = await req.get('/api/health')
  expect(health.status()).toBe(200)
  const healthBody = await health.json()
  expect(healthBody).toHaveProperty('status', 'OK')

  // Use API key from env or fallback from module export
  const apiKey = process.env.TEST_API_KEY || 'my-secret-key-123'

  const conv = await req.post('/api/convert', {
    headers: { 'api-key': apiKey },
    data: { from: 'ETB', to: 'USD', amount: 50 }
  })
  expect(conv.status()).toBe(200)
  const body = await conv.json()
  expect(body).toHaveProperty('data')
  expect(body.data).toMatchObject({ from: 'ETB', to: 'USD', amount: 50 })
})

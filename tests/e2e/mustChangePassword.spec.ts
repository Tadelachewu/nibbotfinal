import { test, expect } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

let server: ChildProcess | null = null
const serverScript = path.join(__dirname, '..', '..', 'server.js')
const port = 3020
const baseURL = `http://localhost:${port}`

test.beforeAll(async () => {
  // Start server with a known initial admin password
  server = spawn('node', [serverScript], {
    env: {
      ...process.env,
      NEXT_PUBLIC_ENABLE_SOCKET_IO: 'false',
      PORT: String(port),
      ADMIN_INITIAL_USERNAME: 'admin',
      ADMIN_INITIAL_PASSWORD: 'Admin@1234'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  await new Promise<void>((resolve) => {
    const onData = (chunk: any) => {
      const s = String(chunk)
      if (s.includes('Real-Time Engine Ready')) {
        server?.stdout?.off('data', onData)
        resolve()
      }
    }
    server?.stdout?.on('data', onData)
    setTimeout(resolve, 4000)
  })
})

test.afterAll(() => {
  if (server && !server.killed) server.kill()
})

test('mustChangePassword flow: login -> change password -> re-login', async ({ page }) => {
  const username = 'admin'
  const oldPassword = 'Admin@1234'
  const newPassword = 'NewAdmin@5678'
  const newUsername = 'admin_updated'
  const newEmail = 'admin_updated@example.com'

  await page.goto(baseURL)

  // Test 1: Login and capture csrfToken from API response (browser fetch so cookie set)
  const loginRes = await page.evaluate(async (base, u, p) => {
    const r = await fetch(base + '/api/admin/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    })
    return { status: r.status, body: await r.json().catch(() => null) }
  }, baseURL, username, oldPassword)

  expect(loginRes.status).toBe(200)
  expect(loginRes.body).toBeTruthy()
  expect(loginRes.body.mustChangePassword).toBe(true)
  const csrfToken = loginRes.body.csrfToken
  expect(typeof csrfToken).toBe('string')

  // Test 2: Check session endpoint reflects mustChangePassword
  const sessionRes = await page.evaluate(async (base) => {
    const r = await fetch(base + '/api/admin/auth/session', { credentials: 'include' })
    return { status: r.status, body: await r.json().catch(() => null) }
  }, baseURL)

  expect(sessionRes.status).toBe(200)
  expect(sessionRes.body?.mustChangePassword).toBe(true)

  // Test 3: Call change-password endpoint with x-csrf-token header
  const changeRes = await page.evaluate(async (base, token, oldP, newU, newP, email) => {
    const r = await fetch(base + '/api/admin/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({ currentPassword: oldP, newUsername: newU, newPassword: newP, email })
    })
    return { status: r.status, body: await r.json().catch(() => null) }
  }, baseURL, csrfToken, oldPassword, newUsername, newPassword, newEmail)

  expect(changeRes.status).toBe(200)
  expect(changeRes.body?.success).toBe(true)

  // Test 4: Re-login with new credentials and verify mustChangePassword cleared
  // Create a fresh page to simulate new session
  const page2 = await page.context().newPage()
  await page2.goto(baseURL)
  const relogin = await page2.evaluate(async (base, u, p) => {
    const r = await fetch(base + '/api/admin/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    })
    return { status: r.status, body: await r.json().catch(() => null) }
  }, baseURL, newUsername, newPassword)

  expect(relogin.status).toBe(200)
  expect(relogin.body?.mustChangePassword).toBe(false)

  await page2.close()
})

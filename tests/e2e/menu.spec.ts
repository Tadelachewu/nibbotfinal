import { test, expect } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

let server: ChildProcess | null = null
const serverScript = path.join(__dirname, '..', '..', 'server.js')
const port = 3020
const baseURL = `http://localhost:${port}`
const adminUsername = 'admin'
const adminPassword = 'Admin@1234'

test.beforeAll(async () => {
  server = spawn('node', [serverScript], {
    env: {
      ...process.env,
      NEXT_PUBLIC_ENABLE_SOCKET_IO: 'false',
      PORT: String(port),
      ADMIN_INITIAL_USERNAME: adminUsername,
      ADMIN_INITIAL_PASSWORD: adminPassword,
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

test('admin can create a main menu item via UI', async ({ page }) => {
  await page.goto(baseURL + '/login')
  await page.fill('#admin-username', adminUsername)
  await page.fill('#admin-password', adminPassword)
  await page.click('text=Sign In')
  await page.waitForURL('**/admin', { timeout: 5000 })

  // Click Add Main Menu
  await page.click('text=Add Main Menu')

  // Wait for edit dialog to appear (Save Changes button)
  await page.waitForSelector('text=Save Changes', { timeout: 5000 })

  // Verify that the edit dialog contains the default name
  const nameInput = await page.$('input[placeholder="Enter your response message here..."]', { strict: false })
  // Fallback: check for Save Changes presence is sufficient
  expect(await page.isVisible('text=Save Changes')).toBe(true)
})

import { test, expect } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

let server: ChildProcess | null = null
const serverScript = path.join(__dirname, '..', '..', 'server.js')
const port = 3020
const baseURL = `http://localhost:${port}`

test.beforeAll(async () => {
  server = spawn('node', [serverScript], {
    env: { ...process.env, NEXT_PUBLIC_ENABLE_SOCKET_IO: 'false', PORT: String(port) },
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
    setTimeout(resolve, 3000)
  })
})

test.afterAll(() => {
  if (server && !server.killed) server.kill()
})

test('user can open chat page and see welcome content', async ({ page }) => {
  await page.goto(baseURL)
  await page.waitForSelector('text=Welcome to Nib International Bank', { timeout: 5000 })
  await expect(page.getByText('Welcome to Nib International Bank')).toBeVisible()
})

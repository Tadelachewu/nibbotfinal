import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'

let server: ChildProcess | null = null
const serverScript = path.join(__dirname, '..', '..', 'server.js')
const port = 3020
const baseURL = `http://localhost:${port}`

const adminUsername = 'admin'
const adminPassword = 'Admin@1234'

async function waitForServerReady(proc: ChildProcess | null) {
    await new Promise<void>((resolve) => {
        const onData = (chunk: any) => {
            const s = String(chunk)
            if (s.includes('Real-Time Engine Ready')) {
                proc?.stdout?.off('data', onData)
                resolve()
            }
        }
        proc?.stdout?.on('data', onData)
        setTimeout(resolve, 6000)
    })
}

async function adminUiLogin(page: Page) {
    await page.goto(baseURL + '/login')
    await page.fill('#admin-username', adminUsername)
    await page.fill('#admin-password', adminPassword)
    await page.click('text=Sign In')
    await page.waitForURL('**/admin', { timeout: 8000 })
}

async function getAdminCsrfToken(page: Page) {
    const res = await page.request.get(baseURL + '/api/admin/auth/session', { headers: { origin: baseURL } })
    const json = await res.json().catch(() => null)
    expect(res.ok()).toBeTruthy()
    expect(json?.csrfToken).toBeTruthy()
    return String(json.csrfToken)
}

async function checkerApiLogin(browser: Browser, creds: { username: string; password: string }) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(baseURL + '/login')
    await page.evaluate(() => undefined)
    const res = await ctx.request.post(baseURL + '/api/admin/auth/login', {
        headers: { 'Content-Type': 'application/json', origin: baseURL },
        data: { username: creds.username, password: creds.password }
    })
    const json = await res.json().catch(() => null)
    if (!res.ok() || !json?.csrfToken) {
        await ctx.close()
        throw new Error(`Checker login failed: ${json?.error || json?.message || res.status()}`)
    }
    return { ctx, csrfToken: String(json.csrfToken) }
}

test.describe.serial('Admin Users + Internal Support flow', () => {
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
        await waitForServerReady(server)
    })

    test.afterAll(() => {
        if (server && !server.killed) server.kill()
    })

    test('admin can create a checker user via UI', async ({ page }) => {
        const username = `checker_${Date.now()}`
        const password = 'Checker@1234'

        await adminUiLogin(page)

        await page.click('text=Users')
        await page.waitForSelector('text=Admin Users', { timeout: 5000 })
        await page.click('text=Create User')

        const dialog = page.getByRole('dialog')
        await expect(dialog.getByText('Create Admin User')).toBeVisible()

        await dialog.locator('xpath=.//label[normalize-space()="Username"]/following::input[1]').fill(username)
        await dialog.locator('xpath=.//label[normalize-space()="Email"]/following::input[1]').fill(`${username}@example.com`)
        await dialog.locator('xpath=.//label[normalize-space()="Group Name"]/following::input[1]').fill('QA Team')

        await dialog.locator('xpath=.//label[normalize-space()="Role"]/following::button[1]').click()
        await page.click('text=Checker')

        await dialog.locator('xpath=.//label[normalize-space()="Password"]/following::input[1]').fill(password)
        await dialog.click('text=Create')

        await page.waitForTimeout(800)
        await expect(page.getByText(username)).toBeVisible()
    })

    test('internal support menu: create -> checker approve -> submit report -> check status', async ({ page, browser }) => {
        test.skip(!process.env.DATABASE_URL, 'DATABASE_URL is required for menu/report E2E tests.')

        const checkerUsername = `checker_flow_${Date.now()}`
        const checkerPassword = 'Checker@1234'

        await adminUiLogin(page)

        await page.click('text=Users')
        await page.click('text=Create User')

        const dialog = page.getByRole('dialog')
        await dialog.locator('xpath=.//label[normalize-space()="Username"]/following::input[1]').fill(checkerUsername)
        await dialog.locator('xpath=.//label[normalize-space()="Email"]/following::input[1]').fill(`${checkerUsername}@example.com`)
        await dialog.locator('xpath=.//label[normalize-space()="Group Name"]/following::input[1]').fill('QA Team')
        await dialog.locator('xpath=.//label[normalize-space()="Role"]/following::button[1]').click()
        await page.click('text=Checker')
        await dialog.locator('xpath=.//label[normalize-space()="Password"]/following::input[1]').fill(checkerPassword)
        await dialog.click('text=Create')

        const csrfToken = await getAdminCsrfToken(page)

        const menuName = `Internal Support E2E ${Date.now()}`
        const menuRes = await page.request.post(baseURL + '/api/menus', {
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
                origin: baseURL
            },
            data: {
                name: menuName,
                responseType: 'report',
                content: '<p>Submitted. Reference: <strong>{{id}}</strong></p>',
                order: 9999,
                isActive: true,
                apiConfig: {
                    rootKey: 'data',
                    defaultPriority: 'medium',
                    responseMapping: { hideReportId: false },
                    kycFields: [
                        { id: `kyc_${Date.now()}`, name: 'fullName', prompt: 'Full Name', type: 'text', required: true, order: 0 }
                    ]
                }
            }
        })

        const menuJson = await menuRes.json().catch(() => null)
        expect(menuRes.ok()).toBeTruthy()
        expect(menuJson?.status).toBe('success')
        const createdMenuId = String(menuJson?.data?.id || '')
        expect(createdMenuId).toBeTruthy()

        const { ctx: checkerCtx, csrfToken: checkerCsrf } = await checkerApiLogin(browser, { username: checkerUsername, password: checkerPassword })
        try {
            const approveRes = await checkerCtx.request.post(`${baseURL}/api/menus/${encodeURIComponent(createdMenuId)}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': checkerCsrf,
                    origin: baseURL
                },
                data: { action: 'approve' }
            })
            const approveJson = await approveRes.json().catch(() => null)
            expect(approveRes.ok()).toBeTruthy()
            expect(approveJson?.status).toBe('success')
        } finally {
            await checkerCtx.close()
        }

        await page.goto(baseURL)
        await page.waitForSelector(`text=${menuName}`, { timeout: 8000 })
        await page.click(`text=${menuName}`)

        await page.waitForSelector('text=Full Name', { timeout: 5000 })
        await page.getByPlaceholder('Enter requested information...').fill('John Doe')
        await page.keyboard.press('Enter')

        const refLocator = page.locator('text=Submitted. Reference:')
        await expect(refLocator).toBeVisible({ timeout: 8000 })

        const bodyText = await page.locator('body').innerText()
        const match = bodyText.match(/Submitted\. Reference:\s*([A-Za-z0-9-]+)/)
        expect(match).toBeTruthy()
        const reportId = String(match?.[1] || '')

        await page.locator('header button').last().click()
        await page.click('text=Check Report Status')
        await page.getByPlaceholder('Enter reference ID...').fill(reportId)
        await page.keyboard.press('Enter')

        await page.waitForSelector(`text=Report ${reportId} found`, { timeout: 8000 })
        await expect(page.getByText('Pending')).toBeVisible()
    })
})


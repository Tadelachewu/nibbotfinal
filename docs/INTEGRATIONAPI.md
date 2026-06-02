Integration API — Adding Admin APIs via the Action Menu
======================================================

Purpose
- Describe how to add and wire up server-side API actions that can be invoked from the Admin "Action" menu (menu-driven admin API integrations).
- Provide exact steps, required server-side checks (auth, CSRF, audit), and a minimal client example.

Overview
- Admin action menu entries trigger server API routes that perform CRUD or integration tasks.
- Admin routes must authenticate via `nib-admin-session` (iron-session), require CSRF for state changes, authorize by `session.role`, and audit via `logSecurityEvent()`.

Files you will touch
- Server-side API route: `src/app/api/<your-area>/<action>/route.ts`
- Menu configuration where action is referenced (menu storage model / admin UI form)
- Session helpers: `src/lib/session.ts` (use `getValidatedAdminSession`, `verifyCsrfToken`, `rotateCsrfToken`)
- Optional: `src/lib/prisma.ts` for DB persistence and `src/lib/logger.ts`/`logSecurityEvent` for auditing

Step-by-step: Add a new Admin API action

1) Define the menu entry (admin side)
- In the admin UI where menus are edited, add an action entry that references an API path (for example `/api/admin/integrations/runSync`). Store any required parameters in the menu configuration (e.g. `targetId`, `payloadTemplate`).
- Ensure the UI treats actions as admin-only and displays them only to authorized roles.

2) Create the API route
- Create a file `src/app/api/admin/integrations/runSync/route.ts`.
- Use App Router route handlers (export `POST`/`GET` as needed). Example minimal POST handler:

```ts
import { NextResponse } from 'next/server'
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logSecurityEvent } from '@/lib/logger'

export async function POST(req: Request) {
  const session = await getValidatedAdminSession(true)
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    logSecurityEvent({ actor: `admin:${session.username}`, action: 'csrf_failure', ip: req.headers.get('x-forwarded-for') })
    return NextResponse.json({ error: 'csrf_failed' }, { status: 403 })
  }

  // Authorization (role check)
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json()
  // Validate body / payloadTemplate expansion

  // Business logic / integration
  const result = await prisma.integrationTask.create({ data: { admin: session.username, params: JSON.stringify(body) } })

  // Audit
  logSecurityEvent({ actor: `admin:${session.username}`, action: 'integration.runSync', target: result.id })

  // Rotate & persist CSRF token and return new token in header
  const newToken = await rotateCsrfToken(session)

  return new NextResponse(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': newToken }
  })
}
```

3) Wire menu entry to call the route
- The admin UI should call the API route when the action is triggered.
- Use `fetch` with `credentials: 'include'` and include the `x-csrf-token` header value obtained from the session-status endpoint.

Client example (admin UI button handler):

```ts
async function runMenuAction(actionPath: string, payload: any, csrfToken: string) {
  const res = await fetch(actionPath, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  })

  if (res.status === 401) throw new Error('Not authenticated')
  if (res.status === 403) {
    // CSRF or authorization failed — attempt refresh of session token then retry once
    // call session-status endpoint to get fresh csrfToken
    throw new Error('Forbidden')
  }

  // Replace client token if server rotated it
  const rotated = res.headers.get('x-csrf-token')
  if (rotated) updateLocalCsrf(rotated)

  return res.json()
}
```

4) Validation, logging, and errors
- Validate all inputs server-side. Never trust menu-stored templates without validation.
- Log (`logSecurityEvent`) both success and failure cases with `actor`, `action`, `target`, `ip`, and `userAgent`.
- Return clear status codes: 401 for auth, 403 for CSRF/authorization, 400 for validation, 500 for server errors.

5) Tests and checks
- Add unit/integration tests that call the route with/without a valid session and token to assert 401/403 outcomes.
- Verify in the browser that after a successful action the `x-csrf-token` header is returned and your admin UI updates its in-memory token.

Checklist before enabling in production
- [ ] `SECRET_COOKIE_PASSWORD` is set and strong; TLS/HSTS enforced in deployment.
- [ ] CORS configured so only trusted origins can send credentials.
- [ ] Endpoint is rate-limited and logged.
- [ ] Input validation is strict and schema-driven.
- [ ] Audit logging enabled for action runs and failures.

Notes and links
- Session and CSRF helpers: `src/lib/session.ts`
- Example menus API: `src/app/api/menus/route.ts` (see how adminPreview and CSRF usage are implemented)
- Prisma client: `src/lib/prisma.ts`

If you want, I can:
- Add a small example `route.ts` file directly under `src/app/api/admin/integrations/runSync/route.ts` (apply patch), and
- Update admin UI call sites (e.g., where menu buttons are implemented) to include a concrete example of calling `runMenuAction()`.


---

Document created by automation: keep this file concise and reference `docs/ALGORITHM.md` for broader session and CSRF context.

Example: Add a "Calendar" API action
-----------------------------------

This concrete example shows how to add a menu action that triggers a calendar sync API under `src/app/api/admin/integrations/calendar/sync`.

1) Menu configuration (example entry)

```json
{
  "type": "api_action",
  "key": "calendar.sync",
  "label": "Sync Calendar",
  "path": "/api/admin/integrations/calendar/sync",
  "method": "POST",
  "confirm": true,
  "params": [
    { "name": "startDate", "type": "string", "required": true },
    { "name": "endDate", "type": "string", "required": true }
  ]
}
```

2) Server route (minimal, create `src/app/api/admin/integrations/calendar/sync/route.ts`)

```ts
import { NextResponse } from 'next/server'
import { getValidatedAdminSession, verifyCsrfToken, rotateCsrfToken } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logSecurityEvent } from '@/lib/logger'

export async function POST(req: Request) {
  const session = await getValidatedAdminSession(true)
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  if (!verifyCsrfToken(req, session, { requireToken: true })) {
    logSecurityEvent({ actor: `admin:${session.username}`, action: 'csrf_failure', ip: req.headers.get('x-forwarded-for') })
    return NextResponse.json({ error: 'csrf_failed' }, { status: 403 })
  }

  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json()
  // Validate startDate/endDate here
  const { startDate, endDate } = body
  if (!startDate || !endDate) return NextResponse.json({ error: 'missing_params' }, { status: 400 })

  // Persist a job record and/or call external calendar API here
  const job = await prisma.calendarSyncTask.create({ data: { admin: session.username, params: { startDate, endDate }, status: 'queued' } })

  logSecurityEvent({ actor: `admin:${session.username}`, action: 'calendar.sync.queued', target: job.id })

  const newToken = await rotateCsrfToken(session)

  return new NextResponse(JSON.stringify({ success: true, jobId: job.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': newToken }
  })
}
```

Notes:
- Prefer queueing long-running work (e.g., using background worker) instead of blocking the request.
- Validate and sanitize any parameters derived from menu templates.

3) Client example (admin UI button)

```ts
async function triggerCalendarSync(startDate: string, endDate: string, csrfToken: string) {
  const res = await fetch('/api/admin/integrations/calendar/sync', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({ startDate, endDate })
  })

  if (res.status === 401) { /* redirect to login */ }
  if (res.status === 403) { /* refresh token and retry once */ }

  const rotated = res.headers.get('x-csrf-token')
  if (rotated) updateLocalCsrf(rotated)

  return res.json()
}
```

4) Prisma model suggestion (add to `prisma/schema.prisma`)

```prisma
model CalendarSyncTask {
  id        Int      @id @default(autoincrement())
  admin     String
  params    Json
  result    Json?
  status    String   @default("queued")
  createdAt DateTime @default(now())
}
```

5) Checklist & best practices
- Require `credentials: 'include'` and `x-csrf-token` on client calls.
- Rate-limit and queue heavy jobs; return a job id rather than blocking.
- Audit (call `logSecurityEvent`) on both success and failure.
- Validate all inputs server-side and escape/encode any values used in downstream calls.
- Return clear HTTP status codes: 401, 403, 400, 500.
- Test idempotency and consider protecting against duplicate runs (use unique job keys or dedupe logic).

If you want I can create the example route file in the repo and wire a simple admin UI button to call it — do you want me to add the route file now?
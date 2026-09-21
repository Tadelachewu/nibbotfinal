**Nibbot App — End-to-End Algorithm (project-specific)**

Purpose
- This document describes how the nibbot application starts, how requests are processed end-to-end, how admin and end-user sessions are handled, where AI and realtime logic run, and which source files implement each responsibility.

Key components (mapping to files)
- App server & real-time engine: `server.js` — custom Next.js server, Socket.IO, Redis presence tracking, CSP and connection limits.
- Admin session logic: `src/lib/session.ts` — `iron-session` configuration, validation, CSRF helpers, session lifecycle.
- Database: `src/lib/prisma.ts` — Prisma client connected to `DATABASE_URL`.
- Admin APIs & app API routes: `src/app/api/**` — e.g. `src/app/api/menus/route.ts`, `src/app/api/admin/auth/session/route.ts`.
- Firebase (end-user client auth + Firestore tools): `src/firebase/*`.
- Frontend UI: `src/components/*` — user chat UI at `src/components/user/ChatInterface.tsx` and admin contexts.
- Rate limiting and security helpers: `src/lib/rateLimit.ts`, `src/lib/security.ts`.

Startup sequence
1. Environment and config load: `server.js` reads `.env` values (ports, REDIS_URL, DB URL, cookie secret, CSP settings).
2. Initialize infrastructure:
   - Prisma client created via `src/lib/prisma.ts` when first imported.
   - Redis (optional) connects in `server.js` for presence/metrics when `REDIS_URL` is provided.
   - Next.js app prepared (`app.prepare()`), then the custom HTTP(S) server starts.
3. Security middleware on the custom server:
   - CSP, security headers, connection and body-size limits, and CORS origin allowlist are applied in `server.js` before delegating to Next's request handler.
4. Socket.IO is attached to the same HTTP server. It enforces origin allowlist and provides presence tracking (writes to Redis zset `online_users`).

Request handling (general pattern)
1. Incoming request lands at the custom server (`server.js`). Basic checks run: connection limiting, body-size, CORS, and CSP headers are applied.
2. The request is forwarded to Next.js via `handle(req, res, parsedUrl)`. From here the request will reach either a page/SSR route or an App Router API route under `src/app/api/`.
3. For App Router API routes the handler implements authentication, authorization, CSRF checks, and business logic. Example: `src/app/api/menus/route.ts`:
   - If admin-only data is requested (`adminPreview` or `includeInactive`) it calls `getValidatedAdminSession()` from `src/lib/session.ts`.
   - Requests that modify state call `verifyCsrfToken()` and `rotateCsrfToken()` to guard against CSRF.
4. Database interactions use the shared Prisma client (`src/lib/prisma.ts`). Audit/logging calls use `src/lib/logger` helpers.

Admin session flow (exact)
1. Admin logs in via API routes under `src/app/api/admin/auth/*` which validate credentials and create an iron session cookie using `sessionOptions` in `src/lib/session.ts`.
2. On authenticated requests, API handlers call `getValidatedAdminSession()` which:
   - Reads the iron-session cookie, checks presence of `username`.
   - Enforces idle timeout and absolute lifetime (configured in `session.ts`).
   - Optionally validates IP and User-Agent binding.
   - Compares `session.sessionVersion` with `adminCredential.sessionVersion` in the DB to support global invalidation.
   - Updates `lastActivityAt` and issues a rotated CSRF token when needed.
3. Protected routes (e.g., POST to `/api/menus`) require a valid admin session and a matching CSRF token checked with `verifyCsrfToken()`.
4. On logout or expiry the session is destroyed and the cookie cleared.

End-user (client) flow
1. Initial page load: client fetches public runtime config via API routes such as `/api/app-settings` and `/api/menus` (see `src/components/user/ChatInterface.tsx` for how the UI requests these).
2. If end-user authentication uses Firebase: the client initializes Firebase via `src/firebase/index.ts` and signs in using the client SDK. Firebase-authenticated actions use short-lived client credentials for protected Firestore or server interactions.
3. When a user interacts with the chat UI, the component calls API routes (e.g., `/api/menus`, `/api/reports`) or server-side flows that may:
   - Use `menus.apiConfig` to call external APIs (validated by `src/lib/security.ts`).
   - Persist reports or analytics via Prisma to the database.

Realtime & presence
1. Clients open a Socket.IO connection to the server engine (`server.js`).
2. On `user_active` the client sends `sessionId` which the server writes to Redis sorted set `online_users` with timestamp (presence tracking).
3. A background loop in `server.js` periodically prunes stale entries and broadcasts `online_count_updated` to connected sockets.

Security & rate-limiting
- Rate limiting helpers in `src/lib/rateLimit.ts` are used by handlers to throttle abusive clients.
- API endpoints set `Cache-Control: no-store` when appropriate and enforce content-type checks for JSON/form/multipart.
- CSP and various security headers are centrally applied in `server.js` before Next takes over.

Error handling & observability
- API handlers return structured JSON `{ status: 'success' | 'error', message?, data? }`.
- Server logs include why sessions were invalidated (see `src/lib/session.ts` warnings) and `server.js` logs connection and Redis status.
- Audit events are emitted from API routes (examples in `src/app/api/menus/route.ts`) using `logSecurityEvent`.

Edge behaviours and practical notes
- Admin session invalidation: changing `adminCredential.sessionVersion` in the DB invalidates existing cookies without additional server state.
- Session updates may fail to save in Server Components contexts — `getValidatedAdminSession()` catches cookie-update errors and continues where appropriate.
- External API calls configured in menu `apiConfig` are validated and normalized before use to avoid SSRF and template injection.

Minimal pseudocode (project mapping)
```
// server.js: startup
loadEnv();
connectRedisIfConfigured();
prepareNextApp();
startHttpServerWithSecurityHeaders();

// API route (example: GET /api/menus)
function GET_api_menus(req):
  if (req.query.adminPreview) session = getValidatedAdminSession()
  if (adminPreviewRequested && !session) return 401
  menus = prisma.menuItem.findMany(...)
  return json({ status: 'success', data: buildMenuResponse(menus, isAdmin) })

// Admin session validation (src/lib/session.ts simplified)
function getValidatedAdminSession():
  session = readIronSessionCookie()
  if (!session.username) return null
  if (isIdleOrExpired(session)) { destroySession(); return null }
  if (sessionBoundToIpOrUaChanged(session)) { destroySession(); return null }
  dbVersion = prisma.adminCredential.findUnique(session.username).sessionVersion
  if (dbVersion !== session.sessionVersion) { destroySession(); return null }
  session.lastActivityAt = now; session.save();
  return session
```

References
- Server & runtime: `server.js`
- Admin session helpers: `src/lib/session.ts`
- DB client: `src/lib/prisma.ts`
- Menus API: `src/app/api/menus/route.ts`
- Admin session API: `src/app/api/admin/auth/session/route.ts`
- AI flows: `src/ai/*` (e.g., `src/ai/flows/admin-content-suggester.ts`)
- Chat UI: `src/components/user/ChatInterface.tsx`

If you want, I can now:
- Add a sequence diagram (Mermaid) showing the user/admin request lifecycle, or
- Insert short inline references in `src/components/user/ChatInterface.tsx` and key API files that link back to this `docs/ALGORITHM.md` for maintainers.

Iron-session (detailed scenarios)
---------------------------------
This project uses `iron-session` for admin authentication. The cookie name is `nib-admin-session` and options are defined in `src/lib/session.ts` (`sessionOptions`). Below are concrete scenarios that show the full client→server lifecycle and server behaviors.

Common configuration notes (from `src/lib/session.ts`):
- Cookie: name `nib-admin-session`, `httpOnly`, `secure` in production, `sameSite` strict in production.
- TTL: idle-based `ttl` controlled by `ADMIN_SESSION_IDLE_MINUTES` (default 15 minutes).
- Absolute lifetime: 8 hours enforced server-side.
- CSRF: session stores `csrfToken` and handlers use `x-csrf-token` header plus `verifyCsrfToken()`.
- Session versioning: `sessionVersion` compared to DB `adminCredential.sessionVersion` for global invalidation.

Scenario A — Admin login (happy path)
1. Admin posts credentials to `POST /api/admin/auth/login` (see `src/app/api/admin/auth/login/route.ts`).
2. Server validates credentials via `prisma.adminCredential` and, on success:
   - Creates an iron-session object with `username`, `role`, `sessionVersion`, `createdAt`, `lastActivityAt`, `ip`, `userAgent`, and `csrfToken`.
   - Calls `session.save()` which serializes and sets the `nib-admin-session` cookie on the response.
3. Client stores cookie automatically (browser enforces `HttpOnly`). UI then calls `/api/admin/auth/session` to verify auth state.

Scenario B — Authenticated API request (read-only)
1. Client (browser) sends request to an API route (e.g., `GET /api/menus`). Cookie `nib-admin-session` is included automatically by browser.
2. API handler calls `getValidatedAdminSession()` which:
   - Reads the iron-session cookie via `getIronSession(await cookies(), sessionOptions)`.
   - Confirms `username` exists, checks idle timeout and absolute lifetime; rejects if expired.
   - Normalizes current IP/User-Agent and compares to session binding; invalidates on mismatch.
   - Compares DB `sessionVersion` to session; invalidates on mismatch.
   - Updates `lastActivityAt` and attempts `session.save()` to refresh cookie TTL.
3. If valid, handler proceeds with DB reads and returns data.

Scenario C — State-changing request with CSRF (POST/PUT)
1. Client fetches initial `csrfToken` from `GET /api/admin/auth/session` and stores it in JS memory.
2. For state changes, client sends `x-csrf-token: <token>` header and makes `POST /api/menus`.
3. Handler calls `getValidatedAdminSession(true)` and then `verifyCsrfToken(req, session, { requireToken: true })`.
4. If verification passes, handler executes changes, rotates CSRF via `rotateCsrfToken(session)` and sets `x-csrf-token` header on response.

Scenario D — Token expiry and session timeout
1. If the admin is idle longer than `ADMIN_SESSION_IDLE_MINUTES`, `getValidatedAdminSession()` will destroy the session and return null; the API responds 401 and client must re-authenticate.
2. After absolute lifetime (8h) the session is invalidated even if active; client must re-login.

Scenario E — Forced logout / session invalidation (sessionVersion)
1. When an admin changes password or an operator revokes access, the server increments `adminCredential.sessionVersion`.
2. On subsequent requests, `getValidatedAdminSession()` detects mismatch between DB `sessionVersion` and cookie value, destroys session, and forces re-authentication. This provides server-side revoke without tracking every session id.

Scenario F — Session save failures in different contexts
- `getValidatedAdminSession()` attempts `session.save()` but may be called from Server Components where cookies cannot be modified. In that case a caught exception is logged and the function continues without failing, so read-only checks still work but cookie TTL won't be refreshed in that context.

Scenario G — Logout
1. Client calls `POST /api/admin/auth/logout` which calls `session.destroy()` and `session.save()` to clear the cookie and server-side state.
2. Client removes any in-memory auth state and redirects to login.

Headers & cookies used
- `Set-Cookie: nib-admin-session=...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=<ttl>` — set by `iron-session` when `session.save()` runs.
- `x-csrf-token` — header used to send/receive CSRF tokens for state-changing requests.
- Standard request headers used for validation: `x-forwarded-for`, `x-real-ip`, and `user-agent` (binding checks).

Pseudocode: login → authenticated request
```
// Login handler
if (validateCredentials(body)) {
  session = await getIronSession(cookies(), sessionOptions)
  session.username = username; session.role = role; session.sessionVersion = dbVersion
  session.ip = detectedIp; session.userAgent = detectedUA
  session.csrfToken = randomToken(); session.createdAt = now; session.lastActivityAt = now
  await session.save() // sets nib-admin-session cookie
  return 200
}

// API handler
session = await getValidatedAdminSession()
if (!session) return 401
if (requiresCsrf) verifyCsrfToken(req, session, { requireToken: true })
// handle request
if (session.isDirty) await session.save()
```

Where to look in code
- Cookie/session options: `src/lib/session.ts`
- Session validation and CSRF helpers: `src/lib/session.ts`
- Login/logout routes: `src/app/api/admin/auth/*` (e.g., `login/route.ts`, `logout/route.ts`)
- Session status check: `src/app/api/admin/auth/session/route.ts`

---

Initial login & API action identification
----------------------------------------
This section explains, step-by-step, how an admin session is created on initial login (exact code mapping), and how any subsequent API action determines which user acted and enforces authorization.

Initial login (exact flow)
1. Client POSTs credentials to `POST /api/admin/auth/login` (`src/app/api/admin/auth/login/route.ts`). The route enforces same-origin and rate limits.
2. The server reads `{ username, password }` from the request body and looks up the admin record with `prisma.adminCredential.findUnique({ where: { username } })`.
3. Password verification is performed with `comparePasswords(password, admin.passwordHash)` (`src/lib/auth`). If valid:
   - The server increments `adminCredential.sessionVersion` via `prisma.adminCredential.update(..., { sessionVersion: { increment: 1 } })` to invalidate older sessions.
   - The server obtains an iron session via `const session = await getAdminSession()` (wrapper around `getIronSession(await cookies(), sessionOptions)` in `src/lib/session.ts`).
   - The server binds identity and context to the session:
     - `session.username = username`
     - `session.role = updatedAdmin.role`
     - `session.sessionVersion = updatedAdmin.sessionVersion`
     - `session.ip = getClientIp(req)` and `session.userAgent = req.headers.get('user-agent')`
     - `session.createdAt = now; session.lastActivityAt = now; session.lastAuthAt = now`
     - `session.csrfToken = randomBase64()`
   - The server calls `await session.save()` which serializes and writes the sealed cookie (`nib-admin-session`) to the response.
   - The route logs the event via `logSecurityEvent({ actor: username, action: 'LOGIN_SUCCESS', ... })` and returns a JSON payload including `csrfToken` and `username`.

How subsequent API actions identify and authorize the actor
1. Browser includes the `nib-admin-session` cookie automatically on same-origin requests. For end-users, the UI includes `sessionId` in bodies and Socket.IO events.
2. API route handler decides whether the request needs an admin session. If so it calls `getValidatedAdminSession()` (`src/lib/session.ts`) which:
   - Reads the iron-session cookie and ensures `session.username` exists.
   - Verifies idle timeout and absolute lifetime; invalidates and destroys the session if expired.
   - Optionally verifies IP and User-Agent binding.
   - Fetches `adminCredential.sessionVersion` from DB and compares to `session.sessionVersion` to detect server-side invalidation.
   - If valid, updates `session.lastActivityAt = now` and calls `session.save()` to refresh cookie TTL where allowed.
3. If `getValidatedAdminSession()` returns a session object, the handler knows the actor identity is `session.username` and can authorize using `session.role` or by fetching the latest admin row via Prisma for more checks.
4. For state-changing requests, the handler additionally calls `verifyCsrfToken(req, session, { requireToken: true })` and may rotate CSRF tokens with `rotateCsrfToken(session)`.

How the server knows end-user actions (non-admin)
- The client creates an opaque `sessionId` stored in `localStorage` and mirrored into a same-origin `nib_session` cookie via `POST /api/session-cookie` (`src/app/api/session-cookie/route.ts`).
- The client includes `sessionId` in POST bodies for clicks, reports, ratings, etc., and emits it in `user_active` socket events.
- Server-side handlers accept `sessionId` from body or cookie and persist actions with that `sessionId` (e.g., `src/app/api/menus/[id]/click/route.ts`, `src/app/api/reports/*`). These are used only for telemetry, dedupe, and presence; they do not grant privileges.

What code paths perform authorization checks
- Admin actions: `getValidatedAdminSession()` + `verifyCsrfToken()` + optional DB checks (role/mustChangePassword) in each protected route.
- End-user actions: handlers validate request parameters and `sessionId` format, but always require admin session or valid Firebase identity for privileged operations.

Audit & logging
- Login success/failures and lockouts are logged via `logSecurityEvent()` in `src/app/api/admin/auth/login/route.ts`.
- Other security-relevant events (menu creation, uploads, API errors) also call `logSecurityEvent()` with `actor` set to `admin:${username}` or `user:${sessionId}` depending on context.

Minimal sequence example
```
Client -> POST /api/admin/auth/login {username,password}
Server: validate -> prisma lookup -> comparePasswords -> prisma.update(sessionVersion)
Server: getAdminSession() -> session.username=..., session.save() -> Set-Cookie: nib-admin-session
Client -> GET /api/menus (cookie sent)
Server: getValidatedAdminSession() -> returns session with username
Server: perform action with actor=session.username; if modifying, verifyCsrfToken(req, session)
```

Notes
- The authoritative identity for admin requests is the sealed iron-session cookie plus DB checks; for end-user interactions the `sessionId` is non-authenticating and used for telemetry/presence only.
- Always check `session.username` and DB state rather than trusting client-supplied fields.

Best practices & CSRF details
--------------------------------

Best practices for this session design
- Use a strong secret for `SECRET_COOKIE_PASSWORD` and rotate it carefully (coordinate cookie invalidation when rotating).
- Serve the site over HTTPS and set `cookieOptions.secure = true` in production so sealed cookies remain confidential in transit.
- Keep `iron-session` cookie small: store only minimal identity, role, version, and timestamps — move large state to the DB.
- Use short idle TTLs (sliding where appropriate) and an absolute max lifetime to limit replay windows (this project uses 15m idle / 8h absolute by default).
- Implement server-side revoke via `sessionVersion` (already present) rather than storing a massive list of session IDs.
- Log security events (login success/failure, lockouts, CSRF verification failures) with `logSecurityEvent` for post‑incident analysis.
- Bind sessions to IP/UA only when your client environments are stable; excessive binding can break legitimate mobile/ISP changes.
- Avoid storing PII inside opaque `sessionId` values used for presence; treat them as analytics tokens only.
- Rate-limit authentication endpoints and add lockouts for repeated failures (already implemented in `login/route.ts`).
- Test session-save behavior in Server Components vs API Routes: cookie writes can fail in some server contexts — handle save errors gracefully (as the code does).

CSRF: what it is and how this app uses tokens
- What CSRF is: Cross-Site Request Forgery occurs when a browser that is authenticated to your site (via cookies) is tricked into making state-changing requests by a malicious page. Because cookies are sent automatically, the attacker could cause actions on behalf of the authenticated user.
- When a CSRF token is needed: any request that relies on browser cookies for authentication and changes server-side state (POST, PUT, PATCH, DELETE) should require a CSRF token. Safe idempotent reads (GET/HEAD) generally do not require CSRF.
- Token strategy used here: synchronizer token pattern. The server stores a random `csrfToken` inside the iron session (`session.csrfToken`) and verifies requests by comparing the `x-csrf-token` header to the session value via `verifyCsrfToken()` in `src/lib/session.ts`.
- Why headers: sending the token in an `X-` header prevents simple HTML forms from transmitting it without explicit client-side code, and it fits well with SPA fetch/XHR patterns.
- When the code allows `requireToken=false`: handlers call `isSameOriginRequest(req)` to allow same-origin requests (useful for certain GETs or health checks) — but state-changing endpoints should explicitly require the token.
- Rotation: after successful state changes the code rotates the CSRF token using `rotateCsrfToken(session)` and sends the new token back in the `x-csrf-token` response header so the client can update its in-memory copy.

Practical guidance
- For frontend callers: read `csrfToken` from `GET /api/admin/auth/session` after login and include it in headers for all modifying calls:

   - Header: `x-csrf-token: <token>`

- For form submissions from server-rendered pages, include a hidden input with the token or use a small script to attach the header on submit.
- For non-cookie auth (bearer tokens, API keys) CSRF protection is not required since credentials are not sent automatically by browsers.
- Log mismatches and return 403 on CSRF failure; rotate tokens after sensitive operations to reduce replay risk.

Security checklist before production
- Ensure `NODE_ENV=production`, `SECRET_COOKIE_PASSWORD` is set, and the server enforces HTTPS / HSTS.
- Verify `SameSite` policy on cookies (Strict/Lax) matches your integration needs; prefer `Strict` for admin areas.
- Audit any endpoints that accept `sessionId` in the body and confirm they do not grant privilege.
- Back up your Prisma DB credentials and enable encryption-at-rest at the infrastructure level if storing sensitive fields.

Algorithmic flow & scenarios (clear step-by-step)
-----------------------------------------------
This section gives a compact, algorithmic view of the most common flows in the app, with concrete steps the server and client take and where the code lives.

1) Admin login (create sealed session cookie)
   - Client: POST /api/admin/auth/login with `{ username, password }`.
   - Server (`src/app/api/admin/auth/login/route.ts`):
      1. Validate origin and rate limits.
      2. Lookup admin with Prisma and verify password.
      3. Increment `adminCredential.sessionVersion` to revoke old sessions.
      4. Get iron-session (`getAdminSession()`), set `username, role, sessionVersion, ip, userAgent, csrfToken, createdAt, lastActivityAt`.
      5. `await session.save()` -> `Set-Cookie: nib-admin-session=sealed(...)` sent to browser.
      6. Return `{ success: true, csrfToken }`.

2) Admin performs a state-changing API call (e.g., create menu)
   - Client: includes cookie automatically + `x-csrf-token` header.
   - Server (`src/app/api/menus/route.ts`):
      1. Call `getValidatedAdminSession(true)` to unseal and validate session.
      2. If no valid session -> return 401.
      3. Call `verifyCsrfToken(req, session, { requireToken: true })` -> if fail return 403.
      4. Authorize by `session.role` (and optional DB checks), perform DB write via Prisma.
      5. `rotateCsrfToken(session)` and set `x-csrf-token` on response, persist session changes via `session.save()`.

3) End-user anonymous interaction (clicks, presence)
   - Client (`src/components/user/ChatInterface.tsx`): generate opaque `sessionId`, store in `localStorage`, mirror to cookie via `POST /api/session-cookie`.
   - For presence: emit Socket.IO `user_active` with `sessionId` -> `server.js` writes `ZADD online_users <now> <sessionId>` to Redis.
   - For interactions: include `sessionId` in API bodies (clicks, reports). Server persists interaction with `sessionId` for dedupe and analytics (handlers under `src/app/api/`).

4) Logout / forced revoke
   - Logout endpoint: `session.destroy(); await session.save();` clears cookie and session state.
   - Forced revoke: increment `adminCredential.sessionVersion` in DB; subsequent `getValidatedAdminSession()` comparisons will invalidate cookie without tracking every session id.

Compact pseudocode (algorithmic)
```
// Login
if POST /api/admin/auth/login:
   if validateCredentials(body):
      db.incrementSessionVersion(username)
      session = getAdminSession(); session.bindIdentity(...); await session.save()
      return 200 + csrfToken

// State-changing API handler
session = getValidatedAdminSession(requireMutations=true)
if !session: return 401
if !verifyCsrfToken(req, session): return 403
performDatabaseChange()
rotateCsrfToken(session); await session.save()
return 200

// End-user presence
client.ensureSessionId()
socket.emit('user_active', { sessionId })
server.zadd('online_users', now, sessionId)
```

Where to inspect the code
- Login: `src/app/api/admin/auth/login/route.ts`
- Session helpers: `src/lib/session.ts`
- Menus API: `src/app/api/menus/route.ts`
- Socket presence: `server.js` (Socket.IO `user_active` handler)
- Session-cookie mirror: `src/app/api/session-cookie/route.ts`

How the system knows a user is logged in (concise)
- The authoritative signal is the sealed `nib-admin-session` cookie created by `iron-session` at login. On every protected request the server calls `getIronSession(await cookies(), sessionOptions)` (wrapped by `getAdminSession()` / `getValidatedAdminSession()` in `src/lib/session.ts`) which unseals (decrypts + verifies) the cookie using `SECRET_COOKIE_PASSWORD`. If the unsealed object contains `username` and passes expiry/version/IP/UA checks, the server treats the request as authenticated.
- In short: login -> server writes sealed cookie; subsequent request -> server unseals cookie -> session object -> authenticated.

When the server needs to act on state-changing operations
- Decision points used by API handlers:
   - Authentication: call `getValidatedAdminSession(requireMutations=true)` to ensure session is present and fresh.
   - CSRF protection: require `verifyCsrfToken(req, session, { requireToken: true })` for any state-changing request that relies on the cookie for auth.
   - Authorization: check `session.role` or fetch the current admin row via Prisma to ensure the role (admin/checker/support) permits the action.
   - Auditing: log the `actor` (either `admin:${username}` or `user:${sessionId}`) with `logSecurityEvent()` when required.

What `proxy.ts` does and why it's needed
- Location & role: `src/proxy.ts` exports a Next.js middleware-like `proxy` function and a `config.matcher`. It runs for matched routes before the request reaches pages or API handlers.
- Responsibilities:
   - Security headers: builds and sets a Content-Security-Policy (CSP), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS when in production.
   - Nonce injection: generates a per-request `nonce` and attaches it to headers (`x-nonce`) and CSP so server-rendered inline scripts/styles can be authorized.
   - CORS handling: computes a safe `Access-Control-Allow-Origin` using the shared `isSameOriginRequest()` logic, handles `OPTIONS` preflight responses, and sets CORS response headers for matched cross-origin requests.
   - Request tagging: injects helpful headers (`x-pathname`) for downstream handlers and ensures API responses set `Cache-Control: no-store`.
   - Router-level protections: blocks legacy password-change paths, and redirects unauthenticated requests away from `/admin` pages if `nib-admin-session` cookie is missing (simple guard to force login pages).
   - Response hygiene: removes identifying server headers and applies Vary/CORS headers as needed.
- Why it's needed: centralizes cross-cutting security, CORS, and routing protections so individual handlers can remain focused on business logic. It prevents header duplication and ensures a consistent security posture across the app.

Admin APIs: what they are and what each requires
-------------------------------------------------
Below are the primary admin-related API endpoints and their typical requirements. This is not exhaustive but covers the main admin routes in this repo.

- `POST /api/admin/auth/login` (`src/app/api/admin/auth/login/route.ts`)
   - Purpose: authenticate admin credentials and create sealed session cookie.
   - Requires: same-origin request; valid username/password; passes rate limits and account lock checks.
   - Produces: sealed `nib-admin-session` cookie and returns `csrfToken` in JSON.

- `GET /api/admin/auth/session` (`src/app/api/admin/auth/session/route.ts`)
   - Purpose: return current admin auth status (isAuthenticated, username, role, csrfToken).
   - Requires: None strictly; reads session cookie if present and returns unauthenticated when absent.

- `POST /api/admin/auth/logout` (`src/app/api/admin/auth/logout/route.ts`)
   - Purpose: clear session (logout).
   - Requires: valid admin session; state-changing request should include `x-csrf-token` (route accepts and verifies token when session present).

- `POST/GET /api/admin/users` (`src/app/api/admin/users/route.ts`) — user management
   - GET: requires a validated admin session with `role==='admin'`; returns paginated list.
   - POST: create user — requires admin session + `x-csrf-token`; validates strong password or generates one; returns temporary password when generated.
   - PATCH: update user — requires admin session + `x-csrf-token`; disallows modifying own account via this path; increments `sessionVersion` if password changed.
   - DELETE: delete user — requires admin session + `x-csrf-token`; prevents deleting last admin or deleting self.

- `GET/POST /api/logs` (`src/app/api/logs/route.ts`)
   - GET: admin-only (role 'admin') to query audit/interaction logs.
   - POST: ingest interaction logs (from the app) — allows same-origin requests (CSRF check with `requireToken=false` uses `isSameOriginRequest()`), used by client to record events.

- `GET/POST /api/menus` (`src/app/api/menus/route.ts`) (not under `/admin` but supports admin preview)
   - GET: public by default; `adminPreview` or `includeInactive` query params require a validated admin session and appropriate role ('admin' or 'checker') to view drafts/inactive items.
   - POST: create menu — requires admin session + CSRF + admin role; persists menu data and related KYC fields.

General rules for admin endpoints
- Authentication: most admin endpoints start by calling `getValidatedAdminSession()`; if it returns null the handler should return 401.
- Authorization: after auth, handlers typically fetch the DB row for the admin (`prisma.adminCredential.findUnique({ where: { username: session.username } })`) and check the `role` and `mustChangePassword` flags.
- CSRF: any state-changing endpoint that relies on cookie auth must call `verifyCsrfToken(req, session, { requireToken: true })` and rotate the token after success via `rotateCsrfToken(session)`.
- Auditing: security-sensitive actions should call `logSecurityEvent()` with actor, action, target, ip, and userAgent.

If you want, I will now insert a short annotated example into the top of `src/app/api/admin/auth/login/route.ts` and `src/app/api/menus/route.ts` linking to this document so future maintainers can quickly find the algorithm—should I add those code comments? 

**Scenarios**
Below are concise, step-by-step scenarios (happy-path and common edge-cases) showing exactly what happens in the app when admins create/edit/delete menus and related flows. Each scenario lists server-side steps, client expectations, and recovery behavior.

- **Scenario A — Admin Creates a Menu (happy path)**
   - Client: Admin fills menu form and clicks Save. Frontend reads `nib-admin-session` cookie (browser auto-sends), reads `csrfToken` from session-status endpoint or stored UI state, and issues `POST /api/menus` with JSON body and header `x-csrf-token: <token>`.
   - Server:
      1. `proxy.ts` runs: adds nonce, CSP, and basic guards.
      2. Handler calls `getValidatedAdminSession()` → unseals cookie and validates session metadata.
      3. `verifyCsrfToken(req, session, { requireToken: true })` validates header token.
      4. Authorization: fetch admin row from Prisma, check `role` includes 'admin' or 'editor'.
      5. Validate payload schema (title, items, kycFields...). On error → 400 with validation details.
      6. Persist menu via Prisma (`prisma.menu.create(...)`).
      7. `logSecurityEvent({ actor: 'admin:'+session.username, action: 'menu.create', target: menuId, ... })`.
      8. `rotateCsrfToken(session)` and `session.save()` to persist rotated token.
      9. Respond 201 with created menu id and location header.
   - Client: on 201, client navigates to menu detail or shows success toast. If 401/403 → redirect to login with preserved return-to.

- **Scenario B — Admin Creates a Menu but CSRF token missing/invalid**
   - Client: forgets to send `x-csrf-token` or token expired.
   - Server: `verifyCsrfToken` fails → 403. Server does NOT perform DB write. Return error describing CSRF failure.
   - Client: show error and prompt refresh to re-acquire CSRF token (e.g., call session-status to get new token), then retry.

- **Scenario C — Admin Creates Menu with Validation Errors**
   - Server validates payload and returns 400 with field-level errors. Client highlights fields for correction.

- **Scenario D — Admin Edits a Menu (concurrent edit resolution)**
   - Client: sends `PATCH /api/menus/:id` with `updatedAt` or `etag` for optimistic concurrency.
   - Server: verify session + CSRF → read existing menu. If `updatedAt` mismatches, return 409 conflict with latest server copy. Client merges/diff or reloads editor.

- **Scenario E — Admin Deletes a Menu**
   - Server: require admin role + CSRF. Check constraints (not last active menu referenced by live pages) and perform soft-delete (set `active=false`) and audit log. Return 204.

- **Scenario F — Admin Preview (view drafts, adminPreview flag)**
   - Client: GET `/api/menus?adminPreview=true` with session cookie. Server: `getValidatedAdminSession()` required; returns drafts if role permits.

- **Scenario G — Session Expired / Idle Timeout During Action**
   - Client: long idle then attempts state-changing request. Server unseals cookie but finds `session.expiresAt` passed or `idleTTL` exceeded → treat as unauthenticated and return 401. Client should capture 401, redirect to login, preserve draft, and reapply after re-login.

- **Scenario H — Permission Denied (role insufficient)**
   - Server: after session validated, role check fails → 403. Client shows insufficient-permissions UI and contact/admin support link.

- **Scenario I — Admin Password Changed (sessionVersion rotation)**
   - When admin updates their password, server increments `sessionVersion` in DB. Subsequent requests calling `getValidatedAdminSession()` will notice mismatch between cookie sessionVersion and DB -> force logout (401), requiring login with new credentials. This prevents replay of old cookies.

- **Scenario J — Client Same-Origin vs Cross-Origin (logs/ingest and session-cookie mirroring)**
   - End-user flows (not admin) such as `session-cookie` or client log ingestion are allowed when `isSameOriginRequest()` returns true. If cross-origin, `proxy.ts` applies CORS rules and server may reject or require explicit origin allow-listing.

Pseudocode: Admin create menu (simplified)

```
// server-side pseudocode
session = getValidatedAdminSession(req)
if (!session) return 401
if (!verifyCsrfToken(req, session)) return 403
admin = prisma.adminCredential.findUnique(session.username)
if (!hasRole(admin, 'admin')) return 403
errors = validateMenu(req.body)
if (errors) return 400
menu = prisma.menu.create({ data: req.body })
logSecurityEvent(...)
rotateCsrfToken(session); session.save()
return 201 { id: menu.id }
```

Client-side checklist for admins creating menus
- Ensure cookie is sent (browser handles this).
- Attach `x-csrf-token` header from session-status or stored UI.
- Handle 401 by redirecting to `/admin/auth/login?returnTo=<current>`.
- Handle 403 CSRF by refreshing session token and retrying once.
- Handle 409 by prompting to refresh or merge changes.

If you'd like, I can now:
- insert short annotated comments linking this doc into `src/app/api/admin/auth/login/route.ts` and `src/app/api/menus/route.ts` (small `apply_patch`), or
- add a compact Mermaid sequence diagram for the Admin Create Menu scenario into this file.
Which would you like next?

CSRF Implementation (project-specific)
------------------------------------

- Storage: the server stores a random token on the admin session as `session.csrfToken` (see `src/lib/session.ts`).
- Client flow: after login the client reads the session status (e.g., `GET /api/admin/auth/session`) and retains the `csrfToken` in JS memory (not in a cookie).
- Request flow: for any state-changing request (POST/PUT/PATCH/DELETE) the client sends the token in the `x-csrf-token` request header while the browser also sends the `nib-admin-session` cookie.
- Server verification: handlers call `verifyCsrfToken(req, session, { requireToken: true })` which enforces same-origin (origin/referer) and compares `req.headers.get('x-csrf-token')` to `session.csrfToken`. If mismatched the request is rejected (403).
- Rotation: on successful mutations the server calls `rotateCsrfToken(session)` to replace the token, persists the session, and returns the new token in the `x-csrf-token` response header so the client updates its in-memory copy.
- Rationale: this is the synchronizer-token pattern — because attackers cannot read the victim origin’s session cookie or session token from another origin (same-origin policy), they cannot craft a valid `x-csrf-token` header and so cannot perform authenticated state-changing actions.
- Practical client checklist:
   - call the session-status endpoint after login to obtain `csrfToken`;
   - include `x-csrf-token: <token>` for state-changing fetch/XHR requests and use `credentials: 'include'` so the session cookie is sent;
   - after a successful mutation read the `x-csrf-token` response header and replace the local token; if you receive 403 for CSRF, fetch session-status to refresh token and retry once.

References: `src/lib/session.ts` (CSRF helpers `verifyCsrfToken` / `rotateCsrfToken`) and admin session routes under `src/app/api/admin/auth/`.





Activity detection — how the app knows a user acted during a session
------------------------------------------------------------------
This section explains the concrete signals the server and application use to detect user actions (both admin and end-user) while a session is active, how those signals are processed, and where the logic lives.

Signals the app listens for
- Admin requests (authenticated): presence is detected when API routes call `getValidatedAdminSession()` which updates `lastActivityAt` on every validated request. See `src/lib/session.ts`.
- End-user sessionId pings: the browser generates an opaque `sessionId` (stored in `localStorage` and optionally mirrored into a cookie via `POST /api/session-cookie`) and includes it in API request bodies and socket events. See `src/components/user/ChatInterface.tsx` and `src/app/api/session-cookie/route.ts`.
- Socket heartbeats: client emits `user_active` with `sessionId` over Socket.IO; `server.js` writes `ZADD online_users <timestamp> <sessionId>` to Redis.
- API actions with sessionId: actions like menu clicks, report submissions, ratings, and logs include a `sessionId` field in the request body. Handlers persist these to DB (e.g., `src/app/api/menus/[id]/click/route.ts`, `src/app/api/reports/*`).
- Implicit signals: requests including cookies (`nib-admin-session`, `nib_session`), headers (`x-forwarded-for`, `user-agent`), and CSRF tokens (`x-csrf-token`).

How signals are processed
- Admin flow:
   - Request arrives; handler calls `getValidatedAdminSession()`.
   - If valid, `getValidatedAdminSession()` updates `lastActivityAt` and saves the session cookie (refreshing TTL) when possible.
   - Handlers record audit events (`logSecurityEvent`) with `session.ip` and `session.username`.

- End-user flow:
   - On first use the UI creates `sessionId` (e.g., `user_ab12cd9`) and stores it in `localStorage`.
   - UI mirrors it into a same-origin, `HttpOnly` cookie (`nib_session`) by calling `POST /api/session-cookie` so that server-side Socket.IO and API calls can access it without exposing it to other origins.
   - For presence, the UI periodically emits `user_active` with `sessionId`. `server.js` updates Redis `online_users` zset.
   - For specific actions (menu click, report submission) the UI includes `sessionId` in the POST body; server handlers persist the action, often deduping per session to count unique session-based interactions (see `src/lib/store.ts` and menu click handlers).

Deduplication and metrics
- Clicks and session-scoped counters are typically deduped by `sessionId` to avoid counting repeated clicks from the same browser session. The `src/lib/store.ts` helper `incrementMenuClick(id, sessionId)` maintains an in-memory or DB-backed history to prevent double-counting inside a short window.
- Presence count uses Redis zset timestamps and a background cleanup loop in `server.js` to remove stale `sessionId`s older than the threshold.

Security model for action signals
- Admin actions: require a valid `nib-admin-session` (iron-session) and, for state changes, a valid `x-csrf-token`. Admin session cookies are encrypted/sealed by `iron-session` using `SECRET_COOKIE_PASSWORD` (see `src/lib/session.ts`).
- End-user sessionId: intentionally opaque and unauthenticated. It is used solely for telemetry, presence, and deduplication. It does not grant access to admin APIs or privileged data. Handlers must never treat `sessionId` as proof of identity — privileged actions require admin sessions or Firebase-authenticated tokens.

Where action detection is implemented (key files)
- `src/components/user/ChatInterface.tsx`: creates `sessionId`, stores it locally, mirrors into cookie, and emits socket `user_active` events.
- `src/app/api/session-cookie/route.ts`: sets `nib_session` cookie for same-origin uses.
- `server.js`: Socket.IO listeners `user_active`, Redis writes to `online_users`, background cleanup and `online_count_updated` broadcast.
- `src/app/api/menus/[id]/click/route.ts` and `src/app/api/reports/*`: handlers accept `sessionId` in body and persist interactions to DB.
- `src/lib/session.ts`: admin session validation and `lastActivityAt` updates.
- `src/lib/store.ts`: helpers for deduping session-scoped metrics like click history.

Example pseudocode: user action handling
```
function handleIncomingAction(req, action):
   adminSession = getValidatedAdminSession() // may be null
   endUserSessionId = extractSessionId(req) // from cookie or body

   if (adminSession) {
      adminSession.lastActivityAt = now; adminSession.save()
      actor = `admin:${adminSession.username}`
   } else if (endUserSessionId) {
      updatePresence(endUserSessionId, now) // zadd in Redis
      actor = `user:${endUserSessionId}`
   } else {
      actor = `anonymous`
   }

   // record action for analytics / dedupe
   recordAction({ actor, actionType: action.type, sessionId: endUserSessionId, ip: req.ip })
   // handle business logic
   return response
```

Operational notes
- Avoid treating `sessionId` as authentication; it is a tracking token only.
- Keep `sessionId` opaque and avoid storing PII inside it.
- Ensure `SECRET_COOKIE_PASSWORD` is strong and `NODE_ENV=production` with HTTPS to protect `nib-admin-session` cookies.




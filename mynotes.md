# Auth, Session, Redis, and Websocket Architecture Notes

## 1. Login flow

### Client-side
- The admin login UI is in `src/components/admin/AdminLoginPage.tsx`.
- It uses `AdminAuthContext` from `src/components/admin/AdminAuthContext.tsx`.
- The `login(...)` function sends a POST request to `/api/admin/auth/login` with:
  - `credentials: 'include'`
  - `Content-Type: application/json`
  - JSON body `{ username, password }`
- On successful login, the client stores:
  - `isAuthenticated = true`
  - `currentUsername`
  - `currentRole`
  - `csrfToken`
- The login call does not keep the password in memory beyond the request.

### Server-side `/api/admin/auth/login`
- Location: `src/app/api/admin/auth/login/route.ts`.
- This route performs:
  1. Same-origin check via `isSameOriginRequest(req)` from `src/lib/session.ts`.
  2. Basic validation: username + password present.
  3. Rate limiting and brute-force protections using Redis-based helpers in `src/lib/rateLimit.ts`.
  4. `ensureInitialAdminExists(req)` ensures the first admin user can be created from environment variables if none exist.
  5. Prisma lookup: `prisma.adminCredential.findUnique({ where: { username } })`.
  6. Password verification via `comparePasswords(password, admin.passwordHash)`.
  7. If valid:
     - Clear failure counters.
     - Increment `sessionVersion` in the DB for this user.
     - Create / update the iron-session cookie.
     - Return `success: true`, username, role, csrfToken, and `mustChangePassword`.
       - `mustChangePassword` is used when the account must reset its password before continuing.
       - It is typically set on initial admin creation, after password reset, or when an admin account is created with a temporary credential.
       - The client should treat this as a forced password-change flow, not a normal authenticated session.
  8. If invalid:
     - increment failure counter
     - lock account after too many failures
     - return `Invalid username or password.` or `Too many attempts.`

### Session creation on login
- `getAdminSession()` from `src/lib/session.ts` returns an iron-session object for `nib-admin-session`.
- The login route sets session fields:
  - `session.username`
  - `session.role`
  - `session.sessionVersion`
  - `session.ip`
  - `session.userAgent`
  - `session.createdAt`, `lastActivityAt`, `lastAuthAt`
  - `session.csrfToken`
- `session.save()` writes the encrypted cookie back in the response.

## 2. Iron Session behavior

### Configuration
- Defined in `src/lib/session.ts`.
- `sessionOptions` includes:
  - `password: process.env.SECRET_COOKIE_PASSWORD`
  - `cookieName: 'nib-admin-session'`
  - `ttl` from `ADMIN_SESSION_IDLE_MINUTES` or default `15` minutes
  - `cookieOptions`:
    - `secure: true` in production
    - `httpOnly: true`
    - `sameSite: 'strict'` in production, `lax` in development
    - `maxAge` matching the idle TTL
    - `path: '/'`

### Session storage
- Sessions are stored client-side in an encrypted cookie via `iron-session`.
- Redis is not used as the session store for admin auth cookies.
- The cookie holds session data safely on the browser side, encrypted and authenticated by `iron-session`.

### Validation and renewal
- `getValidatedAdminSession(allowMutations = true)` is the main guard.
- It validates:
  - `session.username` exists
  - idle timeout expiration (`lastActivityAt` older than configured idle window)
  - absolute lifetime expiration (`createdAt` older than 8 hours)
  - IP binding mismatch using request headers and stored `session.ip`
  - User-Agent mismatch using stored `session.userAgent`
  - `sessionVersion` mismatch against the database
- If any check fails, it destroys the session and returns `null`.
- If valid and `allowMutations` is `true`, it updates:
  - `lastActivityAt` to now
  - `createdAt` if missing
  - `csrfToken` if missing
  - saves the session cookie again

### Concurrent session control
- Each admin credential row has `sessionVersion`.
- On login, the route increments `sessionVersion`.
- `getValidatedAdminSession` compares cookie session version against DB version.
- If they differ, the session is invalidated.
- This means a new login invalidates older sessions for that same admin account.

## 3. CSRF and origin protection

### Same origin logic
- `isSameOriginRequest(req)` inspects:
  - `origin`
  - `referer`
  - `host`
  - `x-forwarded-host`
  - `x-forwarded-proto`
- It builds a whitelist of allowed origins from:
  - request origin
  - `NEXT_PUBLIC_SITE_URL`
  - `APP_ORIGIN`
  - `ALLOWED_ORIGINS`
- This is used to protect against cross-site requests.

### CSRF token logic
- `verifyCsrfToken(req, session, { requireToken })` returns:
  - `false` if a token is required and the request is cross-origin
  - `true` only when `x-csrf-token` matches `session.csrfToken`
- `rotateCsrfToken(session)` replaces the session token and saves it.
- Auth-protected operations like `/api/admin/auth/change-password` require this token.

## 4. Admin session check route
- `src/app/api/admin/auth/session/route.ts` returns the current auth status:
  - If valid session exists, it returns `isAuthenticated: true`, username, role, and csrfToken.
  - If invalid or missing, it returns `isAuthenticated: false`.
- `AdminAuthProvider` uses this route on mount to hydrate the client state.

## 5. Proxy guard and route protection

### `src/proxy.ts`
- The app uses a Next request handler proxy to add security headers and route protection.
- It applies:
  - CSP headers including WebSocket origins
  - `X-Frame-Options: SAMEORIGIN`
  - HSTS in production
  - cache control for API routes
- It also enforces RBAC for `/admin` paths:
  - if the request path starts with `/admin`
  - and the `nib-admin-session` cookie is missing
  - then it redirects to `/login`

## 6. Redis usage

### Rate limiting and lockouts
- Redis is used in `src/lib/rateLimit.ts` for:
  - login attempt counters
  - IP-based rate limits
  - principal-based rate limits
  - temporary locks after too many failures
- This helps prevent brute force and credential stuffing.

### Presence tracking / websocket metrics
- The app also uses Redis in `server.js` for online presence tracking.
- `server.js` connects using `process.env.REDIS_URL`.
- If Redis is available, it uses a sorted set `online_users`.
- Each socket heartbeat adds/updates a timestamp for the user's `sessionId`.
- A background loop every 5 seconds removes entries older than 20 seconds and broadcasts an online count.

## 7. Websocket / socket.io flow

### Client side
- In `src/components/user/ChatInterface.tsx`, the chat UI:
  - creates a `sessionId` stored in localStorage under `nib_user_session`
  - connects to socket.io with path `/socket.io`
  - chooses transports:
    - `['polling']` on secure production hosts
    - `['polling', 'websocket']` otherwise
  - emits `user_active` immediately and every 15 seconds
- This is mainly a real-time presence / heartbeat engine.

### Server side
- `server.js` hosts a custom Next.js server and attaches Socket.io.
- On `connection`, Socket.io listens for `user_active` events.
- When received:
  - the server stores `socket.sessionId`
  - updates `online_users` in Redis using `ZADD` with the current timestamp
- On `disconnect`, it simply clears the socket sessionId and waits for TTL-based cleanup.
- The background loop:
  - removes Redis entries older than 20 seconds
  - counts active IDs with `ZCOUNT`
  - emits `online_count_updated` to all connected clients

### Important note
- This websocket presence system does not authenticate via the admin session cookie.
- It is based on the anonymous or per-user `sessionId` generated in the browser.
- Admin authentication and socket presence are separate features.

## 8. Summary

- Admin login is handled by a secure API route.
- `iron-session` stores session state in an encrypted cookie named `nib-admin-session`.
- Session validation includes idle timeout, absolute lifetime, IP/User-Agent binding, and DB session version checks.
- Redis is used for rate-limiting and presence tracking, not for the admin cookie store.
- Socket.io is used for real-time presence updates and broadcasts online counts.
- `proxy.ts` enforces route guard and security headers for `/admin` paths.

---

## Detailed: Admin sessions (privileged)

- Where handled:
  - Client auth/context: `src/components/admin/AdminAuthContext.tsx`
  - Login API: `src/app/api/admin/auth/login/route.ts`
  - Session status: `src/app/api/admin/auth/session/route.ts`
  - Logout: `src/app/api/admin/auth/logout/route.ts`
  - Session utilities & validation: `src/lib/session.ts`
  - Change-password (invalidates sessions): `src/app/api/admin/auth/change-password/route.ts`

- Storage and transport:
  - Admin session is stored in an encrypted, signed cookie using `iron-session`. Cookie name: `nib-admin-session`.
  - The cookie contains the session object (username, role, sessionVersion, timestamps, csrfToken, ip, userAgent).
  - Cookie options (in `src/lib/session.ts`): `secure` in production, `httpOnly: true`, `sameSite: 'strict'` (prod), `ttl` from `ADMIN_SESSION_IDLE_MINUTES` (default 15m).

- Creation / login flow:
  1. Browser calls `/api/admin/auth/login` with JSON `{username, password}`, `credentials: 'include'`.
  2. Server validates origin, rate-limits (Redis-backed helpers), checks credentials via Prisma + `comparePasswords`.
  3. On success:
     - DB `sessionVersion` is incremented (concurrent-session control).
     - Server obtains an Iron session object (`getAdminSession()`), sets fields:
       - `username`, `role`, `sessionVersion`, `ip`, `userAgent`,
       - `createdAt`, `lastAuthAt`, `lastActivityAt`, `csrfToken`.
     - Calls `session.save()` which writes the encrypted cookie to the client.
     - Response includes `csrfToken`, username, role, and `mustChangePassword` flag.
       - This flag signals the client UI to require a password change before allowing full admin access.
       - It supports flows where the password is temporary, newly created, or has been reset by an administrator.

- Validation and lifecycle (`getValidatedAdminSession` in `src/lib/session.ts`):
  - Idle timeout: if last activity older than `ADMIN_SESSION_IDLE_MINUTES` → destroy session.
  - Absolute lifetime: 8-hour hard limit → destroy session.
  - IP binding: if session was bound to an IP and current IP differs → destroy session (prevents hijack).
  - User-Agent binding: if stored UA differs → destroy session.
  - Session-version check: reads DB’s `sessionVersion` for username; if mismatch → destroy (this invalidates all prior sessions after a password change or admin re-login).
  - If valid and `allowMutations` true, updates `lastActivityAt`, ensures `createdAt` and `csrfToken`, then `session.save()` (rotates cookie).
  - `rotateCsrfToken(session)` is used to refresh CSRF tokens when needed.

- Invalidation & security events:
  - On password change, the DB `sessionVersion` increments; `getValidatedAdminSession` then rejects older cookies.
  - If idle/absolute expiry or IP/UA mismatch occurs, session is `destroy()` and saved to remove cookie.
  - All sensitive admin API endpoints use CSRF checks (`verifyCsrfToken`) using `x-csrf-token` header matched to `session.csrfToken`.

- Notes / implications:
  - Sessions are client-side cookies (encrypted). No centralized session store required for admin auth.
  - Concurrent-session control via DB `sessionVersion` lets the server invalidate other sessions.
  - Because cookies are HttpOnly + Secure (prod), JS cannot read them directly—client stores only `csrfToken` returned by login for use with `csrfFetch`.

## Detailed: ChatInterface user sessions (anonymous)

- Where handled:
  - Chat UI and presence: `src/components/user/ChatInterface.tsx`
  - Real-time server behavior: `server.js` (Socket.io + optional Redis presence)
  - Presence/state store: Redis sorted set `online_users` (if `REDIS_URL` set)

- Storage and transport:
  - No `iron-session` or privileged cookie for chat users.
  - The client creates a lightweight, opaque `sessionId` stored in `localStorage` under `nib_user_session` (format `user_<random>`).
  - That `sessionId` is included in API calls and used for presence/telemetry only; it is not authenticated or privileged.

- Lifecycle and usage:
  1. On first load, `ChatInterface` checks `localStorage['nib_user_session']`. If absent, it generates `user_` + random string and saves it.
  2. The UI logs a `SESSION_START` event to `/api/logs` including `sessionId`.
  3. If socket.io enabled, client connects to the server (`io({ path: '/socket.io', transports })`) and emits `user_active` immediately and every ~15s (heartbeat).
  4. Server `server.js` on `user_active`:
     - stores `socket.sessionId = sessionId`
     - if Redis available, runs `ZADD online_users <now> <sessionId>` to record lastSeen timestamp
     - `broadcastOnlineCount()` reads/cleans Redis (ZREMRANGEBYSCORE older than TTL) and `ZCOUNT` to compute online count, then emits `online_count_updated` to all clients.
  5. On disconnect the socket server simply clears `socket.sessionId` and relies on Redis TTL/cleanup to remove stale IDs.

- Security & scope:
  - `sessionId` is opaque and should not contain PII. It merely identifies a browser session for analytics/presence.
  - Because it is stored in `localStorage`, it persists across browser reloads but not across different devices or Incognito sessions.
  - The `sessionId` does not grant access to admin endpoints or privileged data.

- Fallbacks and environment controls:
  - In development / env gating, `ChatInterface` may skip socket.io if `NEXT_PUBLIC_ENABLE_SOCKET_IO !== 'true'` (dev convenience).
  - Socket.io uses transports fallback (polling) when websocket is unavailable; presence becomes less real-time but still works.
  - If Redis is unavailable, server falls back to local, per-process presence (in `server.js` it disables Redis presence but still accepts sockets). That leads to inconsistent global counts across multiple server instances.

## Differences and why both session types exist

- Persistence:
  - Admin sessions are encrypted cookies (iron-session) with server-side validation and DB-backed session-version control.
  - Chat sessions are client-generated opaque IDs in `localStorage` (not authenticated), used for telemetry and presence only.

- Privilege:
  - Admin sessions represent authenticated identities (username + role) and can access protected APIs.
  - Chat `sessionId` is not an identity and cannot authorize protected actions.

- Cross-instance consistency:
  - Admin sessions rely on cookie + DB sessionVersion for global invalidation—no Redis required.
  - Chat presence requires Redis (or other shared store) to be accurate across multiple Node instances.

## Operational notes & best practices

- Admin:
  - Keep `SECRET_COOKIE_PASSWORD` secret and rotate carefully (rotating cookie password invalidates all sessions).
  - Monitor session expiry rates and session-version mismatches in logs (indicates forced logouts / password changes).
  - Use HTTPS and `secure` cookies in prod.

- ChatInterface:
  - Use opaque `sessionId`s only; avoid storing PII in them.
  - Heartbeat cadence: client emit every 10–30s; server clean window ~20–40s (server uses 20s in current code).
  - For scale, enable `REDIS_URL` and use socket.io Redis adapter if you run multiple server instances.
  - Plan for Redis outages: degrade presence features and alert.

### Key files to inspect
- `src/components/admin/AdminLoginPage.tsx`
- `src/components/admin/AdminAuthContext.tsx`
- `src/app/api/admin/auth/login/route.ts`
- `src/app/api/admin/auth/session/route.ts`
- `src/lib/session.ts`
- `src/proxy.ts`
- `src/components/user/ChatInterface.tsx`
- `server.js`

## Glossary

- `sessionVersion`
  - A numeric counter stored in the admin user record in the database.
  - It is incremented on login and credential changes.
  - Scenario: user logs in on device A, then logs in on device B; A’s old cookie no longer matches the DB version, so device A is invalidated.

- `ZADD`
  - A Redis command that adds or updates a member in a sorted set with a score.
  - In this app, it stores `sessionId` in `online_users` with the current timestamp.
  - Scenario: the client sends a heartbeat; the server updates Redis with the latest time so stale sessions can be purged.

- `CSRF token`
  - A session-specific secret used to protect authenticated requests.
  - The server stores it in the admin Iron session and the client sends it back as `x-csrf-token`.
  - Scenario: a malicious third-party page cannot submit an admin POST without the valid token.

- `User-Agent`
  - The browser/client string sent in HTTP request headers.
  - Stored in the session to detect changes between requests.
  - Scenario: a stolen admin cookie used from a different browser can be rejected because the User-Agent no longer matches.

- `PII` (Personally Identifiable Information)
  - Data that can identify a person, such as name, email, or username.
  - The chat session ID is intentionally opaque to avoid storing PII.
  - Scenario: `user_abc123` is safe; `john.doe@example.com` would be PII and should not be used as a direct session identifier.

- `WebSocket`
  - A bi-directional network connection between browser and server.
  - Used here for real-time presence updates and heartbeats.
  - Scenario: when the chat UI connects, it uses Socket.io to send `user_active` and receive `online_count_updated` events immediately.

- `Redis`
  - An in-memory data store used for shared state and fast counters.
  - In this app, it provides presence tracking and rate-limit state.
  - Scenario: multiple server instances can all consult the same Redis sorted set to compute a consistent online user count.

- `iron-session`
  - A library that stores session data in an encrypted HTTP cookie.
  - It protects admin session fields like username, role, and CSRF token.
  - Scenario: the browser sends the `nib-admin-session` cookie with each request, and the server decrypts it to validate the admin.

- `cookie`
  - A browser storage mechanism used for admin auth state.
  - It is marked `httpOnly` and `secure` in production for safety.
  - Scenario: admin login sets the session cookie; subsequent API calls send it automatically without exposing it to JavaScript.

- `localStorage`
  - Browser storage used for anonymous chat session IDs.
  - It is not secure or authenticated, but it persists across page reloads.
  - Scenario: chat users receive a local `sessionId` once and reuse it until they clear storage.

- `rate limiting`
  - Throttling login attempts and abuse by counting requests in Redis.
  - Protects against brute force and repeated invalid requests.
  - Scenario: too many failed admin logins in 15 minutes trigger a temporary lockout.

- `presence tracking`
  - The mechanism for knowing who is currently online.
  - Implemented with Socket.io heartbeats plus Redis TTL cleanup.
  - Scenario: if a client stops sending `user_active`, Redis removes its `sessionId` after the timeout and the online count decreases.

- `same-origin`
  - A security model where only requests from the same origin are trusted.
  - The app checks `Origin`, `Referer`, `Host`, and configured allowed origins.
  - Scenario: an API POST from a different domain is rejected unless it matches an allowed origin.

- `secure cookie`
  - A cookie that is only sent over HTTPS.
  - Important for admin auth cookies in production.
  - Scenario: without `secure`, the session cookie could be sent over an unencrypted connection and be intercepted.

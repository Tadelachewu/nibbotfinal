# Session Management

This document explains how session state works in the app, including the two distinct session models:

- `Admin` authenticated sessions using `iron-session` and a DB-backed `sessionVersion`
- `Chat / end-user` anonymous sessions using a browser-generated `sessionId` in `localStorage`

## 1. Admin session architecture

### 1.1 What is stored

Admin sessions are stored in an encrypted, signed cookie called `nib-admin-session` using `iron-session`.
The cookie contains the session object, including:

- `username`
- `role`
- `ip`
- `userAgent`
- `sessionVersion`
- `createdAt`
- `lastActivityAt`
- `lastAuthAt`
- `csrfToken`

### 1.2 Cookie protection

`src/lib/session.ts` defines `sessionOptions`:

- `password`: `process.env.SECRET_COOKIE_PASSWORD`
- `cookieName`: `nib-admin-session`
- `ttl`: `ADMIN_SESSION_IDLE_MINUTES` (default 15 minutes)
- `secure`: `true` in production
- `httpOnly`: `true`
- `sameSite`: `strict` in production, `lax` in development
- `maxAge`: same as the idle timeout
- `path`: `/`

### 1.3 Validation and refresh

The core guard is `getValidatedAdminSession(allowMutations = true)` in `src/lib/session.ts`.
It checks:

1. `session.username` exists.
2. idle timeout: `now - lastActivityAt <= idleMs`.
3. absolute lifetime: `now - createdAt <= 8 hours`.
4. IP binding: if stored IP is known and current request IP differs, the session is invalidated.
5. User-Agent binding: if stored `userAgent` is known and different, the session is invalidated.
6. DB `sessionVersion`: reads `adminCredential.sessionVersion` and compares it to `session.sessionVersion`.

If validation passes and `allowMutations` is true, the function updates:

- `createdAt` if missing
- `lastActivityAt` to now
- `csrfToken` if missing
- saves the session cookie again via `session.save()`

This keeps the admin session active while protecting against stale, stolen, or revoked cookies.

### 1.4 Concurrent session invalidation

The `sessionVersion` field is the key mechanism for server-side invalidation:

- On every successful admin login, the login route increments the DB `sessionVersion`.
- On password change, the route also increments `sessionVersion`.
- `getValidatedAdminSession()` rejects a cookie whose `sessionVersion` no longer matches the DB.

That means one password change or fresh login invalidates all prior active cookies for that account.

## 2. Admin auth flow

### 2.1 Login

`POST /api/admin/auth/login` does:

- same-origin check via `isSameOriginRequest(req)`
- rate limit and lockout checks
- find admin row and verify password via `comparePasswords`
- if current password is valid:
  - increment `sessionVersion`
  - create or update the `iron-session` cookie with `getAdminSession()`
  - bind session metadata: `username`, `role`, `sessionVersion`, `ip`, `userAgent`
  - set timestamps: `createdAt`, `lastActivityAt`, `lastAuthAt`
  - generate `csrfToken`
  - save the session cookie
- return JSON including `username`, `role`, `csrfToken`, and `mustChangePassword`

#### Scenario: first login after password reset

If the admin row has `mustChangePassword=true`, the login still succeeds, but the client is expected to redirect to `/admin/change-password` and complete the forced update before using the admin console.

### 2.2 Session status endpoint

`GET /api/admin/auth/session` checks the current cookie via `getValidatedAdminSession()`.

If the cookie is valid it returns:

- `isAuthenticated: true`
- `username`
- `role`
- `mustChangePassword`
- `csrfToken`

If invalid or missing, it returns `isAuthenticated: false`.

This endpoint is used by admin UI hydration to know whether the user remains logged in.

### 2.3 Password change

`POST /api/admin/auth/change-password`:

- validates the existing admin session with `getValidatedAdminSession(true)`
- verifies a CSRF token via `verifyCsrfToken(req, session, { requireToken: true })`
- checks `currentPassword` against the stored hash
- updates the admin credential row with:
  - new `username`
  - new `passwordHash`
  - `sessionVersion: { increment: 1 }`
  - `mustChangePassword: false`
  - `passwordExpiresAt: null`
- destroys the previous session cookie
- creates a fresh session cookie via `getAdminSession()` and `rotateCsrfToken()`

This flow guarantees that the old session cookie cannot be reused after changing credentials.

## 3. Session failure cases

### 3.1 Idle timeout

If the admin is inactive longer than `ADMIN_SESSION_IDLE_MINUTES`, the next request invalidates the cookie, destroys it, and returns an unauthenticated response.

Example: admin logs in, leaves the browser open for 20 minutes, then clicks a protected action. The app will see `lastActivityAt` is stale and force a new login.

### 3.2 Absolute lifetime expiration

Even if activity continues, a session cannot live longer than 8 hours from `createdAt`.

Example: admin logs in at 08:00 and keeps using the app until 17:00. At 16:01, the next request will fail because the absolute lifetime has expired.

### 3.3 IP / user-agent drift

If the session was established with an IP or User-Agent value and the next request arrives from a different IP or UA, the session is invalidated.

Example: admin logs in from one network, then later requests the app from a different network address; the session is rejected to reduce hijacking risk.

### 3.4 Session version mismatch

If `sessionVersion` in the cookie differs from the DB value, the session is invalidated.

Example: admin logs in on laptop A, then logs in again on laptop B. The second login increments the DB version, so laptop A’s cookie becomes invalid automatically.

## 4. End-user / chat session model

The end-user chat flow does not use `iron-session` or authenticated cookies.
Instead, it uses a locally generated browser session ID stored in `localStorage`.

### 4.1 How chat session IDs are created

`src/components/user/ChatInterface.tsx` uses the key `nib_user_session`.
On initial load it:

- checks `localStorage.getItem('nib_user_session')`
- if missing, generates a new ID like `user_xxxxxxx`
- stores that ID in localStorage
- uses the ID for chat state, logs, menu clicks, and presence heartbeats

### 4.2 What the chat session is used for

The anonymous `sessionId` is included in:

- internal log entries (`/api/logs`)
- menu click history and reports
- socket presence updates via `user_active` events
- feedback and rating submissions

It is a persistent browser identifier for the end-user session, not a secure auth token.

### 4.3 Socket.io presence and heartbeats

The chat interface emits `user_active` every 15 seconds with the local `sessionId`.
This is used by the server and Redis presence engine to keep the `online_users` sorted set fresh.

Example: a visitor opens the chat app, receives `user_abc123` in localStorage, and sends heartbeats until the tab closes. The admin dashboard can then display an accurate online count.

### 4.4 Real-time Tracking and Presence

While the `sessionId` is permanent in the browser, the system tracks real-time "Online Now" status via a volatile presence record:

1. **Heartbeat Mechanism**: The Chat Interface emits a `user_active` event every 15 seconds via Socket.io.
2. **Redis Storage**: The server stores the `sessionId` in a Redis sorted set (`online_users`) with the current timestamp as the score.
3. **Expiration Logic**: 
   - The `sessionId` in `localStorage` **never expires** automatically.
   - The **presence record** in Redis expires after **20 seconds** of inactivity.
   - A background loop on the server purges stale records every 5 seconds, ensuring the "Online Now" count reflects only currently active tabs.

## 5. What is not part of session management

- Redis is not the admin session store.
- The admin session is not stored server-side in Redis.
- The chat `sessionId` is not a login credential; it is an anonymous tracking key.

## 6. Practical scenarios

### Scenario A: Normal admin login

1. Admin submits credentials to `/api/admin/auth/login`.
2. Server validates password and increments `sessionVersion`.
3. Server creates `nib-admin-session` cookie and returns a `csrfToken`.
4. Browser sends this cookie automatically on later `/api/admin/*` requests.
5. `getValidatedAdminSession()` refreshes `lastActivityAt` and keeps the session alive.

### Scenario B: Forced password change

1. Admin logs in with a temporary password.
2. The login response contains `mustChangePassword: true`.
3. Client redirects to `/admin/change-password`.
4. Admin posts current password + new password.
5. Server updates credentials, clears `mustChangePassword`, increments `sessionVersion`, destroys the old cookie, and issues a new one.

### Scenario C: Session invalidation after password change

1. Admin logs in on device A.
2. Admin changes password on device B.
3. Device B increments DB `sessionVersion`.
4. Device A’s cookie now has an old `sessionVersion` and is rejected on next request.

### Scenario D: Anonymous chat session

1. User opens the chat interface.
2. The app reads or creates `nib_user_session` in localStorage.
3. The user’s `sessionId` is included in logs, click tracking, and socket heartbeats.
4. If the browser is refreshed, the same `sessionId` remains and the conversation persists.

## 7. Key takeaways

- Admin auth is stateful from the server’s perspective, but stored in a client-side encrypted cookie.
- `sessionVersion` allows server-side revocation without a centralized session store.
- CSRF protection is tied to the admin session via `csrfToken`.
- Chat sessions are anonymous local identifiers, not authenticated user sessions.
- Redis is used for rate limiting and presence, not admin session persistence.

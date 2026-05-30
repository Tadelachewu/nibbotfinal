# Production Deployment Notes

This file explains how to configure and deploy the app in production.

## 1. Production workflow

### Install dependencies
```bash
npm install --legacy-peer-deps
```

### Prepare Prisma
```bash
npx prisma generate
npx prisma migrate deploy
```

### Build the app
```bash
npm run build
```

### Start production server
```bash
npm start
```

The `npm start` script runs `server.js` with:
- `NODE_ENV=production`
- `PORT` defaulting to `3020`

The app uses the custom server from `server.js`, so deploys must support a long-running Node process.

## 2. Required production environment variables

- `NODE_ENV=production`
- `PORT` (optional; default is `3020` in production)
- `DATABASE_URL` (PostgreSQL connection string)
- `SECRET_COOKIE_PASSWORD` (secure secret used by `iron-session`)

## 3. Recommended production environment variables

- `REDIS_URL` (enable presence tracking / online count)
- `APP_ORIGIN` (production app origin for origin/CSP validation)
- `NEXT_PUBLIC_SITE_URL` (site URL used by same-origin and CSP logic)
- `ALLOWED_ORIGINS` (comma-separated extra allowed origins)
- `SSL_KEY_PATH` and `SSL_CERT_PATH` (file paths if the custom server should terminate TLS)
- `ADMIN_INITIAL_USERNAME` and `ADMIN_INITIAL_PASSWORD` (create initial admin account if no admin exists)
- `ADMIN_EMAIL` (default admin email)
- `ADMIN_SESSION_IDLE_MINUTES` (session idle timeout; default `15`)
- `MAX_REQUEST_BODY_BYTES` (max payload size for strong API protection)
- `REDIS_CONNECT_TIMEOUT_MS` (optional Redis connect timeout)

## 4. Why a custom Node server is required

This project is not a standard Next.js static deployment.
It uses:

- `server.js` to host Next.js with custom HTTP/HTTPS handling
- Socket.io for real-time presence and heartbeat updates
- Redis for optional online presence tracking and rate limiting
- custom security headers and request guards

That means production hosts must:

- support Node.js processes
- allow TCP socket connections for WebSocket/Socket.io
- optionally support Redis if presence tracking is desired

## 5. Production session and auth notes

- The app stores admin session data in an encrypted cookie named `nib-admin-session`.
- Iron-session is configured in `src/lib/session.ts`.
- Session cookie options in production:
  - `secure: true`
  - `httpOnly: true`
  - `sameSite: 'strict'`
  - `ttl` equals `ADMIN_SESSION_IDLE_MINUTES` (default `15` minutes)
- Session validation includes:
  - idle timeout
  - absolute lifetime limit of 8 hours
  - optional IP and User-Agent binding
  - session version check against the database

## 6. Redis usage in production

Redis is not required for core auth or database storage, but it is used for:

- rate limiting and login lockout enforcement in `src/lib/rateLimit.ts`
- online presence tracking in `server.js` via a Redis sorted set `online_users`

If `REDIS_URL` is not set or Redis is unavailable:

- the app can still start
- presence tracking is disabled
- rate limiting may still work if Redis is available, otherwise some features degrade safely

## 7. Security and origin configuration

`server.js` and `src/lib/session.ts` include origin and CSP protections.
Production deployment should set:

- `APP_ORIGIN` to the app origin
- `NEXT_PUBLIC_SITE_URL` so origin checks and CSP allow the real domain
- `ALLOWED_ORIGINS` for any extra trusted domains

If these values are missing or incorrect, requests may be rejected by same-origin checks.

## 8. Deployment checklist

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` set to a production PostgreSQL database
- [ ] `SECRET_COOKIE_PASSWORD` set and kept secret
- [ ] `npm run build` succeeds
- [ ] `npm start` runs `server.js`
- [ ] `APP_ORIGIN` and/or `NEXT_PUBLIC_SITE_URL` set if hosting behind a custom domain
- [ ] `SSL_KEY_PATH` and `SSL_CERT_PATH` set if the server should terminate HTTPS directly
- [ ] `REDIS_URL` set if you want online presence and rate-limit backing
- [ ] `npx prisma migrate deploy` applied before starting

## 9. Deployment warnings

- Do not deploy only the Next.js build output without `server.js`.
- Do not use `npm run dev` in production; use `npm start`.
- Do not use serverless-only targets that cannot run persistent Node and Socket.io.
- Do not run `npx prisma migrate dev` in production; use `npx prisma migrate deploy`.

## 10. Production environment variables: what to set and why

### Required variables
- `NODE_ENV=production`
  - Ensures production-safe behavior in `server.js`, `proxy.ts`, and `src/lib/session.ts`.
  - If unset, the app may run in development mode, use weaker cookie settings, and expose insecure defaults.
- `DATABASE_URL`
  - Required by Prisma for DB access, admin auth, session version checks, and migrations.
  - If not set, the app cannot connect to PostgreSQL, login fails, and migrations cannot run.
- `SECRET_COOKIE_PASSWORD`
  - Required by `iron-session` for encrypting and signing `nib-admin-session` cookies.
  - If missing, admin session cookies cannot be created or validated, breaking login flows.

### Recommended variables
- `REDIS_URL`
  - Enables shared Redis backing for rate limiting, login lockouts, and online presence tracking.
  - If not set, the app still starts, but Redis-backed presence is disabled and some rate-limit features may degrade.
- `APP_ORIGIN`
  - Used in origin/CSP validation and same-origin checks.
  - If incorrect or missing, admin API calls and CSRF-protected requests can be rejected.
- `NEXT_PUBLIC_SITE_URL`
  - Added to origin validation in `src/lib/session.ts` and used for site URL resolution.
  - If not set, the app may not recognize the expected site origin, especially behind proxies or custom domains.
- `ALLOWED_ORIGINS`
  - Comma-separated extra trusted origins for same-origin validation.
  - If not set, only the base site origin is trusted, which can break valid requests from approved domains.
- `SSL_KEY_PATH` and `SSL_CERT_PATH`
  - Required only when `server.js` should terminate HTTPS directly.
  - If absent, the server listens over plain HTTP and requires an external TLS terminator.
- `ADMIN_INITIAL_USERNAME`, `ADMIN_INITIAL_PASSWORD`, `ADMIN_EMAIL`
  - Used to bootstrap an initial admin account when the DB has no admin records.
  - If the DB is empty and these are not set, no initial admin account is created and login will fail until one is seeded.
- `ADMIN_SESSION_IDLE_MINUTES`
  - Controls idle timeout for admin sessions in `src/lib/session.ts`.
  - If not set, defaults to 15 minutes; if set too low it may log users out too quickly.
- `MAX_REQUEST_BODY_BYTES`
  - Limits request payload size in `server.js`.
  - If not set, the built-in default is used; large or unexpected payloads may consume more memory.
- `REDIS_CONNECT_TIMEOUT_MS`
  - Controls Redis connection timeout in `server.js` and rate-limit helpers.
  - If not set, a default timeout is used; on slow Redis endpoints, explicit values prevent hanging requests.
- `NEXT_PUBLIC_ENABLE_SOCKET_IO`
  - When `true`, the client will attempt Socket.io connections for presence updates.
  - If missing or false, real-time online-count features are disabled.

### Real scenario examples
- Missing `DATABASE_URL`: deployment starts, but admin login and API routes fail as Prisma cannot connect.
- Missing `SECRET_COOKIE_PASSWORD`: login may succeed, but session cookies cannot be decrypted on later requests, causing repeated auth failures.
- Missing `APP_ORIGIN` / `NEXT_PUBLIC_SITE_URL`: origin checks can fail behind proxies or custom domains, causing valid admin requests to be rejected.
- Missing `REDIS_URL`: app core auth still works, but presence tracking is disabled and rate-limiting behavior may be weaker.
- Missing admin bootstrap vars on an empty DB: no initial admin account is created, so the app has no way to log into the admin UI until the DB is seeded.

## 10. Useful files

- `server.js` — custom production server and Socket.io setup
- `src/lib/session.ts` — Iron-session config and session validation
- `src/app/api/admin/auth/login/route.ts` — login endpoint and session creation
- `src/app/api/admin/auth/session/route.ts` — auth session status check
- `src/lib/rateLimit.ts` — Redis-based rate limiting and lockout logic
- `docs/DEPLOYMENT.md` — deployment guide and risk notes

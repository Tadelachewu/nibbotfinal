# Security Hardening Summary

This document describes the security hardening changes made to the main Nibbot application.

> Note: `banking-api/*` and `src/app/api/test/*` are development/test mock endpoints and were intentionally excluded from this production security hardening review.

## Issues addressed

### 1. Open CORS origin reflection
- Files updated: `middleware.ts`, `server.js`
- Issue: `Access-Control-Allow-Origin` was being echoed back from the incoming `Origin` header for any request.
- Risk: credentialed requests could be accepted from arbitrary third-party pages.
- Fix: only allow CORS when the incoming origin is included in a trusted allowlist.
- Required config: `ALLOWED_ORIGINS` environment variable should list trusted origins, comma-separated.
- Development fallback: local origins are allowed only in non-production mode.

### 2. Unrestricted Socket.io origin access
- File updated: `server.js`
- Issue: Socket.io allowed all origins via a permissive callback.
- Risk: any website could connect to the app's socket endpoint.
- Fix: Socket.io now validates the origin against the same trusted allowlist and rejects unknown origins.

### 3. Overly broad CSP connect-src
- Files updated: `middleware.ts`, `server.js`
- Issue: `connect-src` was previously set to `*` in the custom server middleware.
- Risk: this undermines CSP protection by allowing arbitrary outgoing connections and reduces the effectiveness of XSS defense.
- Fix: CSP now restricts connect sources to trusted domains only, including `'self'`, `https://www.google.com`, and development-only local origins.

### 4. Insecure local bootstrap admin credentials
- File updated: `src/app/api/admin/auth/login/route.ts`
- Issue: when no admin existed, the app was seeding a default `Admin@1234` password for localhost.
- Risk: default credentials are insecure and can lead to accidental exposure.
- Fix: initial admin creation now requires explicit environment credentials (`ADMIN_INITIAL_PASSWORD` or `ADMIN_PASSWORD`). No insecure localhost fallback is used.

### 5. Unverified email change risk
- Files updated: `src/app/api/admin/auth/change-password/route.ts`, `src/app/api/admin/auth/confirm-email/route.ts`, `src/lib/email.ts`, `prisma/schema.prisma`
- Issue: admin self-service email updates were applied immediately without verifying ownership of the new address.
- Risk: an attacker with access to an active session could redirect account recovery and notifications to an email they control.
- Fix: email changes are now staged and only applied after the new address confirms ownership via a secure token link. The old email receives a notification of the requested change.
- Additional protection: duplicate email updates are rejected immediately if another account already owns the requested address.

### 6. Strict role-based admin access control
- Files updated: `src/app/admin/page.tsx`, `src/components/admin/AdminPageClient.tsx`
- Issue: unauthorized or low-privilege sessions could discover the admin interface through forced browsing.
- Risk: sensitive administrative pages and controls were exposed to users who should not be allowed to access them.
- Fix: the `/admin` page now performs a server-side role validation before rendering. Invalid admin sessions are rejected with a 404 response, and the client only renders admin UI for `admin`, `checker`, or `support` roles.

### 7. Consistency and hardening principles
- The app now relies on explicit origin allowlisting rather than broad request reflection.
- CSP is aligned with the production model and no longer contains open source allowances.
- Session cookies remain `secure` in production and `sameSite='none'` only when the trusted CORS policy is enforced.

### 6. Secure random generation
- Files updated: `src/lib/store.ts`, `src/components/user/ChatInterface.tsx`, `src/components/admin/MenuManagement.tsx`, `src/components/ui/sidebar.tsx`
- Issue: `Math.random()` was used for locally-generated IDs and UI placeholder values.
- Risk: non-cryptographic RNG is not acceptable for any identifiers or security-related values.
- Fix: replaced with `crypto.randomUUID()` and `crypto.getRandomValues()`.
- Note: no credential, temporary password, or reset token generation was found using `Math.random()` in the current app codebase.

### 7. Permissions-Policy enforcement
- Files updated: `middleware.ts`, `next.config.ts`, `server.js`
- Issue: application responses lacked a strict `Permissions-Policy` header.
- Risk: browsers could expose unused capabilities such as camera, microphone, geolocation, payment, or USB when the app does not need them.
- Fix: added `Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=(), fullscreen=(self)` application-wide.
- This header is now applied in edge middleware, Next.js route headers, and the custom server configuration.

## Deployment checklist
- Set `SECRET_COOKIE_PASSWORD` to a strong secret.
- Set `ALLOWED_ORIGINS` to the allowed production origin(s), for example:
  - `https://app.example.com`
  - `https://admin.example.com`
- Set `ADMIN_INITIAL_USERNAME` and `ADMIN_INITIAL_PASSWORD` before first admin creation.
- Keep the app running behind HTTPS in production so HSTS and secure cookies are effective.

## References
- `middleware.ts` — edge middleware for CSP and CORS headers
- `server.js` — custom server with Socket.io origin filtering and secure CSP generation
- `src/app/api/admin/auth/login/route.ts` — initial admin bootstrap hardening

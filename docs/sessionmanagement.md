# Session Management in NibBot

This document provides a comprehensive overview of how session management is implemented in the NibBot application, including security controls, technical details, and real-world scenarios.

## Overview

The application uses **iron-session** to manage stateful data using encrypted, stateless cookies. The session data is stored entirely on the client side in an encrypted cookie named `nib-admin-session`. 

This approach minimizes database lookups for every request while still providing robust security mechanisms to protect administrator accounts.

## Security Controls & Protections

### 1. Timeouts
*   **Idle Timeout**: Defaults to 15 minutes (configurable via `ADMIN_SESSION_IDLE_MINUTES` environment variable). If a user is inactive for this duration, their session is automatically invalidated on their next request.
*   **Absolute Lifetime**: Hardcoded to 8 hours. Regardless of activity, a session will forcefully expire 8 hours after it was created.

### 2. Contextual Binding (Anti-Hijacking)
Sessions are cryptographically bound to the user's connection context:
*   **IP Address Binding**: The session remembers the IP address from which it was created. If a subsequent request comes from a different IP, the session is immediately destroyed.
*   **User-Agent Binding**: The session is bound to the browser's User-Agent string. A change in the User-Agent invalidates the session.

### 3. Concurrent Session Control
The application prevents multiple concurrent active sessions for the same user:
*   A `sessionVersion` integer is stored both in the session cookie and in the database (`AdminCredential` table).
*   During login or password change, the database `sessionVersion` is incremented.
*   On subsequent requests, the cookie's `sessionVersion` is checked against the database. If they don't match, the session is destroyed. This ensures that logging in on a new device automatically logs the user out of any other devices.

### 4. CSRF (Cross-Site Request Forgery) Protection
*   Every session is assigned a unique `csrfToken`.
*   State-changing requests must include this token in the `x-csrf-token` header.
*   The application also enforces strict Same-Origin policies by verifying the `Origin` and `Referer` headers against a whitelist of allowed origins (`isSameOriginRequest`).

### 5. Cookie Security
The `nib-admin-session` cookie is configured with:
*   `HttpOnly`: Prevents client-side JavaScript from accessing the cookie (mitigating XSS).
*   `Secure`: Ensures the cookie is only sent over HTTPS (enforced in production).
*   `SameSite`: Set to `strict` in production to prevent the cookie from being sent in cross-site requests.

---

## Common Scenarios

### Scenario 1: Standard Login
1. User submits valid credentials.
2. The system checks rate limits and account locks.
3. The `sessionVersion` for the user in the database is incremented by 1.
4. A new session is created containing the username, role, current IP, User-Agent, the new `sessionVersion`, and a generated `csrfToken`.
5. The session is encrypted and sent to the client as the `nib-admin-session` cookie.

### Scenario 2: User is Idle
1. User logs in and performs some actions.
2. User steps away from their desk for 20 minutes (exceeding the 15-minute idle limit).
3. User returns and attempts an action (e.g., clicking a button).
4. The server decrypts the cookie, checks `lastActivityAt`, and sees that `Date.now() - lastActivityAt` exceeds 15 minutes.
5. The server destroys the session, logs a warning, and returns an unauthorized response, forcing the user back to the login page.

### Scenario 3: Network Switch (IP Change)
1. User logs in using their office Wi-Fi.
2. User switches to their mobile data hotspot. Their public IP address changes.
3. User attempts to load a page.
4. The server compares the current IP to the `sessionIp` stored in the cookie.
5. They do not match. The server assumes a potential session hijacking attempt, destroys the cookie, and forces the user to log in again.

### Scenario 4: Concurrent Login (Session Revocation)
1. User logs in on their Laptop (Device A). Cookie gets `sessionVersion = 1`.
2. User later logs in on their Phone (Device B). The database `sessionVersion` is incremented to `2`. Device B's cookie gets `sessionVersion = 2`.
3. User goes back to Device A and tries to perform an action.
4. Device A sends its cookie (`sessionVersion = 1`).
5. The server checks the database and sees the current version is `2`.
6. The mismatch causes Device A's session to be destroyed. Only Device B remains logged in.

### Scenario 5: End of Workday (Absolute Timeout)
1. User logs in at 9:00 AM.
2. User works continuously all day, never hitting the 15-minute idle timeout because they interact with the app constantly.
3. At 5:00 PM (8 hours later), the user tries to save a report.
4. The server checks the `createdAt` timestamp in the cookie.
5. Because 8 hours have passed, the absolute lifetime is exceeded. The session is destroyed and the user is prompted to log in again.

### Scenario 6: CSRF Attack Attempt
1. A malicious website tries to trick the logged-in administrator's browser into making a POST request to the NibBot API.
2. The browser automatically includes the `nib-admin-session` cookie.
3. The server checks the request. It notices the `Origin` header doesn't match the application's domain, OR it notices the `x-csrf-token` header is missing/incorrect.
4. The server rejects the request with a 403 Forbidden error, protecting the application.

---

## Security Evaluation: Is It Secure?

**Yes, this session management implementation is highly secure.** It employs a robust "defense-in-depth" strategy that mitigates the most common web application vulnerabilities:

1.  **Session Hijacking / Cookie Theft:** Mitigated by Contextual Binding. Even if an attacker steals the `nib-admin-session` cookie, they cannot use it from a different IP address or browser (User-Agent). 
2.  **Cross-Site Scripting (XSS):** Mitigated by `HttpOnly` cookies. Malicious JavaScript injected into the page cannot read the session cookie.
3.  **Cross-Site Request Forgery (CSRF):** Prevented by the strict Same-Origin checks and the requirement for a valid, session-bound `x-csrf-token` header on all mutations.
4.  **Man-in-the-Middle (MitM) Attacks:** Mitigated by the `Secure` flag (forcing HTTPS) and encrypted cookie payload (iron-session).
5.  **Abandoned Sessions:** Mitigated by the aggressive 15-minute idle timeout and the hard 8-hour absolute lifetime.
6.  **Concurrent / Stale Access:** Mitigated by the `sessionVersion` control. Changing passwords or logging in on a new device immediately revokes all prior sessions.

By combining encrypted client-side storage with strict server-side contextual validations, this architecture achieves excellent performance without sacrificing security.

---

## Comparison: Iron-Session vs. JWT & Others

Why use **iron-session** instead of popular alternatives like JWTs or Redis-backed sessions?

| Feature / Strategy | Iron-Session (Current) | JWT (Local Storage) | Server-Side Sessions (e.g., Redis) |
| :--- | :--- | :--- | :--- |
| **Data Visibility** | **Opaque/Encrypted:** The client cannot read or modify the session data. | **Transparent:** Base64 encoded; anyone with the token can read the payload. | **Opaque:** Only a session ID is stored on the client. |
| **XSS Vulnerability** | **Low:** Secured by `HttpOnly` cookies; inaccessible to JavaScript. | **High:** LocalStorage is easily accessed by malicious scripts. | **Low:** Uses `HttpOnly` cookies. |
| **Revocation** | **Immediate:** `sessionVersion` DB check ensures instant revocation upon password change or new login. | **Difficult:** Requires complex token blacklists or extremely short TTLs + Refresh Tokens. | **Immediate:** Trivial to delete the session record from the server. |
| **Infrastructure** | **Zero infra:** Relies entirely on the application server and the client. | **Zero infra:** Relies entirely on the application server and the client. | **Requires DB/Cache:** Needs a separate Redis instance or database table for every request. |
| **Statelessness** | **Hybrid:** Session data is stateless, but we do a lightweight DB lookup for `sessionVersion` to allow revocation. | **Stateless:** Often designed to avoid DB lookups entirely (which causes the revocation issue). | **Stateful:** Requires a server-side store lookup for every request. |

### Summary of Alternatives
*   **JWTs (JSON Web Tokens):** While popular for APIs and microservices, JWTs are often poorly implemented in web apps (stored in LocalStorage) leading to XSS vulnerabilities. Even when stored in `HttpOnly` cookies, standard stateless JWTs are incredibly difficult to invalidate before they expire. Our approach solves the invalidation problem without the overhead of token blacklists.
*   **Server-Side Sessions (Redis/Memcached):** This is the traditional "gold standard" for security. However, it requires maintaining additional infrastructure (a Redis cluster) and introduces a network hop for every single request just to verify the session. 
*   **NextAuth.js / Auth.js:** A popular library that uses similar underlying mechanisms. We opted for `iron-session` because it provides lighter-weight, lower-level control, making it easier to implement custom security bindings (like our strict IP and User-Agent enforcement).

**Conclusion:** Our implementation hits the "sweet spot". It offers the infrastructure simplicity of stateless tokens while maintaining the strict revocation and security benefits of stateful server-side sessions.

---

## Validation Algorithm: How the Server Checks a Session

Every time a protected request hits the server, the core guard function `getValidatedAdminSession()` executes the following algorithmic flow:

1.  **Extraction:** Read the `nib-admin-session` cookie from the request and decrypt it using `iron-session`.
2.  **Existence Check:** If the cookie is missing, invalid, or lacks a `username`, reject immediately (return `null`).
3.  **Idle Timeout Check:** Calculate the time since `lastActivityAt`. If it exceeds 15 minutes, destroy the session and reject.
4.  **Absolute Lifetime Check:** Calculate the time since `createdAt`. If it exceeds 8 hours, destroy the session and reject.
5.  **Context Binding (IP Check):** Extract the client's current IP address (handling proxy headers like `x-forwarded-for`). If it differs from the `sessionIp` stored in the cookie, destroy the session and reject (hijack protection).
6.  **Context Binding (User-Agent Check):** Compare the current `User-Agent` header with the one stored in the cookie. If it differs, destroy the session and reject.
7.  **Concurrent Session Check (DB Lookup):** Query the database (`AdminCredential` table) for the user's current `sessionVersion`. If the cookie's `sessionVersion` does not match the database version, destroy the session and reject (handles revocation from other devices).
8.  **Mutation & Refresh:** If all checks pass, update the `lastActivityAt` timestamp in the cookie to the current time, and save (re-encrypt and issue a new `Set-Cookie` header) to reset the idle timer.

## Where is the Session Used? (Request Scope)

The session validation is aggressively applied across the application to protect administrative endpoints:

*   **API Routes (Deep Validation):** Almost every administrative API route inside `src/app/api/` invokes `getValidatedAdminSession()` to deeply authenticate the user before returning or mutating data. This includes:
    *   `/api/menus/*` (Menu management)
    *   `/api/reports/*` (Reporting data)
    *   `/api/admin/users/*` (Admin user management)
    *   `/api/app-settings/*` (Application settings)
    *   `/api/logs/*` (Audit logs)
    *   `/api/upload/*` (File uploads)
    *   `/api/admin/auth/change-password` & `/logout` (Authentication lifecycle)
*   **Server Components (UI Rendering):** Protected pages like `src/app/admin/page.tsx` check the session before rendering the administrative dashboard, ensuring unauthorized users never see sensitive UI layouts.
*   **Edge Proxy/Middleware (Shallow Check):** The custom `proxy.ts` file intercepts all requests to `/admin/*`. It performs a fast, lightweight check to verify the *existence* of the `nib-admin-session` cookie. If it's completely missing, the middleware instantly redirects the user to `/login`, providing a fast path for unauthenticated forced-browsing attempts.

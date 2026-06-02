## Security Mitigations — nibbot

Purpose
- A concise, actionable checklist mapping each identified weak area to: current status (Mitigated / Partial / Not mitigated), evidence in code, and clear remediation steps with priority.

How to read this file
- **Status**: `Mitigated` means the codebase already contains adequate protections (or compensating controls) — still verify in production. `Partial` means some protections exist but additional work is required. `Not mitigated` means action required. Each item includes suggested next steps.

1) IP Binding
- Risk: Medium
- Status: Partial
- Evidence: session binding logic exists in `src/lib/session.ts` (admin session validation). See `src/lib/session.ts`.
- Why partial: IP checks exist but are brittle for mobile/VPN; currently they may cause legitimate admin logouts.
- Remediation steps:
  1. Make IP binding configurable via env flag (e.g., `ADMIN_BIND_IP=false`).
  2. Replace strict equality with fuzzy comparison (same /24) or treat IP as advisory in a risk score.
  3. On mismatch: require step-up (MFA or re-auth) instead of immediate logout.
  4. Log and monitor IP anomalies; add dashboard for rate of forced logouts.
- Priority: Medium — implement configurable soft-binding and monitoring.

2) User-Agent Binding
- Risk: Low → Medium
- Status: Partial
- Evidence: User-Agent considered in session handling (`src/lib/session.ts`).
- Why partial: full-string UA equality leads to false positives after browser updates/extensions.
- Remediation steps:
  1. Use a coarse fingerprint (platform + major browser version) or hash of key UA parts.
  2. Combine UA mismatches with IP or other signals before forcing logout.
  3. Make UA-binding opt-in via config and document behavior for admins.
- Priority: Low — adopt fuzzy UA checks and log mismatches.

3) External API Configuration (`menus.apiConfig`)
- Risk: High
- Status: Not mitigated (needs urgent work)
- Evidence: Menus may trigger external API calls configured via data (see `src/app/api/menus/route.ts` and menu handling code). This creates SSRF risk if not constrained.
- Remediation steps (urgent):
  1. Enforce server-side allowlist of domains; reject anything not on the list.
  2. Resolve hostnames and block private/reserved IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1, fc00::/7).
  3. Disallow or carefully handle redirects — re-resolve final target and re-check IP blocklist.
  4. Route outbound requests through a hardened egress proxy that enforces TLS, allowlist and logs all requests.
  5. Validate and normalize user-provided URLs; reject suspicious schemes (`file:`, `gopher:`) and unusual ports.
  6. Add unit tests for URL validation and integration tests for blocked addresses.
- Priority: Critical — implement before enabling external API features in production.

4) File Uploads
- Risk: Medium
- Status: Partial / Unknown (verify existing handlers)
- Evidence: Search shows upload handlers may exist; code review required to confirm validations and storage model (S3 vs local). Check `src/app/api/*` for upload endpoints.
- Remediation steps:
  1. Validate MIME types by inspecting magic bytes, not only extension.
  2. Enforce extension whitelist and strict size limits.
  3. Scan uploads with a malware scanner (ClamAV or cloud scanning) before processing.
  4. Store uploads off-app (S3/GCS) with private ACLs and serve via signed URLs.
  5. Sanitize filenames, never execute or allow direct include of uploaded content.
  6. Log and alert on virus-scan failures.
- Priority: High — confirm current state and add scanning & storage hardening.

5) WebSocket / Socket.IO Security
- Risk: Medium → High (if public/large scale)
- Status: Partial
- Evidence: `server.js` contains Socket.IO setup and origin checks and writes to Redis for presence. See `server.js`.
- Why partial: basic origin checks exist but you must enforce handshake auth, rate-limits, and global connection caps.
- Remediation steps:
  1. Enforce authentication on socket handshake (validate `nib-admin-session` or short-lived token). Reject unauthenticated connects to admin namespaces.
  2. Implement per-IP and per-session connection limits and global caps via reverse proxy (nginx, cloud LB) + Socket.IO middleware.
  3. Rate-limit inbound messages and validate payload sizes and shapes.
  4. Use heartbeat and idle timeouts; prune stale sessions server-side (already present but verify thresholds).
  5. Monitor connection spikes and alert.
- Priority: Medium — add token/auth on handshake and proxy caps.

Cross-cutting controls and notes
- CSRF: Mitigated — the app uses synchronizer CSRF tokens (`src/lib/session.ts`) and rotates tokens after state changes. Keep logging and monitoring for repeated 403s.
- sessionVersion: Mitigated — server-side revoke via `adminCredential.sessionVersion` is implemented. Ensure all password/admin-revoke flows increment this version.
- Centralize policy: move URL validation, egress logic, and outbound request wrapper into a single helper (e.g., `src/lib/safeFetch.ts`) and call from `src/app/api/menus/route.ts`.
- Logging & monitoring: create alerts for SSRF-blocked attempts, failed CSRF checks, upload malware findings, and socket spikes.

Quick next actions (practical)
1. Create `src/lib/safeFetch.ts` that resolves DNS, blocks private IPs, and proxies outbound calls. (Critical for `menus.apiConfig`.)
2. Audit upload endpoints and add malware scanning + S3 signed uploads.
3. Make IP/UA binding configurable and implement soft-failure logging + step-up auth.
4. Add socket handshake auth and proxy-level connection caps.

If you want, I can implement `src/lib/safeFetch.ts` and one example unit test now, or insert this mitigation file references into `src/app/api/menus/route.ts` to warn maintainers. Which should I do next?

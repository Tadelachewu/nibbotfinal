# Admin Guide — nib chatbot (Expanded)

This guide is written for Admin users and operators. It provides deep, practical explanations for each admin feature, concrete examples, recommended configurations, and real-world scenarios so admins can operate, troubleshoot, and demo the system professionally.

How to use this guide
- Follow the numbered steps for tasks and the scenario sections for realistic workflows.
- Use the "Try it" examples against the built-in `/api/test/*` endpoints for safe practice.
- For in-app access see `/admin/help` (renders this guide).

Overview — Core Admin Areas
- Dashboard (overview & real-time widgets)
- Menu Management (create, map, test, schedule)
- API Integration & Response Mapping (Message/Table)
- KYC / Dynamic Data Collection
- Reports & Logs (export, audit trails)
- App Settings & Branding
- Media & Uploads
- Admin Users & Security (sessions, roles)

Table of Contents — Main Nav Bars
- Dashboard
- Menu Management
- API Integration & Response Mapping
- KYC / Dynamic Data Collection
- Reports & Logs
- App Settings & Branding
- Media & Uploads
- Admin Users & Security
- Localization
- Logs

Prerequisites
- Start the development server with Socket.io: `npm run dev:io`
- Ensure `REDIS_URL` is configured for real-time presence.

1) Dashboard — Deep Dive
What it is
- Central overview for system health and user activity. Key widgets include "Online Now", Recent Activity, Top Menus, and Alerts.

What each widget means
- Online Now: True WebSocket presence count derived from Redis ZSET timestamps. It reflects active chat sessions that recently pinged the server.
- Recent Activity: Shows admin actions and user interactions (menu clicks, API calls). Useful for spotting spikes.
- Top Menus: Most-used menus in a given period — helps optimize UX and caching.
- Alerts: System-generated notices (failed jobs, third-party API outages, migration warnings).

How to interpret counts
- A high "Online Now" with no traffic may indicate bots or test scripts; cross-check with IP / session patterns.
- Divergence between "Top Menus" and expected usage may indicate broken menus or failing APIs.

Troubleshooting
- Online Now not updating: check `server.js` logs for Redis connection (search for "[Redis]") and ensure `REDIS_URL` is reachable.
- Spikes: identify origin by inspecting recent activity logs, checking IPs and user-agent strings.

Try it
- Start Redis locally and open multiple browser sessions hitting `/`. Watch the Admin Dashboard update in real time.

Scenario — Investigate sudden drop in "Online Now"
1. Verify Redis is connected: check server logs for `[Redis] Connected` or `redisReady` flag.
2. Confirm socket connections: review Node HTTP request logs and Socket.io connection events.
3. If Redis is down, restart Redis or fall back to local in-memory tracking (dev only) while rotating to a hosted provider for stability.

2) Menu Management — Deep Dive
What it is
- Menus are building blocks of the chatbot: actions that render messages, call APIs, or collect KYC data.

Menu Types & When to use them
- Static Message: Use for onboarding or help text that does not require external data.
- API Action: Use when you need dynamic content from a third-party service.
- Internal Support / Report: Use for internal support tickets or structured report submissions that capture multiple fields.

Fields and behaviors
- Root Mapping Key: Root location in API response to map templates (commonly `data`).
- KYC Fields: Schema-like definitions used to prompt users and pass values to APIs.
- Visibility & Scheduling: Control release windows and visibility for production/maintenance.

Best practices
- Keep response templates simple and validated; avoid nesting user input into raw HTML outputs.
- Use short, testable API endpoints during development; keep production secrets out of menu templates.

Try it
- Create a `Check Balance` menu: KYC `account_id` → API `GET /api/test/balance` → Message template `Account {{data.account_id}}: {{data.balance}} {{data.currency}}`.

Scenario — Create a new menu that lists recent transactions
1. Create Menu: `Recent Transactions` → Action Type: API Action.
2. Add KYC `account_id` (number, required).
3. API: `/api/test/user-transactions/{{account_id}}`.
4. Mapping: Table (Array Path) → `data.transactions` with columns `date`, `amount`, `type`.
5. Test in Admin UI and then publish.

Menu Editor — Features & Actions (what you can do on a created menu)

- Core fields
  - `Name` / `nameAm`: Localized display name shown to users.
  - `Response Type` (`responseType`): Select one of: Message, Table, Form, or API Action.
  - `Content` / `contentAm`: Message template for `Message` type (use `{{...}}` placeholders).

- Data & integration
  - `API Configuration` (`apiConfig`): Endpoint template, `requestParameters`, `headers`, auth, and `requiredKYC`.
  - `KYC Mappings` / `kycMappings`: Define KYC prompts, types, validation, and required fields.
  - `Attached Menus` / `attachments` (`attachedMenuIds`): Chain follow-up menus or subflows.

- Operational controls
  - `Support Assignee` (`supportAssignee`): Route resulting submissions to a support user or queue.
  - `Order` (`order`): Menu ordering within lists or parent children.
  - `Active` (`isActive`): Toggle to enable/disable without deleting.
  - `Track Clicks` (`trackClicks`, `clickCount`): Enable usage tracking for analytics.
  - `Versioning` (`pendingUpdate`, `pendingStatus`, `approvalStatus`): Draft, request approval, publish, or rollback.
  - `Scheduling` / Visibility: Publish windows for time-limited menus.
  - `Caching & TTL`: Response caching for API-backed menus.

- Developer / safety
  - `Test Console` / `Test`: Run with sample KYC values; inspect request/response and rendered output.
  - `Preview` / `Preview as User`: Localized preview in chat UI.
  - `Security` / Sanitization: Sanitize admin-provided HTML; avoid unsafe rendering.
  - `Webhooks & Retries`: Configure outgoing webhooks and retry/backoff policies.

- Content maintenance
  - `Duplicate` / `Clone`: Copy menus to speed creation.
  - `Delete` / `Archive`: Remove or archive (respect retention policies).
  - `Export` / `Import`: Backup or migrate menu JSON.
  - `Translations` (`translations`, `nameAm`, `contentAm`): Localize and preview per-locale.

Quick actions & best practices

- `Test` before `Publish`: validate templates and KYC mappings; server-side validation runs on save.
- Use environment-based secrets for auth headers; do not embed secrets in templates.
- Keep templates simple and escape or sanitize user input.
- Use `Track Clicks` selectively on high-traffic menus; consider sampling for metrics.

3) API Integration & Response Mapping — Deep Dive
What it is
- Mechanism to call external REST APIs, provide authentication, and map responses to Message or Table outputs.

Auth Patterns
- Bearer Token: add `Authorization: Bearer <token>` header. Prefer env-based tokens, not inline templates.
- API Key: custom header (e.g., `X-API-KEY`) — store in secrets and reference by key name.
- Basic Auth: encode user:pass in header — avoid if possible; prefer token-based auth.

Mapping details
- Message mapping: use template placeholders like `{{data.user.name}}` referencing the configured Root Mapping Key.
- Table mapping: choose Array Path mode when the response is an array of objects.

Error handling & retries
- When remote API errors occur, the admin UI surface shows failure details. Add retry/backoff in the call pipeline (server-side) for transient failures.

Try it — Example JSON flow
- Request: `GET /api/test/balance?account_id=88991122`
- Response (example): `{ "data": { "account_id": "88991122", "balance": 12500, "currency": "ETB" } }`
- Template: `Account {{data.account_id}} balance: {{data.balance}} {{data.currency}}`

4) KYC / Dynamic Data Collection — Deep Dive
What it is
- KYC is a sequenced data-collection mechanism that prompts the user for required fields and feeds those values into API calls or internal state.

Field types & validation
- Types: text, number, email, date, select.
- Validation: regex patterns, length checks, numerical min/max, optional vs required.

Privacy & retention
- Treat collected KYC as sensitive. Store with encryption at rest (DB level) and limit access via RBAC. Consider redaction in logs and export pipelines.

Try it
- Add `email` (type email, required) to a menu and use it to call `/api/test/profile`.

Scenario — Build a KYC flow requiring multiple fields
1. Create menu `Open Account` with action type `Form`.
2. Add fields: `full_name`, `email`, `dob`, `id_number` with validation.
3. Map to backend signup API and provide success/failure messages.

5) Reports & Logs — Deep Dive
What it is
- Administrative reports (usage, exports, audit) plus low-level logs for debugging.

Key reports
- Menu usage: counts by menu, time-window, and user segments.
- API success/failure rates: track which external integrations fail and why.
- Admin audit: who changed what and when (critical for compliance).

Log retention & export
- Configure retention policy per compliance needs; use daily exports for long-term storage.

Try it
- Export a CSV of `Menu Usage` for the last 30 days from the Reports panel.

6) App Settings & Branding — Deep Dive
What it is
- Centralized settings for branding, bot personality, default languages, time zones, and allowed origins.

Important settings
- `Public site URL`: used for email links and password reset callbacks.
- `Allowed origins`: restricts CORS; add admin domains only.
- Bot avatar/logo: affects the chat UI and admin previews.

Try it
- Change bot avatar in App Settings and refresh the chat preview to verify.

7) Media & Uploads — Deep Dive
What it is
- File storage for images and attachments used in messages and menus.

Security & validation
- Validate file types, sizes, and scan uploads if possible. Reject scripts and archive formats that may contain executables.

Try it
- Upload a bot image under Uploads → Media and use its placeholder in a test menu.

8) Admin Users & Security — Deep Dive
Auth model
- Admins authenticate via server-side sessions (`iron-session`). Sessions are HTTP-only cookies; rotate `SECRET_COOKIE_PASSWORD` when needed.

Roles & permissions
- Use least-privilege roles: Viewer, Editor, Admin. Enforce RBAC in API routes that manage menus, settings, and reports.

Session management
- Active session listing: expose session metadata and allow remote logout (invalidate cookie server-side by clearing session record).

Security checklist
- Rotate secrets in the event of exposure.
- Move long-lived keys to a secrets manager.
- Enforce HTTPS, `Secure`, `HttpOnly`, `SameSite=Strict` cookies in production.

Try it
- Create a low-privilege admin user and verify they cannot access `POST /api/menus`.

9) Security Best Practices (Operational)
- Secrets: Never commit `.env`. Use environment or vaults. Add secret scanning to CI.
- Dependencies: monitor `npm audit` and keep `audit.json` actionable.
- CORS: restrict Socket.io and API origins to trusted domains — do not accept all origins.
- XSS: sanitize any user- or admin-provided HTML before rendering (`dangerouslySetInnerHTML` must be sanitized).
- Redis: restrict to private network and enable ACL/TLS where possible.

10) Troubleshooting — Focused Steps
- Online Now stale: check Redis connection and `server.js` logs.
- Menu API errors: click `Test` in menu editor, inspect request/response and headers; reproduce with `curl`.
- Login issues: check DB migrations, seeded admin existence, and `SECRET_COOKIE_PASSWORD`.

Useful commands
```bash
# Redis health
redis-cli -u redis://localhost:6379 ping

# Run dev server
npm run dev:io

# Recreate local node modules after package.json changes
rm -rf node_modules package-lock.json
npm install
```

11) Common Admin Scenarios (Step-by-step)
- Onboard a new client-facing feature (e.g., Savings Calculator)
  1. Create Menu: name + static description for UX.
  2. Add a KYC field for `deposit_amount`.
  3. Create API Action pointing to internal calculator (test endpoint first).
  4. Map response to Message template and test.
  5. Publish and monitor Top Menus usage.

- Respond to suspicious activity (fraud pattern)
  1. From Dashboard alerts, identify suspect sessions and IPs.
  2. Export logs for those sessions and review recent API calls.
  3. Temporarily disable affected menus and rotate any shared keys if compromise suspected.

12) Interactive Tour & In-App Help
- For onboarding, add a guided tour using `react-joyride` or `intro.js`. Include steps for Dashboard, Menus, API Mapping, and Reports.

13) Next Actions I can implement
- Render this guide as formatted Markdown in `/admin/help` (convert to HTML with `remark` / `react-markdown`).
- Scaffold a `react-joyride` guided tour with example steps.
- Add an "Admin Tour" CTA in `AdminHeader` to launch the tour.

Choose one or more items above and I will implement them next (render Markdown, scaffold tour, add CTA, or export PDF).

---

14) Deep Dives: Admin Pages (nav items)
This section expands each navbar page into a granular, actionable deep dive with UI elements, expected behavior, admin controls, metrics to monitor, troubleshooting checks, and demo scenarios.

- Dashboard (deep)
  - UI elements:
    - Online Now widget: count + small table of recent session IDs and IPs (click to expand).
    - Recent Activity feed: filter by event type (menu_click, api_call, admin_action).
    - Top Menus: bar chart with usage counts + last-7-day sparkline.
    - Alerts panel: actionable alerts with links to remediation (retry, disable menu, rotate key).
  - Admin controls:
    - Time-range selector (1h/24h/7d/30d) for charts.
    - Export CSV for any widget.
    - Drill-down to session details (open socket timeline, recent API calls).
  - Metrics to monitor:
    - Socket connect/disconnect rates, Redis zadd failures, API failure rate per integration.
    - % of anonymous vs authenticated users (if applicable).
  - Troubleshooting checklist:
    1. Confirm `redisReady` in server logs.
    2. Reproduce via an isolated browser session and view network logs (WS handshakes).
    3. If Online Now shows large numbers but no activity, check for repeated sessionId reuse or bot traffic by IP.
  - Demo scenario:
    - Goal: show "Online Now" rising from 0 → 10.
    - Steps: open 10 incognito windows, navigate to `/`, watch real-time update and export CSV.

- Menus (deep)
  - UI elements:
    - List view: name, type, status, usage count, last modified date.
    - Menu editor: left column for structure (blocks/KYC), middle for request mapping, right for response mapping + test panel.
    - Test Console: input KYC values, run, see request/response and sanitized rendered output.
  - Admin controls:
    - Versioning: create draft, preview, publish, rollback to previous version.
    - Scheduling: enable/disable schedule windows and set TTL cache for responses.
    - Permissions: restrict editing to role-based users.
  - Metrics to monitor:
    - Per-menu error rate, average response time from external API, conversion rate (menu -> desired action).
  - Troubleshooting checklist:
    1. Use Test Console to reproduce mapping errors.
    2. Inspect API call headers and auth; ensure secrets are not embedded in templates.
    3. If table mapping fails, log raw JSON path and validate against sample response with a JSONPath tester.
  - Demo scenario:
    - Create a menu that calls `/api/test/exchange-rate`, map to table, and confirm proper column mapping.

- Submissions (deep)

  - Purpose
    - Central repository for user-submitted forms, reports, and KYC responses.

  - UI elements
    - Filter bar: menu, date range, user id, status (Pending / Reviewed / Resolved), priority, and tags.
    - Detail panel: full submission JSON, extracted KYC fields, IP & User-Agent, attachments, session timeline, and action buttons (Process, Send to Support, Export, Delete).

  - Admin controls
    - Bulk actions: mark as Reviewed/Resolved, export CSV/JSON, re-run webhook or enrichment.
    - Validation overrides: re-run server-side validation or enrichment pipelines after fixes are deployed.

  - Metrics to monitor
    - Submission volume, processing latency, automation failure rate, and manual review backlog.

  - Troubleshooting checklist
    1. For many malformed submissions: verify client-side KYC validation rules and regex patterns.
    2. For external processor failures: inspect outgoing headers, payloads, and webhook retry logs in the Submission detail view.

  - Triage tabs (Pending / Reviewed / Resolved)
    - Pending: newly received items requiring triage.
      - Default columns: Reference ID, Submitted At, Menu (origin), Submitter, Short summary, Priority, Actions.
      - Common actions: assign, add note, mark Reviewed/Resolved, export single submission, download attachments.
      - Automation: auto-assign rules (keywords → Fraud), auto-acknowledgement emails.

    - Reviewed: items under investigation or awaiting follow-up.
      - Columns: Reference ID, Reviewed By, Reviewed At, Current Status, Linked Ticket.
      - Actions: escalate/create ticket, attach notes/files, re-open to Pending.

    - Resolved: closed items (completed, rejected, duplicate).
      - Columns: Reference ID, Resolved At, Resolution Type, Resolved By, Public Response.
      - Actions: re-open, export (with optional redaction), archive per retention policy.

  - Common features across tabs
    - Free-text search across payloads, bulk actions, notifications/webhooks on state changes, and full audit logging for every admin action.

  - Example workflows
    - Fraud triage: Pending → auto-flag → Reviewed by investigator → Resolved with follow-up ticket.
    - Data correction: Pending (missing fields) → Reviewed (admin edits) → Re-run validation → Resolved → Export.

  - Support Ratings (post-resolution feedback)

    - Purpose: collect user feedback after a report is resolved (stored as `serviceRating`, optional `serviceFeedback`).

    - What you see in Admin UI
      - Rating display: stars (1–5), feedback text, quick tags, and metadata (`submissionId`, assignee, `serviceRatedAt`).
      - Controls: filters for rating value, sentiment, assignee, date range, and comment keywords.

    - Useful filters
      - Rating range (e.g., 1–2 for low), Rating type (stars/thumbs/NPS), Sentiment (positive/neutral/negative), Date range, Agent/Assignee, Menu origin, Comment keywords, Response-time thresholds, Submission state, Tags/Priority.

    - Sorting (UI)
      - `Highest average`: order by average rating (desc).
      - `Most ratings`: order by count of ratings (desc).
      - `Most recent rating`: order by latest rating timestamp (newest first).
      - `Top N` control: limit the number of rows shown (e.g., Top 10).

    - How to use
      - Triage low ratings for escalation, coach agents using aggregated scores, and export results for reports or audits.

  - Activity Log (per-submission timeline)

    - Purpose
      - Immutable chronological trail of actions taken on a submission for audit, forensics, and compliance.

    - What it contains
      - Entries with actor (admin/system/agent), action type (viewed, assigned, commented, status-changed, exported, redacted, attachment changes), timestamp, and optional notes.

    - Filters
      - Actor, Action type, Date range, Field-change only, Correlation id (API/ticket), and free-text notes search.

    - Common uses
      - Audit reviews, incident reconstruction, and identifying when/why data edits occurred.


- Users (deep)
  - Purpose: admin user management and end-user listing (sessions, profiles, activity).
  - UI elements:
    - Admin list: roles, last login, activity snapshot.
    - End-user list: sessionId, email/identifier, last activity, linked submissions, ban/suspend controls.
    - User detail: full profile, KYC items, action log, ability to impersonate (preview as user) or terminate sessions.
  - Admin controls:
    - Create/disable admin accounts, change roles, reset passwords, force logout for a user.
    - Impersonation toggle for debugging (log impersonation events in audit log).
  - Metrics to monitor:
    - Failed login attempts per user, admin activity volume, suspicious IP geolocation patterns.
  - Troubleshooting checklist:
    1. If user cannot login: check account status, DB user row, and session cookie validity.
    2. For session anomalies: check multiple active sessions and revoke if necessary.
  - Demo scenario:
    - Create a low-privilege admin, attempt restricted action, then elevate to fix and log the change.

- Localization (deep)
  - Purpose: manage UI strings, translations, fallback locales, and default language behavior.
  - UI elements:
    - Strings table: key, default text, translations per locale, last updated.
    - Upload/Download: import/export XLIFF/CSV for translation vendors.
    - Preview: switch locale and preview the Admin and User UI strings in context.
  - Admin controls:
    - Lock specific keys during release freezes, bulk import translation updates, schedule translation rollouts.
  - Metrics to monitor:
    - Coverage % per locale, missing keys per view, translation latency (time between default text change and translated update).
  - Troubleshooting checklist:
    1. Missing translation in the UI: verify key exists and that the selected locale is enabled in app settings.
    2. Encoding issues: check uploaded CSV/XLIFF encoding (UTF-8) and escape sequences.
  - Demo scenario:
    - Add an Amharic translation for the `Check Balance` menu and preview the menu in Amharic for a test user.

- Logs (deep)
  - Purpose: centralized observability for admin actions, system errors, integration failures, and security events.
  - UI elements:
    - Searchable log viewer with filters (level, source, time range, correlation id).
    - Linked stack traces and quick links to related submissions or sessions.
  - Admin controls:
    - Export logs for forensic analysis, set retention policies, mark logs as reviewed.
    - Configure alerting thresholds (e.g., API failure rate > 5% triggers an alert).
  - Metrics to monitor:
    - Error rate by endpoint, mean time to recover (MTTR), alerts fired per day.
  - Troubleshooting checklist:
    1. For repeated API errors: capture a few samples, extract request IDs, and reproduce externally with the same headers.
    2. For auth failures: verify token expiration, headers, and clock skew on servers.
  - Demo scenario:
    - Trigger a test failure in a mock API, observe the log entry, export it and attach to a support ticket.

**Top Helper Navbars**

These helper navbars appear at the top of the Admin UI and provide global actions and shortcuts that are available across admin pages. They improve discoverability, speed common tasks, and surface cross-cutting features.

- **Search / Global Search**: Quick access to search menus, submissions, users, and logs. Exists to let admins jump directly to items without navigating multiple pages; useful for incident response and rapid lookups.

- **Notifications**: Real-time system alerts, integration failures, and user-submitted critical reports. Exists to surface time-sensitive issues so admins can triage and respond quickly.

- **Quick Actions / Shortcuts**: Buttons for common tasks (Create Menu, Export CSV, Start Tour). Exists to speed repetitive workflows and reduce clicks for frequent operations.

- **User Menu (profile)**: Access to account settings, session management, and logout. Exists to let admins manage their profile, view active sessions, or perform emergency logout.

- **Help / Docs**: Links to the in-app Admin Help (`/admin/help`), contextual guidance, and contact/support links. Exists to provide immediate, code-backed documentation and troubleshooting steps.

- **Guided Tour CTA**: Launches the interactive onboarding tour (if enabled). Exists to onboard new admins and highlight key UI elements.

- **Export / Import**: Global export/import entry points for settings, translations, or menu backups. Exists to support migrations, backups, and bulk edits.

- **Breadcrumbs / Context**: Shows the current section and path. Exists to orient admins within nested pages and aid navigation.

Why these exist (summary):
- Improve discoverability and response time for critical events.
- Provide shortcuts to high-value admin workflows.
- Surface help and onboarding without leaving the current context.
- Enable global export/import and administrative housekeeping tasks.

If you want, I can also update the `AdminHeader` component to ensure the top helper nav labels match this guide (for example renaming "Form / Collection" UI labels to "Internal Support / Report").

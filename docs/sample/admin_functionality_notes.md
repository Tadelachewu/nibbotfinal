# Admin Dashboard Help (Readable Notes)

These notes explain what each Admin area does, what to check daily, and how to troubleshoot common issues. They are written as practical, readable notes (bulleted and indented) so Admins can operate confidently: create menus, map APIs, triage submissions, and keep the platform secure.

---

## Quick Start (Daily Routine)

- **Start of day (5-minute scan)**
  - **Dashboard**
    - Check **Online Now** (traffic / availability signal).
    - Check **Pending** and **Urgent** counts (workload / SLA).
    - Skim **Recent Activity** for error spikes or unusual patterns.
  - **Submissions**
    - Open **Pending** tab.
    - Assign owners and set priorities (do not leave urgent unassigned).
    - Add short internal notes for anything that needs follow-up.
  - **Menus**
    - For any change you plan to publish today:
      - run the **Test Console** with sample inputs,
      - confirm mapping renders correctly (message/table),
      - save for approval (Maker-Checker).
  - **Logs**
    - When something looks wrong, identify the category first:
      - menu/template issue,
      - KYC validation issue,
      - API/auth issue,
      - system outage/latency.

> Tip: Troubleshooting should follow the user journey in order: **menu → KYC → API call → mapping → output**. Find the first step that breaks.

---

## Contents

- [1. Dashboard](#1-dashboard)
- [2. Menu Management](#2-menu-management)
- [3. Submissions & Ticketing](#3-submissions-ticketing)
- [4. Users & Security](#4-users-security)
- [5. Localization & Branding](#5-localization-branding)
- [6. Logs & Observability](#6-logs-observability)
- [Common Troubleshooting](#common-troubleshooting)
- [Glossary](#glossary)

---

## 1. Dashboard

The Dashboard is the “command center” for system health, usage, and operational workload.

### What you see (and what it means)

- **Online Now**
  - What it tells you
    - Are users currently connected and active?
    - Is traffic normal for this time of day?
  - How to use it
    - sudden drop to zero can indicate downtime or real-time connectivity issues
    - sudden spike can indicate campaign traffic or abuse

- **Pending / Urgent**
  - What it tells you
    - current workload and SLA risk
  - How to use it
    - urgent should be assigned first
    - use it to plan staffing and handovers

- **Recent Activity**
  - What it tells you
    - “what just happened” across user actions and system actions
  - How to use it
    - spot newly introduced errors after a deployment
    - confirm that newly published menus are being used and behaving normally

- **Top Menus / Usage**
  - What it tells you
    - what users rely on most (high-impact flows)
  - How to use it
    - prioritize fixes in the most-used menus first
    - identify menus that need caching/optimization due to high volume

### Real-time widgets (practical notes)

- **Online Now widget**
  - Shows live count of active sessions.
  - Typically powered by real-time presence (WebSockets + presence store).
  - Drilldown is useful for:
    - identifying repeated IPs (possible abuse),
    - validating that traffic exists during incidents,
    - correlating “user says it’s down” with real presence.

### Recommended checks

- **Per shift**
  - Review Pending/Urgent and assign owners.
  - Scan Recent Activity for failures.
  - If you changed anything (menus/settings), watch the Dashboard for stability right after publishing.

- **Weekly**
  - Review Top Menus to decide:
    - what content to simplify,
    - what APIs to optimize,
    - what flows cause repeated submissions (possible UX confusion).

---

## 2. Menu Management

Menus define what the bot can do. A menu can show static content, call an API, or collect information (KYC/report) and create a submission.

### Menu types (when to use)

| Type | Use it for | Output |
|---|---|---|
| **Static** | FAQs, onboarding text, instructions, help pages | Rich text / message |
| **API** | balance checks, transactions, any live external data | Message or Table |
| **Report** | complaints, incident reports, structured data collection | Submission / ticket |

### Create or edit a menu (Editor)

- **Core fields (always set these well)**
  - `Name` / `NameAm`
    - keep names short and action-based (example: “Check Balance”, “Report Card Issue”)
    - ensure translations carry the same meaning (not word-for-word if unclear)
  - `Parent Menu`
    - defines where the menu appears in navigation
    - avoid deep nesting unless needed (too deep makes user navigation slow)
  - `trackClicks`
    - enable for important menus you want to measure
    - disable for low-value internal utilities to reduce noise

- **Static content notes**
  - use short paragraphs and bullets
  - include “what to do next” (example: contact, opening hours, required documents)
  - avoid large blocks of text; break into sections with headings

- **KYC mappings (data collection)**
  - What it is
    - prompts that collect user input before an API call or report submission
  - Good practices
    - collect the minimum required fields only
    - use clear prompts (what the user should type, examples, required format)
    - apply validation that blocks obvious junk, but don’t make it too strict
  - Field configuration checklist
    - `Type`
      - `text` for names/notes
      - `number` for IDs/amounts
      - `tel` for phone
      - `email` for email
      - `boolean` for yes/no
    - `Prompt` (English/Amharic)
      - include example input when helpful
        - example: “Enter account number (example: 100200300)”
    - `Required`
      - if required, confirm your prompt is unambiguous
    - `Validation`
      - prefer simple rules (length, numeric-only) over complex regex where possible

> Security note: treat KYC fields as sensitive. Do not collect secrets like PINs/passwords. Collect only what you need to complete the service.

- **API configuration (API menus)**
  - Endpoint basics
    - **Method**: GET/POST (match the API)
    - **Endpoint URL**: use correct base URL and correct path
  - Authentication
    - `None`: for public endpoints only
    - `Bearer Token`: preferred for most secure APIs
    - `API Key`: use header-based keys; avoid hardcoding where possible
    - `Basic Auth`: avoid unless required by legacy systems
  - Request mapping
    - map outgoing parameters from:
      - static values (fixed strings),
      - user/session values (secure tokens),
      - KYC values collected from the user.
    - keep parameter names exactly as the API expects.
  - Response mapping (most common source of “it doesn’t work”)
    - `Root Key`
      - where your useful JSON lives (example: `data`)
    - Message mode
      - write a short template sentence using placeholders
      - keep the output stable even if optional fields are missing
    - Table mode
      - use when the API returns an array of objects (transactions, items, history)
      - choose the correct array path and select columns users will understand

- **Attached menus / Next steps**
  - use to guide the user after a response:
    - example: after “Check Balance”, attach “Recent Transactions” and “Report Issue”
  - avoid attaching too many items; 2–4 is usually enough

- **Test Console (always use before saving)**
  - Run with 2–3 realistic examples:
    - a normal case (valid input)
    - an edge case (empty history, small balance, etc.)
    - a failure case (invalid account / unauthorized)
  - Inspect:
    - HTTP status code,
    - raw JSON response,
    - rendered message/table output.
  - Fix before saving:
    - wrong Root Key / mapping path,
    - missing columns in table,
    - unclear output text,
    - validation too strict.

### After saving (List view actions)

- **Reordering**
  - keep high-frequency menus near the top
  - group similar services together under the same parent
- **Add sub-menu**
  - use to create a clean “service category → action” structure
- **Active toggle**
  - suspend a menu during incidents (safer than deleting)
  - re-enable once fixed/approved
- **Delete**
  - only delete when you are sure it is no longer needed
  - prefer suspend if you might need it later

### Maker-Checker (Approval workflow)

- **What it is**
  - separation of duties: the person who creates changes is not the person who approves publishing
- **What to expect**
  - when an `Admin` edits/saves:
    - status becomes **Pending Approval** or **Pending Update**
  - when a `Checker` reviews:
    - **Approve** publishes,
    - **Reject** requires a reason (document what is wrong and what to fix)
- **Best practices**
  - write clear rejection reasons:
    - “Root Key should be `data`, mapping currently points to `result`”
    - “KYC validation rejects valid phone numbers; loosen regex”

---

## 3. Submissions & Ticketing

Submissions are user-generated reports/forms that require review, investigation, and resolution.

### Lifecycle tabs (operational meaning)

- **Pending (Triage)**
  - new items needing first review
  - actions: validate, assign, prioritize, request more info if needed
- **Reviewed (In progress)**
  - active investigation or waiting on an external party
  - actions: add notes, attach evidence, update status as work progresses
- **Resolved (Closed)**
  - completed and documented outcomes
  - actions: final response, export for reporting, audit readiness

### Triage checklist (use on every Pending item)

- **Quality checks**
  - confirm it is not duplicate or spam
  - confirm required fields exist (KYC completeness)
  - confirm the submission matches the selected menu/flow

- **Operational actions**
  - set **Priority**
    - urgent: service outage, fraud indicators, critical user impact
    - high: blocking issue for a user
    - medium/low: informational or non-blocking
  - set **Assignee**
    - always assign urgent/high items
    - reassign when staff shift changes

- **Internal notes (recommended format)**
  - **Summary**: one sentence describing the issue
  - **Evidence**: what you saw (IDs, timestamps, screenshots if needed)
  - **Next step**: what action you will take

### Inspect panel (Detail view)

- **Action bar**
  - update Status (Pending/Reviewed/Resolved)
  - update Priority (Urgent/High/Medium/Low)
  - assign to an agent (include reason/type if required)

- **User response (user-visible)**
  - keep it short and actionable:
    - what happened,
    - what you are doing,
    - what the user should do next (if anything),
    - expected follow-up channel (if applicable).

- **Collected data**
  - review KYC values in a clean grid
  - validate formats (account number length, phone number, dates)

- **Internal notes (private)**
  - store investigation details here, not in the user response
  - record decisions (why you rejected, why you escalated)

- **Export JSON**
  - export raw payload for:
    - compliance,
    - audits,
    - attaching to external ticket systems,
    - escalation to engineering.

### Support ratings (how to use)

- **What it is**
  - users can rate service (typically 1–5) and optionally leave feedback
- **How to use it**
  - identify repeated low ratings and investigate root cause:
    - unclear menu wording,
    - slow APIs,
    - delayed responses,
    - wrong routing/assignee.
- **Sorting options**
  - highest average (quality)
  - most ratings (volume)
  - most recent rating (fresh issues)
  - top N filter (focus view)

---

## 4. Users & Security

### Roles (what each role can do)

| Role | Primary purpose | Key restrictions |
|---|---|---|
| **Admin** | manage menus, users, settings | cannot approve own menu changes |
| **Checker** | approve/reject pending menu changes | focused on review/approval |
| **Support** | work on submissions/tickets | limited access outside reports |

### Onboarding / offboarding checklist

- **Onboarding**
  - assign least-privilege role first (Support → Admin only if required)
  - confirm the user can log in and access only needed pages
  - provide a short training checklist:
    - how to triage submissions,
    - how to use Test Console,
    - what not to store (secrets).

- **Offboarding / role change**
  - disable access immediately when staff leave or change roles
  - force logout sessions
  - verify no shared credentials were exposed (rotate secrets if needed)

### Security controls (recommended practices)

- **Session management**
  - use secure cookie sessions
  - force logout if compromise is suspected
  - review active sessions during incidents

- **Password policy**
  - use strong passwords and avoid reuse
  - reset credentials when:
    - device is lost,
    - staff leaves,
    - suspicious activity is detected.

- **Audit logging**
  - every admin action should be traceable:
    - who did it,
    - what changed,
    - when it happened.
  - use audit logs for investigations and compliance.

### End-user management

- **User listing**
  - view anonymous sessions, last activity, and linked submissions
  - useful for correlating “a user reported an issue” with actual activity

- **Preview as user**
  - use before publishing major menu changes
  - verify:
    - wording is clear,
    - KYC prompts make sense,
    - navigation returns back correctly,
    - outputs are readable on mobile.

---

## 5. Localization & Branding

### Localization (translations)

- **Strings table**
  - edit UI text and provide translations (example: Amharic)
  - use consistent terminology (menu names, action verbs)

- **Preview**
  - always preview before publishing:
    - text length fits the UI,
    - meaning is correct,
    - placeholders render correctly.

- **Translation best practices**
  - avoid translating IDs/keys or technical placeholders
  - keep user prompts natural and clear (not overly formal)
  - maintain consistent casing and punctuation.

### App settings & branding

- **Visual identity**
  - configure bot/user avatars and logos
  - keep branding consistent with organization guidelines

- **System configuration**
  - manage `supportedLanguages`
  - manage custom system translations

- **Reference / report ID formatting**
  - configure:
    - prefix (example: `NIB`)
    - include year (optional)
    - numeric length and start value
    - reset strategy (yearly vs continuous)
  - recommended
    - keep IDs short enough to read over the phone
    - ensure uniqueness (do not reuse IDs).

---

## 6. Logs & Observability

Logs help you explain what happened when a user reports “it doesn’t work”.

### Where logs help most

- **Confirm the failure type**
  - user input/validation issue,
  - template/mapping issue,
  - API/auth issue,
  - system latency/outage.

- **Confirm the time window**
  - match the user’s report time with log timestamps
  - check for repeated failures in the same period (systemic issue)

### What to look for

- **Interaction logs**
  - recent bot interactions
  - execution time (slow spikes can indicate upstream issues)
  - endpoint hit (which API/menu caused the issue)

- **Data masking**
  - sensitive values (tokens, passwords, PINs) should be redacted automatically
  - if you see secrets in logs, treat it as a security incident

- **Error tracking**
  - filter by status and type to identify:
    - failing endpoints,
    - common error codes (401/403/500),
    - patterns tied to a specific menu.

### Exporting logs (when escalating)

- Include:
  - timestamps,
  - the menu name,
  - request/response summaries (without secrets),
  - correlation IDs if available,
  - steps to reproduce.

---

## Common Troubleshooting

### “Online Now is zero”

- **Quick checks**
  - confirm the web app is up and reachable
  - reload the page and confirm the UI is not stale
- **Real-time checks**
  - confirm real-time connectivity and presence store connectivity (if used)
  - check whether a recent deployment disabled real-time features
- **Interpretation**
  - if user traffic should exist but Online Now is zero, treat as a potential outage

### “Menu is missing / not visible to users”

- Confirm the menu is:
  - Active (not suspended),
  - placed under the correct Parent Menu,
  - approved/published (Maker-Checker),
  - not hidden behind scheduling/visibility rules (if configured).

### “API menu returns empty data”

- Compare:
  - raw JSON (Test Console) vs mapping configuration
- Validate:
  - `Root Key` is correct
  - mapping paths match the actual JSON structure
  - table array path points to the correct array
- Confirm:
  - API returned 200
  - expected fields exist (not renamed or nested differently)

### “API menu returns 401/403”

- Authentication checks
  - confirm auth type matches the API requirement
  - confirm header name/value are correct
  - confirm tokens are not expired and are coming from the expected source
- Common causes
  - wrong environment (test token in prod)
  - missing prefix (Bearer vs raw token)

### “API menu returns 500 or ‘Server error’”

- Determine whether the error is:
  - upstream (API is failing),
  - mapping/template (bad path causing exception),
  - validation (unexpected input breaks server logic).
- Collect:
  - exact time and menu name,
  - sample inputs used,
  - raw response body (if safe),
  - error trace/log entry for engineering.

### “Users can’t submit a report”

- KYC checks
  - required fields may be missing or unclear
  - validation rules may be too strict (common)
- Workflow checks
  - menu may be suspended or not approved
  - submission pipeline may be failing (check logs)

---

## Glossary

- **Menu**
  - a bot action item that renders content, calls an API, or collects KYC/report data
- **Static menu**
  - a menu that renders fixed content (FAQ/instructions)
- **API menu**
  - a menu that calls an external/internal API and renders a message or table
- **Report menu**
  - a menu that collects structured info and creates a submission/ticket
- **KYC mapping**
  - the form-like schema that collects user inputs before executing an action
- **Root Key**
  - the base JSON path used when mapping API responses into templates
- **Response mapping**
  - rules that turn raw JSON into a user-readable message or table
- **Submission**
  - a stored report/form created from a Report menu
- **Maker-Checker**
  - approval workflow separating change creation from change approval

---

## Frequently Asked Questions

### Dashboard & Reporting

**Q: What does "Interactions" count?**
A: Every time a user taps a menu item and the bot responds — clicking a menu, calling an API, or submitting a form. Each tap that gets a bot response counts as 1 interaction.

**Q: What does "Unique Users" mean?**
A: The number of different people (browser sessions) who used the chatbot in the selected time period. The same person chatting 50 times still counts as 1 unique user.

**Q: What are "Submissions"?**
A: Completed report or KYC form submissions — when a user fills out all required fields and submits. Partial or abandoned forms are not counted.

**Q: What is the difference between "Successful" and "Failed"?**
A: Successful means the bot responded correctly (API returned OK, content displayed). Failed means something went wrong — an API error, timeout, or validation failure. Together they should equal total Interactions.

**Q: What does "Success Rate" show?**
A: Successful ÷ Total Interactions × 100. A rate of 100% means every interaction completed without errors. A drop signals something is broken and needs investigation.

**Q: What is the difference between "All Visits" and "Unique Visits"?**
A: All Visits counts every time the app is opened — the same person opening it on Monday, Tuesday, and Wednesday equals 3 visits. Unique Visits counts distinct people or devices — that same person equals 1 unique visit. If All Visits is much higher than Unique Visits, it means users are returning regularly.

**Q: How do the time filters (Today / Week / Month) work?**
A: All metrics are filtered by the selected range. "Today" shows only activity since midnight. "Week" shows from the start of this week. "Month" shows from the 1st of this month. "Custom" lets you pick any start and end date with time.

**Q: How should I compare Interactions vs Unique Users?**
A: If Interactions is much higher than Unique Users, each user is engaging deeply with the bot. If they are close, most users are trying it once and leaving — this may indicate a UX or content issue.

### Why Each Reporting Count Matters

**Q: Why is the Interactions count important?**
A: It measures total system usage — how much work the bot is handling. A sudden drop may indicate the bot is down or a popular menu is broken. A sudden spike may indicate a campaign, viral traffic, or abuse. Track it daily to establish a baseline so anomalies are easy to spot.

**Q: Why is Unique Users important?**
A: It tells you how many real people are using the service. If you have 1,000 interactions but only 10 unique users, a small group is doing all the work — the bot is not reaching a wide audience. If unique users are growing week over week, the service is gaining adoption.

**Q: Why should I watch Submissions closely?**
A: Each submission is a real user requesting help or reporting an issue — it represents workload for your team. A spike in submissions may mean a service outage is driving complaints. Zero submissions when they are expected may mean the report form is broken or too hard to complete. Compare submissions to interactions to understand your conversion rate — if many users interact but few submit, the form flow may need simplification.

**Q: Why does Success Rate matter more than the raw Successful/Failed numbers?**
A: A system with 900 successful and 100 failed interactions (90% success rate) needs immediate attention — 1 in 10 users is hitting an error. The raw number of failures alone does not tell the story. Watch for success rate dropping below 95% as a warning sign and below 90% as critical. A sudden drop after a menu edit or deployment usually means the change broke something.

**Q: Why track both Successful and Failed separately?**
A: Because they tell different stories. Rising failures with stable successes means a new problem was introduced (bad menu config, API outage). Rising successes with stable failures means more users but the same old issues remain unfixed. Both rising together means traffic is growing and failures are scaling with it — the failure rate is what matters.

**Q: Why are All Visits and Unique Visits reported separately?**
A: The ratio between them reveals user retention. If All Visits is 500 and Unique Visits is 100 this month, each user returns 5 times on average — strong engagement. If both are 100, no one is coming back — the service may not be useful enough or users do not know it exists. Watch this ratio weekly to measure whether your content and services drive repeat usage.

**Q: What should I do when a specific metric looks wrong?**
A: Use this decision tree: (1) If Interactions drop — check if the app is up and menus are active. (2) If Success Rate drops — check Logs for new error patterns, filter by the time the drop started. (3) If Submissions spike — check if a service outage is generating complaints. (4) If Unique Users flatline — the bot is not being discovered, consider promotion or better placement. (5) If All Visits equals Unique Visits over a month — users are not returning, review content quality and usefulness.

### Menu Management

**Q: What is the difference between Static, API, and Report menus?**
A: Static menus display fixed content (FAQs, instructions). API menus call an external service and show live data (balances, transactions). Report menus collect user information through a form and create a submission for admin review.

**Q: What is Maker-Checker and why does it matter?**
A: It is an approval workflow — the person who creates or edits a menu cannot publish it. A separate Checker must review and approve it first. This prevents accidental or unauthorized changes from going live.

**Q: What should I do before saving an API menu?**
A: Always use the Test Console with at least three cases — a normal input, an edge case (empty result, zero balance), and an invalid input. Verify the HTTP status, raw JSON response, and rendered output all look correct.

**Q: A menu is not showing for users — what do I check?**
A: Verify four things in order: (1) the menu is set to Active, (2) it is under the correct Parent Menu, (3) it has been approved through Maker-Checker, and (4) KYC fields are not blocking users with overly strict validation.

### Submissions & Ticketing

**Q: What do Pending, Reviewed, and Resolved mean?**
A: Pending items are new and need first triage — assign an owner and set priority. Reviewed means someone is actively working on it. Resolved means it is completed and documented. Every submission should move through these stages.

**Q: How should I prioritize submissions?**
A: Urgent is for service outages, fraud indicators, or critical user impact — assign immediately. High is for issues blocking a user. Medium and Low are informational or non-blocking. Never leave Urgent items unassigned.

**Q: What are internal notes for?**
A: Internal notes are private (users cannot see them). Use them to record investigation details, evidence, decisions, and handover instructions. Keep the user-visible response short and actionable.

### Users & Roles

**Q: What is the difference between Admin, Checker, and Support roles?**
A: Admin can manage menus, users, and settings — but cannot approve their own menu changes. Checker reviews and approves or rejects pending menu changes. Support works on submissions and tickets with limited access to other areas.

**Q: What happens when I create a new admin user?**
A: They receive a temporary password that expires in 24 hours. On first login they are forced to change it. The new password must be at least 12 characters with uppercase, lowercase, number, and special character.

**Q: When should I disable a user account?**
A: Immediately when a staff member leaves, changes roles, or when suspicious activity is detected on their account. Disabling invalidates all active sessions. If shared credentials were exposed, rotate all related secrets.

### App Settings & Branding

**Q: What do the avatar and logo settings control?**
A: Bot Avatar is the icon shown next to bot messages. User Avatar is the icon for the user. App Logo appears in the header and welcome screen. Each can be set to text initials, a locally uploaded image, or an external image URL.

**Q: What is the Report ID configuration?**
A: It controls how submission reference numbers are generated — the prefix (e.g., NIB), whether the year is included, the number length, and the starting value. Keep IDs short enough to read over the phone and ensure uniqueness.

### Logs & Security

**Q: How do I investigate when a user reports "it does not work"?**
A: Follow the user journey in order: menu → KYC → API call → response mapping → output. Open Logs, filter by the user's session ID and approximate time, and find the first step that failed. The error category (validation, auth, timeout, mapping) tells you where to fix.

**Q: What do I do if I see secrets (tokens, passwords) in logs?**
A: Treat it as a security incident. Sensitive values should be redacted automatically. If you see them in plain text, report it to engineering immediately and rotate the exposed credential.

**Q: What does the Audit Log track?**
A: Every admin action — login, logout, user creation, password changes, menu edits, settings updates, and lockouts. Each entry includes who did it, what changed, when, from which IP, and with which browser. Use it for compliance and investigations.

### Rate Limiting & Account Lockout

**Q: What happens if someone enters the wrong password too many times?**
A: After 5 failed login attempts for the same username, that account is locked for 15 minutes. No one can log into that account until the lockout expires, even with the correct password. This prevents brute-force password guessing.

**Q: What if an attacker tries many different usernames with the same password?**
A: The system tracks total failed logins per IP address across all usernames. After 10 cumulative failures from the same IP — regardless of which usernames were tried — that entire IP is locked out for 30 minutes. This stops credential-stuffing attacks.

**Q: How does IP rate limiting work on login?**
A: Each IP address is allowed a maximum of 5 login requests per 15 minutes. After that, additional attempts from the same IP are rejected with "Too many attempts. Try again later." and a 429 status code. This applies to all requests, successful or not.

**Q: What is progressive delay and why do failed logins feel slower each time?**
A: Each consecutive failed login adds an increasing delay before the error response is returned — 1 second after the first failure, 2 seconds after the second, 4 seconds after the third, and up to 8 seconds. This makes automated tools impractical even within the rate limit window.

**Q: Are other endpoints besides login also rate limited?**
A: Yes. Password change is limited to 10 attempts per user per 15 minutes with account lockout after 5 wrong current-password entries. Password reset (forgot password) is limited to 20 requests per IP and 5 requests per email per 15 minutes. Recovery token verification is limited to 10 attempts per token per 15 minutes. All these limits prevent abuse of every authentication endpoint.

**Q: What happens if Redis goes down — does rate limiting stop working?**
A: No. The system falls back to in-memory counters when Redis is unavailable. Rate limiting continues to work, but the counters are local to the server process and will reset if the server restarts. This is why keeping Redis running is important for consistent protection.

**Q: I locked myself out — what do I do?**
A: Wait for the lockout to expire (15 minutes for account lockout, 30 minutes for IP lockout). If you need immediate access, an administrator with server access can clear the lockout by restarting Redis (`redis-cli FLUSHDB`) or restarting the app process (which clears in-memory counters). Use this only in emergencies.

**Q: How do I know if someone is trying to attack the login?**
A: Check the Audit Log for `LOGIN_FAILURE`, `LOGIN_LOCKOUT`, `LOGIN_IP_LOCKOUT`, and `LOGIN_IP_RATE_LIMITED` events. Multiple failures from the same IP targeting different usernames is a strong indicator of credential stuffing. Multiple failures targeting one username from different IPs suggests a targeted brute-force attack. Both patterns are logged with IP addresses and timestamps for investigation.

### How to Test Rate Limiting & Account Lockout

Use these test cases to verify the protections are working correctly after deployment. All tests should be performed from the admin login page.

**Test 1 — Account lockout after 5 wrong passwords**
Steps: (1) Go to the login page. (2) Enter a valid username with a wrong password. (3) Repeat 5 times.
Expected: After the 5th failure, the response changes to "Too many attempts. Try again later." with a 429 status. The account remains locked even if you enter the correct password. Wait 15 minutes — the account unlocks automatically.

**Test 2 — Progressive delay on failures**
Steps: (1) Enter a wrong password and time how long the error takes to appear. (2) Enter wrong again and time it. (3) Repeat.
Expected: First failure responds in about 1 second. Second failure takes about 2 seconds. Third takes about 4 seconds. Fourth takes about 8 seconds. Each failure feels noticeably slower than the previous one.

**Test 3 — IP rate limit (5 requests per 15 minutes)**
Steps: (1) Send 5 login requests rapidly (any username, any password). (2) Send a 6th request.
Expected: The 6th request is rejected with "Too many attempts. Try again later." and a Retry-After header. This applies even if you use different usernames each time.

**Test 4 — IP lockout across different usernames (credential stuffing protection)**
Steps: (1) Try logging in with username1 / wrongpassword. (2) Try username2 / wrongpassword. (3) Continue with different usernames up to 10 total failures from the same IP.
Expected: After 10 cumulative failures across any usernames, the entire IP is locked for 30 minutes. All further login attempts from that IP are rejected regardless of username.

**Test 5 — Successful login clears failure count**
Steps: (1) Enter wrong password 3 times for a valid username. (2) Enter the correct password.
Expected: Login succeeds. The failure counter for that account is reset to zero. The account is not in danger of lockout from previous failures.

**Test 6 — Lockout does not affect other accounts**
Steps: (1) Lock out "admin" by failing 5 times. (2) Try logging in as "checker" with the correct password.
Expected: "checker" login succeeds — per-account lockout only affects the locked account. (Note: if the IP rate limit is also exhausted, both will be blocked. Test from a different IP or wait for the IP limit to reset.)

**Test 7 — Audit log entries for failures**
Steps: (1) Fail a login attempt. (2) Go to the Admin Audit Log.
Expected: A `LOGIN_FAILURE` entry appears with the username, IP address, failure count, and timestamp. After lockout, a `LOGIN_LOCKOUT` entry also appears. After IP lockout, a `LOGIN_IP_LOCKOUT` entry appears.

**Test 8 — Change password lockout**
Steps: (1) Log in successfully. (2) Go to Change Password. (3) Enter the wrong current password 5 times.
Expected: After 5 failures, the change password endpoint is locked for 15 minutes for your account. You can still use other parts of the admin panel — only the password change is locked.

### Password Policy

**Q: What are the password requirements?**
A: Passwords must be at least 12 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character. Common passwords (like "password123" or "admin1234") are blocked. Passwords found in known data breaches (checked via the HaveIBeenPwned database) are also rejected.

**Q: How does breach checking work — does the system send my password somewhere?**
A: No. The system uses a privacy-safe method called k-anonymity. It hashes your password with SHA-1, sends only the first 5 characters of the hash to the HaveIBeenPwned API, and receives back a list of matching hash suffixes. The full hash never leaves the server. If your password's hash appears in the list, it has been exposed in a known data breach and you must choose a different one.

**Q: Why was the minimum length increased from 8 to 12?**
A: Modern password-cracking tools can break 8-character passwords in hours. A 12-character minimum with mixed character types provides significantly stronger protection against both brute-force attacks and dictionary attacks, which is especially important for a banking application.

### File Upload Security

**Q: What file types can be uploaded?**
A: Only image files — PNG, JPEG, GIF, and WebP. The system validates three layers: the declared MIME type must be an image type, the file extension must be an image extension, and the actual file content must contain valid image magic bytes (binary signatures). A non-image file renamed to .png will be detected and rejected.

**Q: What if I upload a JPEG file that was saved with a .png extension?**
A: The system detects the mismatch and auto-corrects. It reads the actual file content, determines the real format from the magic bytes, and stores it with the correct extension. The upload succeeds without error.

**Q: Where are uploaded files stored?**
A: In a private `storage/uploads/` directory outside the web-accessible folder. Files are served through a controlled endpoint that adds security headers (Content-Type, X-Content-Type-Options: nosniff, Content-Disposition). They are not directly accessible as static files.

# NibBot Reporting System: Comprehensive Documentation

## Overview
The NibBot Reporting System provides detailed analytics about bot performance, user interactions, support submissions, and visit metrics. It includes three main sections:

1. **General Report**: Executive summary with key metrics
2. **Detail Report**: Hierarchical breakdown by menu type
3. **Submission Analytics**: Deep dive into support reports

---

## Key Metrics: Full Breakdown

### General Report Metrics (8 Total)
All metrics are calculated for the selected time range (Today, Week, Month, or Custom).

| Metric | Description | Calculation Method |
|--------|-------------|------------------|
| **1. Interactions** | Total meaningful user actions (menu clicks, API calls, submissions, etc.) | Count of all `filteredLogs` that match a menu or action type (excludes `session_start` system logs) |
| **2. Unique Users** | Distinct user sessions that performed any meaningful interaction | Number of unique `sessionId` values from counted interactions |
| **3. Submissions** | Total completed KYC/support reports | Count of `UserReport` records in time range |
| **4. Successful** | Interactions that completed without errors | Count of interactions where `status` is `success` |
| **5. Failed** | Interactions that encountered errors | Count of interactions where `status` is `error` or `failed` |
| **6. Success Rate** | Percentage of successful interactions | `(Successful / Interactions) * 100` (rounded to 1 decimal place) |
| **7. All Visits** | Total number of times the app was opened (including returning users) | Count of `session_start` logs |
| **8. Unique Visits** | Distinct user sessions that opened the app | Number of unique `sessionId` values from `session_start` logs |

---

## Log Types & Data Sources

### InteractionLog Table Schema
Every user action creates an entry in `InteractionLog`:
| Field | Description |
|-------|-------------|
| `sessionId` | Unique user/session identifier |
| `userMessage` | User's input or menu name clicked |
| `botResponse` | Bot's reply or action result |
| `status` | `success` / `error` / `failed` |
| `endpoint` | API endpoint or internal action type |
| `responseTime` | Time taken for the action (ms) |
| `tags` | Array of tags identifying the action type |
| `timestamp` | When the action occurred |

### Common Tags
| Tag | Description |
|-----|-------------|
| `session_start` | App opened by a user |
| `navigation` | Menu item clicked |
| `api` | API call completed |
| `api_call` | (Legacy) API call completed |
| `report` | Support/KYC report submitted |
| `static` | Static content viewed |
| `kyc_start` | KYC process initiated |
| `error` | Error occurred |
| `[menu_name]` | Name of the menu interacted with (e.g., "Check Balance") |

---

## Detail Report Menu Hierarchy

### 1. Static Menu (Globe Icon, Blue Color)
- **What it counts**: Static informational content views (FAQs, terms, etc.)
- **Metrics**:
  - Interactions per menu
  - Unique users
  - Success rate (usually 100% for static content)

### 2. API Menu (Zap Icon, Amber Color)
- **What it counts**: Live API integrations
- **Metrics**:
  - Interactions per API menu
  - Unique users
  - Errors
  - Average response time (ms)
  - Success rate

### 3. Internal Support Menu (ClipboardList Icon, Emerald Color)
- **What it counts**: Support/KYC report submissions
- **Metrics**:
  - Interactions/submissions per report menu
  - Unique users
  - Pending/Reviewed/Resolved counts
  - Conversion rate

---

## Submission Analytics
This section shows individual support/KYC reports with:
- **Report Info**: Report ID, timestamp, menu name, user ID
- **Escalation Path**: Full history of support user assignments
- **User Rating**: 1-5 star rating (if provided)
- **Feedback**: Verbatim user comments (if provided)

---

## Data Export
You can export data to CSV files:

1. **Detail Report CSV**:
   - Category-level summaries
   - Menu-level detailed metrics

2. **Submission Analytics CSV**:
   - Individual report details
   - Escalation path formatted for readability
   - User ratings and feedback

---

## Time Range Filtering
Choose from:
- **Today**: From midnight to current time
- **Week**: From start of current week to now
- **Month**: From start of current month to now
- **Custom**: Any date range you specify

---

## Example Workflow & Metric Calculation
Let's walk through a single user's session:

1. **9:00 AM**: User opens app → 1 `session_start` log (counts toward All Visits and Unique Visits)
2. **9:01 AM**: User clicks "Check Balance" menu → 1 `navigation` log (counts toward Interactions)
3. **9:02 AM**: API call returns successfully → 1 `api` log (counts toward Interactions and Successful)
4. **9:05 AM**: User submits a support report → 1 `report` log (counts toward Interactions, Successful, and Submissions)
5. **10:00 AM**: User refreshes page → another `session_start` (counts toward All Visits but NOT Unique Visits)

**Metrics for this time range**:
- All Visits: 2
- Unique Visits: 1
- Interactions: 3
- Successful: 3
- Failed: 0
- Success Rate: 100%
- Submissions: 1

---

## Security & Role-Based Access
- Only admin and support users can access the reporting console
- Data is filtered based on user role (non-admins see only their assigned reports)
- All actions are logged for audit purposes

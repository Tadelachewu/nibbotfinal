# How NibBot Reporting Works

## Interaction Counting - The Basics

Each time something happens in NibBot, it creates a **log entry** in the `InteractionLog` database table. The reporting system counts these log entries to measure activity.

---

## 1. What Counts as an Interaction?

**Every log entry = 1 interaction**, including:

| Action | What Happens |
|--------|--------------|
| User clicks a menu button | Log created with `navigation` tag |
| User views static content | Log created with `static` tag |
| API call completes (success or fail) | Log created with `api` tag |
| Report/KYC form submitted | Log created with `report` tag |
| Session starts | Log created with `session_start` tag (usually skipped in reporting) |

**Note**: For API and Report actions, you may get **2 interactions** per user action:
1. One for the initial menu click
2. One for the completed action (success or error)

---

## 2. How Time Filtering Works

The reporting system lets you choose a time range (Today, Week, Month, Custom):

```javascript
// Step 1: Define your time range
// e.g., "Today" = from midnight to now

// Step 2: Filter logs to only those in your range
const filteredLogs = logs.filter(log => {
  const d = new Date(log.timestamp);
  return d >= startDate && d <= endDate;
});

// Step 3: Total interactions = number of filtered logs
const totalInteractions = filteredLogs.length;
```

---

## 3. How Menu Grouping Works

Logs are grouped into 3 categories:
1. **Static Menu**: Informational content
2. **API Menu**: Live integrations
3. **Internal Support Menu**: Report/KYC forms

### 3.1 Finding Which Menu a Log Belongs To

Each log has `tags` that help identify the menu:
```javascript
// Example log tags:
["navigation", "About Us"]
// "About Us" is the menu name
```

The system:
1. Looks for tags that are NOT system tags (`session_start`, `api`, `navigation`, etc.)
2. Finds the corresponding menu from the database
3. Normalizes the name (case-insensitive, trimmed) to match correctly

### 3.2 If the Menu Can't Be Found

If the menu is deleted or the tag doesn't match:
1. The system falls back to the type tags (`api`, `static`, or `report`)
2. If it still can't determine the type, it skips the log

---

## 4. Per-Menu Statistics

For each menu, the system calculates:

| Metric | How It's Calculated |
|--------|---------------------|
| **Interactions** | Number of logs for this menu |
| **Unique Users** | Number of distinct `sessionId`s in the logs |
| **Errors** | Number of logs where `status === 'error'` or `'failed'` |
| **Latency** | Average of all `responseTime` values (for API menus) |
| **Success Rate** | `(Total - Errors) / Total * 100` |
| **Submissions** | Number of reports submitted through this menu |
| **Pending/Reviewed/Resolved** | Count of reports in each status |

---

## 5. Unique Users vs. Total Interactions

- **Total Interactions**: Every click, every action - even the same user doing the same thing multiple times
- **Unique Users**: Counts each distinct `sessionId` only once (if one user clicks 10 times, they still count as 1 unique user)

```javascript
// Example:
// 5 logs from session-123
// 3 logs from session-456

// Total Interactions = 8
// Unique Users = 2 (only 2 distinct sessionIds)
```

---

## 6. Daily Volume Chart

The chart shows activity over time:

1. The selected time range is split into days
2. For each day:
   - Count interactions (logs) that day
   - Count submissions (reports) that day
3. Plots both lines to show trends

---

## 7. Data Export

When you export:

**Detail Report CSV**:
- One row per category (Static/API/Report) with totals
- One row per menu with detailed stats

**Submission Analytics CSV**:
- One row per report
- Includes Escalation Path history
- User rating and feedback (if provided)

---

## 8. Important Notes

1. **Logs are permanent**: Deleting a menu doesn't delete past logs - they still appear in historical reports
2. **Normalized matching**: Menu names are matched case-insensitively ("About Us" = "about us")
3. **Role-based access**: Non-admin users only see data they're allowed to access
4. **Real-time**: Data refreshes when you change the time range or tab (no caching)
5. **Page size**: By default, up to 500 logs/reports are fetched at a time

---

## Example Flow

Let's walk through a user's journey and see how it's counted:

1. **User opens NibBot** → 1 interaction (`session_start`)
2. **Clicks "Check Balance" menu** → 1 interaction (`navigation`, "Check Balance")
3. **Enters account number and submits** → 1 interaction (`kyc_start`)
4. **API call succeeds** → 1 interaction (`api`, "Check Balance")
5. **User has a problem and submits a report** → 1 interaction (`navigation`, "Report Issue")
6. **Report is created** → 1 interaction (`report`, "Report Issue")

**Total Interactions for this user**: 6
(Usually `session_start` and `kyc_start` are excluded from menu-specific stats, so you'd see 4 actionable interactions)

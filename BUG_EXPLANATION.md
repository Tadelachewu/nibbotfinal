# Bug Explanation: Auto-Incrementing Interactions on Page Load

## The Problem

When a new user (or incognito user) opens `https://nibterachatboat.nibbank.com.et/`, **2 extra interactions are counted automatically** - even before they click any menu!

## Why It Happens

### 1. The First Log: `session_start`

When a user first loads the site, this code runs (ChatInterface.tsx line 428-442):

```javascript
useEffect(() => {
  if (!userData.id || typeof window === 'undefined') return;
  const key = `nib_session_logged:${userData.id}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  logInteraction({
    sessionId: userData.id,
    userMessage: 'SESSION_START',
    botResponse: 'SESSION_START',
    status: 'success',
    endpoint: 'Internal:SessionStart',
    responseTime: 0,
    tags: ['session_start'] // <-- This is the issue!
  });
}, [userData.id]);
```

This creates **1 interaction** automatically when the user first visits.

### 2. Is There a Second Log?

Wait - you said **2 extra interactions**. Let's check Socket.IO presence!

## The Counting Bug in Reporting.tsx

In **Reporting.tsx line 141**:

```javascript
const totalInteractions = filteredLogs.length;
```

This counts **ALL logs** in the time range, including:
- `session_start`
- `kyc_start`
- Any other system logs

But then later, when grouping into menus (line 158-202), it skips logs where `type === 'unknown'` (like `session_start`):

```javascript
// Skip if still unknown (Removing General Activity)
if (type === 'unknown') return;
```

So:
- **Total Interactions (top card)**: Includes `session_start` and all system logs
- **Menu-specific counts**: Exclude those system logs

## What This Looks Like

1. User opens site (incognito)
2. 2 interactions counted immediately
3. User clicks a menu → now 3 interactions
4. User submits a report → now 5 interactions

## The Fix

We need to calculate `totalInteractions` the same way we calculate menu interactions - by excluding unknown/system logs!

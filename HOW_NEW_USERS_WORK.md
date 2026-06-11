# How New Chrome (and Any Browser) Users Work in NibBot

## The Journey of a New Chrome User

Let's walk through exactly what happens when a new user opens NibBot for the first time in Chrome (or any browser):

---

## 1. User Opens the Website

**What happens**:
- Chrome loads `https://nibbot.yourbank.com`
- The NibBot front-end code starts

---

## 2. Session ID Generation

The first thing the code does is check if the user already has a session:

```javascript
const STORAGE_KEY = 'nib_user_session';
let sessionId = '';

// Check localStorage for existing session
const stored = localStorage.getItem(STORAGE_KEY);
if (stored) {
  // Returning user - use existing session
  sessionId = stored;
} else {
  // New user - create a brand new session ID
  sessionId = 'user_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem(STORAGE_KEY, sessionId);
}
```

**What this means for Chrome**:
- The session ID is stored in Chrome's `localStorage`
- It stays there even if the user closes and re-opens Chrome
- It only disappears if the user clears their browser data

---

## 3. Session Cookie Created

Next, the system creates a secure, HTTP-only cookie:

```javascript
fetch('/api/session-cookie', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId }),
  credentials: 'same-origin'
});
```

**Why this matters**:
- The cookie is used for real-time Socket.IO connections
- It's HTTP-only, so JavaScript can't read it (security feature)
- Chrome handles it automatically for all requests

---

## 4. Welcome Screen Loaded

The user sees the bot welcome screen with the main menu options.

---

## 5. Session Start Logged

A `session_start` log is created:
```javascript
logInteraction({
  sessionId: userData.id,
  userMessage: 'SESSION_START',
  botResponse: 'SESSION_START',
  status: 'success',
  endpoint: 'Internal:SessionStart',
  responseTime: 0,
  tags: ['session_start']
});
```

This counts as **1 interaction** in reporting!

---

## 6. User Starts Interacting

Every time the user clicks a button or does something:
- A new log entry is created
- The log is tagged with their `sessionId`
- This ties all their activity together

---

## How This Affects Reporting

### For Unique Users
- **New Chrome user**: Counts as **1 new unique user**
- **Returning Chrome user**: Still counts as the **same unique user** (because their `sessionId` is stored in localStorage)
- **Incognito Chrome user**: Counts as a **brand new unique user** (incognito has separate localStorage)
- **Different Chrome profile**: Counts as a **different unique user** (profiles have separate localStorage)

### For Total Interactions
Every click, every API call, every report submission counts as **1 interaction each**, regardless of whether it's a new or returning user.

---

## Browser-Specific Behavior

| Browser | How Sessions Work |
|---------|-------------------|
| **Chrome** | `sessionId` stored in localStorage; persists across restarts |
| **Firefox** | Same as Chrome |
| **Safari** | Same as Chrome, but Intelligent Tracking Prevention may clear localStorage after 7 days |
| **Edge** | Same as Chrome |
| **Incognito/Private Mode** | `sessionId` not persisted - new session every time |
| **Different Device** | New session, new unique user |

---

## What If the User Clears Chrome Data?

If a user:
- Clears cookies and site data
- Uninstalls/reinstalls Chrome
- Uses a different computer

They will get a **new session ID** and count as a **new unique user** in reporting.

---

## Example: User's First Day in Chrome

| Time | Action | What Happens in Reporting |
|------|--------|---------------------------|
| 9:00 AM | Opens NibBot for first time | +1 unique user, +1 interaction |
| 9:01 AM | Clicks "Account Balance" | +1 interaction |
| 9:05 AM | Submits a support report | +2 interactions (click + report) |
| 2:00 PM | Comes back, clicks "FAQ" | +1 interaction, still same unique user |
| Next day | Clears Chrome data, returns | +1 new unique user, +1 interaction |

---

## Key Takeaways

1. **Chrome (and all modern browsers)** store the session in `localStorage`
2. **Same user, same Chrome profile** = same unique user in reports
3. **Incognito, different profile, different device** = new unique user
4. **Every action** (click, API, report) = 1 interaction
5. **Session ID** is the glue that ties all a user's activity together

This system gives you accurate reporting while respecting user privacy!

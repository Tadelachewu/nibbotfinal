# NibBot Reporting System: All Visits & Unique Visits - Dedicated Test Cases

## Introduction
This document contains test cases specifically for the new visit metrics added to the General Report:
- **All Visits**: Total number of times the app was opened (counts every `session_start` log)
- **Unique Visits**: Distinct user/sessions that visited the app (counts unique `sessionId` from `session_start` logs)

---

## Test Cases

---

### Test Case VIS-001: First-Time New User
**Test ID**: VIS-001
**Objective**: Verify first-time new user counts correctly
**Preconditions**:
- Clear all cookies and site data for NibBot
- No existing session data for the test user
**Steps**:
1. Open Chrome in normal mode
2. Navigate to NibBot URL
3. Do NOT click any menus or perform any actions
4. Open the Reporting Console in another tab
5. Set time range to "Today"
**Expected Results**:
- All Visits: 1
- Unique Visits: 1
- Interactions: 0
- Unique Users: 0
**Screenshot Notes**:
- Capture General Report showing these values

---

### Test Case VIS-002: Returning User - Same Browser, Normal Mode
**Test ID**: VIS-002
**Objective**: Verify returning user counts correctly
**Preconditions**:
- Test Case VIS-001 completed
**Steps**:
1. Close NibBot tab completely
2. Open a new tab, navigate back to NibBot URL
3. Check Reporting Console "Today"
**Expected Results**:
- All Visits: 2
- Unique Visits: 1
- (Interactions/Unique Users remain 0 if no clicks)

---

### Test Case VIS-003: Returning User - Incognito Mode First, Then Normal Mode
**Test ID**: VIS-003
**Objective**: Verify incognito vs normal mode sessions are distinct
**Preconditions**:
- Test Case VIS-002 completed
**Steps**:
1. Open Chrome incognito window
2. Navigate to NibBot URL
3. Check Reporting Console "Today"
**Expected Results**:
- All Visits: 3
- Unique Visits: 2

---

### Test Case VIS-004: Multiple Refreshes - Same Session
**Test ID**: VIS-004
**Objective**: Verify multiple refreshes increment All Visits but not Unique Visits
**Preconditions**:
- Test Case VIS-003 completed
**Steps**:
1. In the same incognito window, refresh NibBot page 5 times
2. Check Reporting Console "Today"
**Expected Results**:
- All Visits: 3 + 5 = 8
- Unique Visits: 2 (unchanged)

---

### Test Case VIS-005: Multiple Different Browsers/Devices
**Test ID**: VIS-005
**Objective**: Verify different browsers/devices count as separate unique visits
**Steps**:
1. Open NibBot in Chrome → counts as 1 visit
2. Open NibBot in Firefox → counts as another
3. Open NibBot in Edge → counts as another
4. Open NibBot on a mobile device (if available) → counts as another
**Expected Results**:
- All Visits: 4
- Unique Visits: 4

---

### Test Case VIS-006: Cleared Cookies
**Test ID**: VIS-006
**Objective**: Verify clearing cookies creates a new unique visit
**Preconditions**:
- Test Case VIS-001 completed (normal Chrome with existing session)
**Steps**:
1. Clear Chrome cookies and site data
2. Open NibBot again in normal mode
3. Check Reporting Console
**Expected Results**:
- All Visits: Previous +1
- Unique Visits: Previous +1

---

### Test Case VIS-007: Time Range Filtering
**Test ID**: VIS-007
**Objective**: Verify visit metrics are time-range filtered correctly
**Steps**:
1. Day 1: Open app 3 times (All Visits:3, Unique:1)
2. Day 2: Open app 2 times (All Visits:2, Unique:1)
3. In Reporting, test "Today", "Week", "Custom" ranges
**Expected Results**:
- "Today": Only shows today's visits
- "Week": Shows total for the week
- "Custom": Shows only visits in selected date range

---

### Test Case VIS-008: Visit and Interact
**Test ID**: VIS-008
**Objective**: Verify visits and interactions are independent but related
**Steps**:
1. Open NibBot (VIS:1, UV:1, INT:0)
2. Click one menu (INT:1, UU:1)
3. Open app again in another window (VIS:2, UV:1)
4. Click another menu (INT:2, UU:1)
**Expected Results**:
- General Report:
  - All Visits: 2
  - Unique Visits:1
  - Interactions:2
  - Unique Users:1

---

### Test Case VIS-009: Multiple Users Simultaneously
**Test ID**: VIS-009
**Objective**: Verify multiple concurrent users count correctly
**Steps**:
1. Open 10 different incognito windows
2. In each, navigate to NibBot
3. Check Reporting Console
**Expected Results**:
- All Visits: 10
- Unique Visits:10

---

### Test Case VIS-010: Session Timeout/Expiry
**Test ID**: VIS-010
**Objective**: Verify session timeout creates new unique visit (if applicable)
**Preconditions**:
- App has session timeout configured (if applicable)
**Steps**:
1. Open app, wait for session to timeout
2. Open app again
**Expected Results**:
- Depends on implementation:
  - If sessionId is preserved: All Visits +1, Unique Visits unchanged
  - If new sessionId is created: All Visits +1, Unique Visits +1

---

## Test Data Templates

### Test Case Execution Template
| Test ID | Test Case Name | Status (Pass/Fail/Blocked) | Notes | Tester | Date |
|---------|----------------|---------------------------|-------|--------|------|
| VIS-001 | First-Time New User | | | | |

## Edge Case Tests

### Edge Case EC-VIS-01: Rapid Successive Opens
**Objective**: Verify app can handle rapid successive opens without miscounting
**Steps**:
1. Open app tabs in quick succession (10 times in 10 seconds)
2. Check counts
**Expected**: All Visits:10, Unique Visits:1

### Edge Case EC-VIS-02: Bot/Crawler Traffic
**Objective**: Verify bot traffic is handled (if filter exists)
**Steps**:
1. Simulate a bot/crawler hitting the NibBot URL
2. Check if visit counts increment
**Expected**:
- Depends on implementation:
  - If bot traffic is filtered: No count change
  - If not filtered: Count increments

### Edge Case EC-VIS-03: Offline/No Network
**Objective**: Verify opening app without network still counts
**Steps**:
1. Disable network connection
2. Open NibBot app
3. Re-enable network
4. Check Reporting Console
**Expected**:
- If `session_start` logs are queued and sent later: Counts increment
- If no log created: Counts unchanged

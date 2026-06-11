# NibBot Reporting System: Test Cases

## 1. General Report Metric Tests

### Test Case 1.1: New User Opening App (No Interactions)
**Test ID: TC-RPT-001
**Objective**: Verify visit counts work correctly for a user who only opens the app and does nothing
**Preconditions**:
- Test user has no existing session cookie
**Steps**:
1. Open NibBot in a new incognito window
2. Do NOT click any menus or perform any actions
3. Go to the Reporting Console
4. Set time range to "Today"
**Expected Results**:
- All Visits: 1
- Unique Visits: 1
- Interactions: 0
- Unique Users: 0
- All other metrics: 0

---

### Test Case 1.2: User Clicks One Menu
**Test ID**: TC-RPT-002
**Objective**: Verify interactions count correctly
**Preconditions**:
- User from TC-RPT-001 completed
**Steps**:
1. In the same incognito window, click one static menu item (e.g., "About Us")
2. Go to the Reporting Console
3. Refresh and set to "Today"
**Expected Results**:
- All Visits: 1
- Unique Visits: 1
- Interactions: 1
- Unique Users: 1
- Successful: 1
- Failed: 0
- Success Rate: 100%

---

### Test Case 1.3: Same User Opens App Multiple Times
**Test ID**: TC-RPT-003
**Objective**: Verify All Visits vs Unique Visits
**Preconditions**:
- TC-RPT-002 completed
**Steps**:
1. Close the incognito window
2. Open a NEW incognito window (or clear cookies)
3. Go to Reporting Console → "Today"
**Expected Results**:
- All Visits: 2
- Unique Visits: 2
- (Previous interaction still counts as 1 interaction from first visit)

---

### Test Case 1.4: API Menu Call Succeeds
**Test ID**: TC-RPT-004
**Objective**: Verify successful API calls count correctly
**Steps**:
1. Open NibBot, click an API menu (e.g., "Check Balance")
2. Wait for API to return successfully
3. Check Reporting Console
**Expected Results**:
- All Visits: +1
- Interactions: +2 (navigation click + API success log)
- Successful: +2
- Failed: 0
- (For Detail Report: API menu shows 2 interactions, 0 errors, average latency recorded

---

### Test Case 1.5: API Menu Call Fails
**Test ID**: TC-RPT-005
**Objective**: Verify failed interactions count correctly
**Steps**:
1. Open NibBot
2. Click an API menu that will fail (e.g., disable API temporarily)
3. Check Reporting Console
**Expected Results**:
- All Visits: +1
- Interactions: +2
- Successful: +1 (initial menu click)
- Failed: +1 (API failure)
- Success Rate: 50%

---

## 2. Detail Report Menu Hierarchy Tests

### Test Case 2.1: Static Menu Clicks
**Test ID**: TC-RPT-201
**Objective**: Verify static menu interactions are correctly grouped
**Steps**:
1. Click 3 different static menu items
2. Check Detail Report → Static Menu section
**Expected Results**:
- Each static menu shows individual counts 1 interaction
- Category total interactions: 3

---

### Test Case 2.2: Submission Analytics
**Test ID**: TC-RPT-202
**Objective**: Verify submission counts are correct
**Steps**:
1. Submit 2 different support report menus
2. Check Detail Report → Internal Support Menu section
**Expected Results**:
- Each report menu shows submissions count: 1
- Total Submissions in General Report: 2
- Status Stats: Pending count: 2

---

## 3. Time Range Filtering Tests

### Test Case 3.1: Today's Data
**Test ID**: TC-RPT-301
**Objective**: Time range "Today" only shows today's data
**Steps**:
1. Perform an interaction yesterday
2. Perform 2 interactions today
3. Check General Report set to "Today"
**Expected Results**:
- Only today's 2 interactions count
- Yesterday's activity is excluded

---

### Test Case 3.2: Week/Month Filtering
**Test ID**: TC-RPT-302
**Objective**: Verify Week/Month ranges include only relevant data
**Steps**:
1. Test Week and Month ranges
2. Check all metrics scale correctly

---

## 4. Export Tests

### Test Case 4.1: Detail Report CSV Export
**Test ID**: TC-RPT-401
**Objective**: Verify export data matches UI
**Steps**:
1. Go to Detail Report
2. Click "Export CSV"
3. Open CSV file
**Expected Results**:
- Category rows with totals
- Menu-level rows
- All metrics match UI

---

### Test Case 4.2: Submission CSV Export
**Test ID**: TC-RPT-402
**Objective**: Verify submissions with escalation path exports
1. Go to Submission Analytics
2. Click "Export CSV"
3. Verify all fields present
**Expected Results**:
- Report ID, timestamp, menu name, user ID
- Status, priority, escalation path, resolved by
- Rating, feedback

---

## 5. Edge Cases

### Test Case 5.1: Menu Deleted After Interaction
**Test ID**: TC-RPT-501
**Objective**: Deleted menu interactions still count
1. Click a menu
2. Delete the menu
3. Check General and Detail Reports
**Expected Results**:
- Interaction still counts in totals
- Detail Report: falls back to type tags for grouping

---

### Test Case 5.2: No Data
**Test ID**: TC-RPT-502
**Objective**: No interactions no errors
1. Choose time range with 0 data
2. Check all tabs
**Expected Results**:
- Metrics: 0
- Empty states no errors
- Empty table no errors
- Charts show empty

# NIB INTERNATIONAL BANK - CHATBOT UAT TESTER GUIDE

## 1. Introduction
This guide is designed for UAT testers to verify the NIBBOT system. It includes Positive (intended use), Negative (error handling), and Boundary (system limits) test cases.

---

## MODULE A: Administrative Access & Security
**Objective**: Verify secure access, rate limiting, and session boundaries.

### Test Case A1: Login & Rate Limiting (Negative/Boundary)
1. **Action**: Open Admin Login. Enter a valid username but incorrect password 5 times.
2. **Expected Result (Negative)**: System displays "Too many attempts". 
3. **Action**: Immediately attempt a 6th login with the correct password.
4. **Expected Result (Boundary)**: Access is still blocked. The system enforces a **15-minute lockout** after 5 failures.
5. **Action**: Attempt to login from a different browser/IP simultaneously.
6. **Expected Result (Security)**: The system tracks failures per-principal and per-IP independently.

### Test Case A2: Session Lifetimes (Boundary)
1. **Action**: Leave the admin panel idle for exactly 14 minutes, then click a button.
2. **Expected Result (Positive)**: Session remains active.
3. **Action**: Wait for another 2 minutes (total 16 minutes idle).
4. **Expected Result (Boundary)**: System redirects to Login. **Idle Limit: 15 Minutes**.
5. **Action**: Log in and stay active for exactly 8 hours.
6. **Expected Result (Boundary)**: Session is terminated. **Absolute Limit: 8 Hours**.

---

## MODULE B: Branding & Image Management
**Objective**: Validate visual identity and file upload constraints.

### Test Case B1: File Uploads (Negative/Boundary)
1. **Action**: Upload a 5MB image file as the App Logo.
2. **Expected Result (Boundary)**: System may lag or reject. **Recommended Limit: < 1MB** for optimal performance.
3. **Action**: Attempt to upload a `.txt` or `.pdf` file in the Logo upload field.
4. **Expected Result (Negative)**: System rejects the file or the browser filter prevents selection.
5. **Action**: Upload a rectangular photo for the **User Avatar**.
6. **Expected Result (Visual Boundary)**: The system MUST force a circular crop (`rounded-full`). Verify no "square" edges are visible.

---

## MODULE C: Menu Management (Maker-Checker)
**Objective**: Test the content lifecycle, role restrictions, and form validations.

### Test Case C1: Self-Approval & Role Access (Negative)
1. **Action**: As `Admin_Maker`, create a menu and navigate to the Approvals tab.
2. **Expected Result (Negative)**: The "Approve" button for your own change is disabled. **Rule: Maker cannot be Checker**.
3. **Action**: Log in as a `Support` user and attempt to access the Menu Management page.
4. **Expected Result (Negative)**: Access denied or page hidden. **Rule: Support role cannot manage menus**.

### Test Case C2: Rejection Requirements (Negative)
1. **Action**: As a `Checker`, click **Reject** on a pending menu but leave the "Reason" field empty.
2. **Expected Result (Negative)**: System prevents submission and displays "Rejection reason is required".

---

## MODULE D: API Integration & Data Mapping
**Objective**: Verify data connectivity, template accuracy, and payload limits.

### Test Case D1: Template & Placeholder (Negative)
1. **Action**: In an API menu, enter an endpoint with a typo: `/api/data/{{accout_id}}` (missing 'n').
2. **Action**: Click **Save**.
3. **Expected Result (Negative)**: System displays "Missing KYC fields: accout_id". **Rule: All placeholders must match KYC field names**.
4. **Action**: Enter a placeholder for a non-existent system variable: `{{user.session_id}}`.
5. **Expected Result (Negative)**: System rejects the template as invalid.

### Test Case D2: Payload & Table Limits (Boundary)
1. **Action**: Configure an API to return 1,000 rows of data.
2. **Expected Result (Boundary)**: The chat interface renders the table but stops at exactly **500 rows**.
3. **Action**: Return a JSON response with a depth of 10 nested objects.
4. **Expected Result (Boundary)**: Verify the `Root Mapping Key` (e.g., `data.level1.level2`) can reach the data.

---

## MODULE E: User Chat Experience & Localization
**Objective**: Validate end-user journey and content display limits.

### Test Case E1: Content Pagination (Boundary)
1. **Action**: Paste 10,000 characters of text into a menu's content.
2. **Expected Result (Boundary)**: The bot sends 5 separate bubbles. **Limit: 2,000 characters per bubble**.
3. **Action**: Enter 25,000 characters.
4. **Expected Result (Boundary)**: System may truncate. **System Max: 20,000 characters**.

### Test Case E2: Language Fallback (Negative)
1. **Action**: Switch language to Amharic. Trigger a menu where Amharic content is empty.
2. **Expected Result (Negative/Fallback)**: System displays English content. **Rule: English is the universal fallback**.

---

## MODULE F: Audit Logs & Submissions
**Objective**: Verify compliance, masking, and tracking.

### Test Case F1: Data Masking (Security Negative)
1. **Action**: Perform a login and then view the logs in the Admin Panel.
2. **Expected Result (Security)**: The password field in the log MUST show `********`.
3. **Action**: Perform an API call that includes a `token` in the response.
4. **Expected Result (Security)**: Verify the `InteractionLog` masks the token value.

### Test Case F2: Report ID & Submission (Boundary)
1. **Action**: Submit 10 reports in a row.
2. **Expected Result (Positive)**: Each ID increments correctly (e.g., `...-000101`, `...-000102`).
3. **Action**: Set the Report ID prefix to 20 characters.
4. **Expected Result (Boundary)**: Verify the ID does not break the chat bubble layout.

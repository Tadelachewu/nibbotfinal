# NIB INTERNATIONAL BANK - CHATBOT UAT TESTER GUIDE

## 1. Introduction
This guide is designed for UAT testers to verify the NIBBOT system. It includes Positive (intended use), Negative (error handling), and Boundary (system limits) test cases.

---

## 2. Global Visual & Branding Standards
### 2.1 Corporate Logo
- **Responsiveness**: Displays in Chat Header, Welcome Screen, and Admin Login.
- **Aspect Ratio**: Rectangular logos are supported using `object-contain`.
- **Emphasis**: Uses `drop-shadow-md` and 105% hover scaling.

### 2.2 Avatars (Bot & User)
- **Shape**: **Strictly Circular** for both Bot and User.
- **Rendering**: Rendered as `rounded-full` using `object-cover` to ensure images fill the circle without distortion.

### 2.3 Color Scheme
- **Primary Color (Yellow Honey)**: `#f4a61b`. Used for header/footer backgrounds and primary buttons.
- **Secondary Color (Brown)**: `#763717`. Used for text and icons in high-contrast areas.
- **Header/Footer**: The chat interface header and footer are themed in Yellow Honey with Brown text/icons.

---

## MODULE A: Administrative Access & Security
**Objective**: Verify secure access, rate limiting, and session boundaries.

### Test Case A1: Login & Rate Limiting (Negative/Boundary)
1. **Action**: Open Admin Login. Enter a valid username but incorrect password 5 times.
2. **Expected Result (Negative)**: System displays "Too many attempts". 
3. **Action**: Immediately attempt a 6th login with the correct password.
4. **Expected Result (Boundary)**: Access is still blocked. The system enforces a **15-minute lockout** after 5 failures.

### Test Case A2: Session Lifetimes (Boundary)
1. **Action**: Leave the admin panel idle for 16 minutes.
2. **Expected Result (Boundary)**: System redirects to Login. **Idle Limit: 15 Minutes**.
3. **Action**: Log in and stay active for exactly 8 hours.
4. **Expected Result (Boundary)**: Session is terminated. **Absolute Limit: 8 Hours**.

---

## MODULE B: Branding & Image Management
**Objective**: Validate visual identity and file upload constraints.

### Test Case B1: File Uploads (Negative/Boundary)
1. **Action**: Upload a 5MB image file as the App Logo.
2. **Expected Result (Boundary)**: System may lag or reject. **Recommended Limit: < 1MB**.
3. **Action**: Upload a rectangular photo for any Avatar.
4. **Expected Result (Visual Boundary)**: The system MUST force a circular crop (`rounded-full`).

---

## MODULE C: Menu Management (Maker-Checker)
**Objective**: Test the content lifecycle, role restrictions, and form validations.

### Test Case C1: Self-Approval & Role Access (Negative)
1. **Action**: As `Admin_Maker`, create a menu and attempt to approve it.
2. **Expected Result (Negative)**: The "Approve" button is disabled. **Rule: Maker cannot be Checker**.

### Test Case C2: Rejection Requirements (Negative)
1. **Action**: As a `Checker`, click **Reject** on a pending menu but leave the "Reason" field empty.
2. **Expected Result (Negative)**: System prevents submission; displays "Rejection reason is required".

---

## MODULE D: API Integration & Data Mapping
**Objective**: Verify data connectivity and payload limits.

### Test Case D1: Template & Placeholder (Negative)
1. **Action**: In an API menu, enter a typo placeholder: `/api/data/{{accout_id}}`.
2. **Expected Result (Negative)**: System displays "Missing KYC fields: accout_id".

### Test Case D2: Payload & Table Limits (Boundary)
1. **Action**: Configure an API to return 1,000 rows of data.
2. **Expected Result (Boundary)**: The chat interface renders the table but stops at exactly **500 rows**.

---

## MODULE E: User Chat Experience & Localization
**Objective**: Validate end-user journey and content display limits.

### Test Case E1: Content Pagination (Boundary)
1. **Action**: Paste 10,000 characters of text into a menu's content.
2. **Expected Result (Boundary)**: The bot sends 5 separate bubbles. **Limit: 2,000 characters per bubble**.

### Test Case E2: Language Fallback (Negative)
1. **Action**: Switch language to Amharic. Trigger a menu where Amharic content is empty.
2. **Expected Result (Negative/Fallback)**: System displays English content.

---

## MODULE F: Audit Logs & Submissions
**Objective**: Verify compliance, masking, and tracking.

### Test Case F1: Data Masking (Security Negative)
1. **Action**: View logs in the Admin Panel after a login attempt.
2. **Expected Result (Security)**: The password field MUST show `********`.

### Test Case F2: Report ID & Submission (Boundary)
1. **Action**: Submit a support report.
2. **Expected Result (Positive)**: System generates an ID (e.g., `NIB-2026-XXXXXX`).

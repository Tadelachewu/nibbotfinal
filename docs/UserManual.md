# User Manual

**Application Name:** Nibbot  
**Document Version:** 1.0  
**Audience:** End Users & System Administrators  
**Classification:** Internal  

---

## Table of Contents

1. [Introduction and Overview](#1-introduction-and-overview)
2. [Getting Started](#2-getting-started)
3. [Main Functions and Features](#3-main-functions-and-features)
4. [Troubleshooting and FAQs](#4-troubleshooting-and-faqs)
5. [Safety, Security, and Good Practice](#5-safety-security-and-good-practice)
6. [Support and Contacts](#6-support-and-contacts)

---

## 1. Introduction and Overview

### 1.1 What is Nibbot?

Nibbot is an interactive conversational bot platform that allows you to access banking services, submit inquiries, and get information through a simple chat interface. Instead of navigating complex forms or making phone calls, you interact with a guided menu-based chat that walks you through each step.

### 1.2 Who Is This Manual For?

This manual is designed for two audiences:

- **End Users** — Customers who use the chat interface to browse services, submit data, and track support tickets.
- **Administrators** — Staff members who manage the system configuration, handle support tickets, and monitor system health.

### 1.3 Key Features at a Glance

| Feature | Description |
|:---|:---|
| **Interactive Chat** | Navigate services through a structured, menu-based conversation |
| **Data Collection** | Securely submit required information through guided form prompts |
| **Report Tracking** | Submit support requests and track them using a unique reference number |
| **Multi-Language** | Switch between supported languages (e.g., English, Amharic) |
| **Admin Dashboard** | View real-time system metrics, manage menus, users, and reports |
| **Dark/Light Theme** | Toggle between display themes for comfortable viewing |

---

## 2. Getting Started

### 2.1 System Requirements

To use Nibbot, you need:

- A modern web browser (Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari)
- A stable internet connection
- JavaScript must be enabled in your browser

### 2.2 Accessing the Application

**For End Users:**
Open your web browser and navigate to the Nibbot application URL provided by your organization. The chat interface loads automatically on the home page.

**For Administrators:**
Navigate to the same URL and click the **Admin Panel** icon (gear icon) located in the chat header, or go directly to `/admin` in the URL bar.

### 2.3 First-Time Setup (Administrators Only)

When the system is accessed for the first time, an initial administrator account is created automatically using the credentials configured in the system environment. If running locally, the default credentials are:

| Field | Default Value |
|:---|:---|
| **Username** | `admin` |
| **Password** | `Admin@1234` |

> **Important:** Change the default password immediately after your first login via the **Change Password** option.

### 2.4 Logging In (Administrators)

1. Navigate to the Admin Panel (`/admin`).
2. Enter your **Username** and **Password** in the login form.
3. Click **Sign In**.
4. Upon successful login, you will be directed to the Admin Dashboard.

### 2.5 Logging Out (Administrators)

1. Click the **Logout** button in the admin panel header.
2. Your session will be terminated and you will be redirected to the login page.
3. Your session also expires automatically after 15 minutes of inactivity for security purposes.

---

## 3. Main Functions and Features

### 3.1 End-User Functions

#### 3.1.1 Browsing Menus

1. When you open the chat, the bot displays a **welcome message** with available menu options as clickable buttons.
2. Click on any menu button to explore that category.
3. Sub-menus will appear if the selected item has child options.
4. If more than 12 options are available, use the **Prev/Next** pagination buttons to navigate between pages.

#### 3.1.2 Viewing Static Content

When you select a menu item configured with static content:
1. The bot displays the information directly in the chat as formatted text.
2. This may include text, images, tables, and links created by the administrator using a rich-text editor.

#### 3.1.3 Submitting Data (KYC Forms)

Some menu items require you to provide information before proceeding:

1. The bot will prompt you with a question (e.g., "Please enter your account number").
2. Type your answer in the text input field at the bottom of the chat.
3. Press **Enter** or click the **Send** button.
4. The bot validates your input:
   - **Phone numbers** must follow Ethiopian format (e.g., `0911...` or `+251...`)
   - **Email addresses** must contain a valid `@` domain
   - **Numbers** must be valid numeric values
   - **Boolean fields** accept `true` or `false`
5. If a field is optional, you may skip it. If it is required, you must provide a valid answer to continue.
6. After all fields are completed, the bot processes your request.

#### 3.1.4 Viewing API Results

When a menu is connected to an external data source:
1. After completing the required data inputs, the bot connects to the configured service.
2. Results are displayed as a **formatted data table** within the chat.
3. You can scroll horizontally if the table has many columns.

#### 3.1.5 Submitting a Support Report

For report-type menus:
1. Complete the required data input prompts.
2. The bot submits your report and displays a **confirmation message**.
3. You receive a unique **Report Reference Number** (e.g., `NIB-2026-100001`).
4. Save this number to check your report status later.

#### 3.1.6 Checking Report Status

1. Select the **Check Report Status** menu option (if available).
2. Enter your Report Reference Number when prompted.
3. The bot displays your report details including:
   - Current status (Pending, Reviewed, or Resolved)
   - Priority level
   - Any response from the support team

#### 3.1.7 Changing Language

1. Click the **Globe** icon in the chat header.
2. Select your preferred language from the dropdown menu.
3. The interface and bot messages will switch to the selected language immediately.

#### 3.1.8 Switching Theme (Dark/Light Mode)

1. Click the **Theme Toggle** button in the chat header.
2. The display switches between Light Mode and Dark Mode.

#### 3.1.9 Navigating Back

- Click the **Back Arrow** (←) button in the chat header to return to the previous menu level.
- Click the **Home** icon to return to the main menu at any time.

---

### 3.2 Administrator Functions

#### 3.2.1 Dashboard Overview

After logging in, the Dashboard displays:

| Card | Description |
|:---|:---|
| **Online Now** | Number of users currently active on the chat (live, real-time) |
| **Total Bot Users** | Total unique sessions recorded |
| **Pending Tasks** | Number of reports awaiting attention |
| **Urgent Triage** | Count of high-priority and urgent reports |
| **Resolved** | Total completed report cases |

The Dashboard also includes:
- **Submission Lifecycle Chart** — Pie chart showing Pending vs. Reviewed vs. Resolved reports.
- **Priority Breakdown Chart** — Bar chart of reports by priority (Urgent, High, Medium, Low).
- **Top Interactions Chart** — Bar chart comparing total clicks vs. unique session reach per menu item.
- **Menu Complexity Chart** — Breakdown of Static, API, and Report menu types.

#### 3.2.2 Managing Menus

**Creating a New Menu Item:**
1. Navigate to the **Menus** tab in the admin panel.
2. Click **Add Menu**.
3. Fill in the required fields:
   - **Name** — Display name in the chat (English)
   - **Name (Amharic)** — Optional Amharic translation
   - **Response Type** — Choose `Static`, `API`, or `Report`
   - **Parent Menu** — Select a parent to create a sub-menu, or leave empty for a top-level item
   - **Order** — Numeric position in the menu list
4. Depending on the response type:
   - *Static:* Enter content in the rich-text editor (supports bold, links, images, tables)
   - *API:* Configure the endpoint URL, request parameters, KYC fields, and response mapping
   - *Report:* Configure KYC fields for the data collection form
5. Click **Save**. The menu will be created with a `Pending` approval status.

**Editing a Menu Item:**
1. Click on the menu item you wish to edit.
2. Modify the desired fields.
3. Click **Save**. If the menu was already approved, your changes are saved as a **pending update** requiring re-approval.

**Deleting a Menu Item:**
1. Select the menu item.
2. Click **Delete** and confirm the action.
3. Only users with the `Admin` role can delete menus.

> **Note:** All new menus and updates to approved menus require approval from a **Checker** before becoming visible to end users. This is the **Maker-Checker** governance process.

#### 3.2.3 Approving or Rejecting Menus (Checker Role)

1. Log in with a **Checker** account.
2. Navigate to the **Menus** tab.
3. Pending items are highlighted with a `Pending` status badge.
4. Review the menu configuration.
5. Click **Approve** to make it live, or **Reject** and provide a reason.

> **Important:** You cannot approve a menu that you created yourself. A different Checker or Admin must review it.

#### 3.2.4 Managing Reports

1. Navigate to the **Reports** tab.
2. View all submitted reports (Admins see all; Support users see only their assigned reports).
3. For each report, you can:
   - Change the **Status** (Pending → Reviewed → Resolved)
   - Update the **Priority** (Admin only)
   - Add an **Admin Response** visible to the system
   - Add **Internal Notes** for staff-only reference
   - **Assign** or **Escalate** to a Support user (Admin only, requires a reason)
4. Click **Save** to apply changes. All changes are logged in the report's activity history.

#### 3.2.5 Managing Admin Users

1. Navigate to the **Users** tab (Admin role only).
2. To **create** a new user:
   - Enter Username, Email, Password, and select a Role (`Admin`, `Checker`, or `Support`).
   - Optionally assign a Group Name.
   - Password must meet strength requirements (minimum 8 characters, must include uppercase, lowercase, number, and special character).
3. To **edit** an existing user: Click the user row and modify the desired fields.
4. To **delete** a user: Click Delete. You cannot delete your own account or the last remaining Admin account.

#### 3.2.6 Configuring Application Settings

1. Navigate to the **Settings** tab.
2. Available settings include:
   - **Supported Languages** — Add or remove languages available in the chat
   - **System Translations** — Customize UI text for each language
   - **Bot & User Avatars** — Set text-based or image-based avatars for the chat
   - **App Logo** — Upload a custom logo displayed in the chat header
   - **Report ID Configuration** — Customize the prefix (e.g., `NIB`), year format, number length, and starting value for report reference numbers
   - **Admin Panel Icon** — Show or hide the admin panel gear icon in the chat

#### 3.2.7 Viewing Interaction Logs

1. Navigate to the **Logs** tab.
2. View the most recent 500 interaction records including:
   - Timestamp, session ID, user message, bot response
   - Status (success, failed, error)
   - Response time and endpoint details
3. Sensitive data (passwords, tokens, PINs) is automatically masked in all log entries.

#### 3.2.8 Changing Your Password

1. Navigate to the **Change Password** section in the admin panel.
2. Enter your current password.
3. Enter and confirm your new password.
4. Click **Save**. Your new password must meet the strength requirements.

#### 3.2.9 Password Recovery

If you forget your admin password:
1. On the login page, click **Forgot Password**.
2. Enter the email address associated with your admin account.
3. Check your email for a password reset link.
4. Click the link and enter a new password.
5. The reset link expires after 1 hour and can only be used once.

---

## 4. Troubleshooting and FAQs

### 4.1 Common Issues

| Problem | Possible Cause | Solution |
|:---|:---|:---|
| Chat shows no menu options | Menus have not been configured or all are inactive | Contact your administrator to set up menus |
| "Invalid input" error when typing | Your input does not match the expected format | Check the field type (phone, email, number) and re-enter correctly |
| Admin login fails | Incorrect credentials or expired session | Re-enter your username and password. If forgotten, use Password Recovery |
| Dashboard shows "Online Now: 0" | Redis is not configured or unavailable | The presence feature requires Redis. Contact your system administrator |
| Menu changes not visible to users | Changes are pending approval | A Checker must approve the menu before it goes live |
| "Forbidden" error on admin actions | CSRF token expired or session timed out | Log out and log back in to refresh your session |
| Report submission fails | Network error or server unavailable | Check your internet connection and try again |

### 4.2 Frequently Asked Questions

**Q: How do I find my report status?**  
A: Use the "Check Report Status" option in the chat menu and enter your reference number (e.g., `NIB-2026-100001`).

**Q: Can I use Nibbot on my mobile phone?**  
A: Yes. Nibbot works in any modern mobile browser. There is no separate mobile app at this time.

**Q: What languages are supported?**  
A: The system supports multiple languages configured by the administrator. English and Amharic are the primary languages.

**Q: How long does my admin session last?**  
A: Your session expires after 15 minutes of inactivity. You will need to log in again after expiry.

**Q: Can I export reports?**  
A: Report export functionality is not explicitly available in the current version. Reports can be viewed and managed through the admin dashboard.

**Q: Who can approve menu changes?**  
A: Only users with the **Checker** role can approve or reject menus. The person who created the menu cannot approve their own changes.

---

## 5. Safety, Security, and Good Practice

### 5.1 Password Guidelines

- Use a strong password with at least 8 characters including uppercase, lowercase, numbers, and special characters.
- Never share your password with anyone.
- Change your password regularly and immediately if you suspect unauthorized access.
- Do not reuse passwords across different systems.

### 5.2 Session Security

- Always **log out** when you finish using the admin panel, especially on shared computers.
- Your session expires automatically after 15 minutes of inactivity.
- The system uses encrypted, HTTP-only cookies that cannot be accessed by scripts on the page.

### 5.3 Data Protection

- Sensitive information (passwords, tokens, PINs) entered in the chat is automatically masked in system logs.
- All admin actions require CSRF token validation to prevent unauthorized requests.
- The system enforces Content Security Policy headers to protect against cross-site scripting attacks.

### 5.4 Best Practices for Administrators

- **Review menus carefully** before approving — incorrect API configurations may display errors to end users.
- **Assign support tickets promptly** — pending reports should be triaged and assigned to the appropriate support staff.
- **Monitor the Dashboard regularly** — pay attention to urgent reports and high-priority items.
- **Keep user accounts updated** — remove or deactivate accounts for staff who no longer need access.
- **Use descriptive menu names** — clear, concise names help end users navigate the system efficiently.

---

## 6. Support and Contacts

### 6.1 Technical Support

For technical issues with the Nibbot platform, contact your organization's IT support team.

| Contact Method | Details |
|:---|:---|
| **Internal IT Help Desk** | Contact your organization's IT department |
| **System Administrator** | The designated admin user for your Nibbot deployment |
| **Email Support** | Use the email address configured in your organization's SMTP settings |

### 6.2 Reporting Issues

When reporting an issue, please include:
- A clear description of the problem
- The steps you took before the error occurred
- Any error messages displayed
- Your browser name and version
- The date and time the issue occurred

### 6.3 Document Control

| Attribute | Detail |
|:---|:---|
| **Document Title** | Nibbot User Manual |
| **Version** | 1.0 |
| **Status** | Released |
| **Prepared By** | *(To be completed)* |
| **Reviewed By** | *(To be completed)* |
| **Approved By** | *(To be completed)* |

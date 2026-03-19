# TalkTree - Conversational Menu System

TalkTree is a dynamic, chatbot-driven menu management system built with Next.js, ShadCN, and Genkit.

## 🚀 Deployment (Git Instructions)

To push this project to your repository, run the following commands in your terminal:

```bash
git remote add origin https://github.com/Tadelachewu/nibbotfinal.git
git branch -M main
git push -u origin main
```

---

## 🛡️ Strict Mapping Protocol
To ensure data is fetched correctly, this app uses a **Strict Root Mapping** standard.

1.  **Define Root Key**: In the Admin Panel, set the **Root Mapping Key** (e.g., `data`).
2.  **Explicit Placeholders**: Always use the root key prefix in your templates: `{{data.your_field}}`.
3.  **Table Keys**: Ensure your **Table Data Key** aligns with the response structure from that root.

---

## 🛠 API Scenario Testing Guide

### 1. Account Balance (Secure Bearer)
*   **Endpoint**: `/api/test/balance`
*   **Method**: `GET`
*   **Root Key**: `data`
*   **Auth Type**: `Bearer Token`. Template: `Bearer {{user_token}}`.
*   **KYC Needed**: Add a field `account_id` (e.g., 88991122).
*   **Response View (Message)**:
    *   **Template**: `Your {{data.data.account_type}} balance for account {{account_id}} is {{data.data.balance}} {{data.data.currency}}.`

### 2. Product Catalog (Basic Auth)
*   **Endpoint**: `/api/test/products`
*   **Method**: `GET`
*   **Root Key**: `data`
*   **Auth Type**: `Basic Auth`. User: `admin`, Pass: `1234`.
*   **KYC Needed**: Add field `category`.
*   **Response View (Table)**:
    *   **Table Data Key**: `data`
    *   **Columns**: `name`, `category`

---

## 🔍 Troubleshooting API Errors

1.  **Non-JSON Response**: This usually means the endpoint URL is wrong or the server returned an error page (HTML). Check your `{{placeholders}}` in the URL.
2.  **Missing or Insufficient Permissions**: Check your **Authorization** headers. Ensure the token template has the correct spacing: `Bearer {{user_token}}`.
3.  **Empty Bubbles**: This happens when the API response doesn't contain the fields mapped in your template. Use the **Live Preview** in Admin to verify paths.


# TalkTree - Conversational Menu System

TalkTree is a dynamic, chatbot-driven menu management system built with Next.js, ShadCN, and Genkit. It allows administrators to build conversational trees that integrate with external APIs using flexible authentication and KYC collection.

## 🚀 Deployment (Git Instructions)

To push this project to your repository, run the following commands in your terminal:

```bash
git remote add origin https://github.com/Tadelachewu/nibbotfinal.git
git branch -M main
git push -u origin main
```

---

## 🛠 API Scenario Testing Guide

The system includes several mock APIs to test different integration patterns. Follow these steps in the **Admin Panel** to verify each one:

### 1. Order History (API Key Auth)
*   **Endpoint**: `/api/test/orders`
*   **Method**: `GET`
*   **Auth Type**: `API Key`. Header: `x-api-key`. Value: `mysecretapikey123`.
*   **Request Mapping**: Param Key: `limit` -> Source: `Static` -> Value: `2`.
*   **Response View (Table)**:
    *   **Table Data Key**: `data`
    *   **Columns**: `id`, `total`

### 2. User Secure Transactions (Bearer Auth + Path Parameter)
*   **Endpoint**: `/api/test/user-transactions/{{userId}}`
*   **Method**: `GET`
*   **Auth Type**: `Bearer Token`. Template: `Bearer mysecrettoken123`.
*   **KYC Needed**: Add a KYC field with key `userId` (e.g., user_123).
*   **Request Mapping**: Path Template uses `{{userId}}`. 
*   **Response View (Table)**:
    *   **Table Data Key**: `data.transactions`
    *   **Columns**: `id`, `amount`, `status`, `response.data.userId`

### 3. Product Catalog (Basic Auth)
*   **Endpoint**: `/api/test/products`
*   **Method**: `GET`
*   **Auth Type**: `Basic Auth`. User: `admin`, Pass: `1234`.
*   **KYC Needed**: Add a KYC field with key `category`.
*   **Request Mapping**: Param Key: `category` -> Source: `KYC: category`.
*   **Response View (Message)**: 
    *   **Template**: `Found {{response.data.length}} products for your query "{{category}}".`
*   **Response View (Table)**:
    *   **Table Data Key**: `data`
    *   **Columns**: `name`, `category`

### 4. General Transactions (Bearer + Multi-Parameter)
*   **Endpoint**: `/api/test/transactions`
*   **Method**: `GET`
*   **Auth Type**: `Bearer Token`. Template: `Bearer talktree_static_token_778899`.
*   **KYC Needed**: Add field `account_id`.
*   **Request Mapping**: 
    *   `account_id` -> `KYC: account_id`
    *   `limit` -> `Static: 5`
*   **Response View (Table)**:
    *   **Table Data Key**: `transactions`
    *   **Columns**: `id`, `date`, `amount`, `status`

### 5. Profile Lookup (Path Parameter)
*   **Endpoint**: `/api/test/profile/{{account_id}}`
*   **Method**: `GET`
*   **Auth Type**: `Bearer Token`. Template: `Bearer {{user_token}}`.
*   **KYC Needed**: Add field `account_id`.
*   **Response View (Message)**:
    *   **Template**: `Profile: {{response.data.full_name}} ({{response.data.email}})`

### 6. Exchange Rates (API Key + Static Params)
*   **Endpoint**: `/api/test/exchange-rate`
*   **Method**: `GET`
*   **Auth Type**: `API Key`. Header: `X-API-KEY`. Value: `secret-123`.
*   **Request Mapping**: `base` -> `Static: USD`.
*   **Response View (Table)**:
    *   **Table Data Key**: `rates`
    *   **Columns**: `currency`, `rate`, `updated`

### 7. Account Balance (Bearer Auth + Query Parameter)
*   **Endpoint**: `/api/test/balance`
*   **Method**: `GET`
*   **Auth Type**: `Bearer Token`. Template: `Bearer {{user_token}}`.
*   **KYC Needed**: Add a KYC field with key `account_id` (e.g., 88991122).
*   **Request Mapping**: Param Key: `account_id` -> Source: `KYC: account_id`.
*   **Response View (Message)**:
    *   **Template**: `Your {{response.data.account_type}} balance for account {{account_id}} is {{response.data.balance}} {{response.data.currency}}.`

---

## 🔍 Troubleshooting API Errors

If your bot displays an "Error Template" message or placeholders like `{{response.data.balance}}` don't resolve:

1.  **Auth Token Space**: Ensure your Bearer template is exactly `Bearer {{user_token}}` (including the space after Bearer).
2.  **Request Mapping**: Ensure you have mapped the correct KYC fields to the API Parameters in the Admin Panel.
3.  **Live Preview**: Use the "Live Preview" button in the Admin Panel to see the raw JSON response. If the JSON shows `status: "error"`, your mapping will fail.
4.  **Table Data Key**: If using a table, ensure the **Table Data Key** matches the path in your JSON (e.g., `data.transactions`).

---

## 🌍 Localization
The system supports English and Amharic by default. 
*   **Menu Labels**: Translated labels appear as buttons in chat.
*   **Response Templates**: Success and error messages can be fully localized.
*   **Table Headers**: Use the "Table" tab in Response View Mapping to provide localized column titles for each language.

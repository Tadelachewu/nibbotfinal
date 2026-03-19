# TalkTree - Conversational Menu System

TalkTree is a dynamic, chatbot-driven menu management system built with Next.js, ShadCN, and Genkit. It allows administrators to build conversational trees that integrate with external APIs using flexible authentication and KYC collection.

## 🚀 Getting Started

1.  **Admin Panel** (`/admin`): Define your menu structure, configure API endpoints, and set up localization (Amharic/English).
2.  **User Chat** (`/`): Interact with the chatbot. The bot automatically handles KYC collection based on your API configurations.

---

## 📦 Deployment (Git Instructions)

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
*   **Auth Type**: `API Key`. Header: `x-api-key`. Value: `mysecretapikey123`.
*   **Request Mapping**: Param Key: `limit` -> Source: `Static` -> Value: `2`.
*   **Response View (Table)**:
    *   **Table Data Key**: `data`
    *   **Columns**: `id`, `total`

### 2. User Secure Transactions (Bearer Auth + Path Parameter)
*   **Endpoint**: `/api/test/user-transactions/{{user_id}}`
*   **Auth Type**: `Bearer Token`. Template: `Bearer mysecrettoken123`.
*   **KYC Needed**: Add a KYC field with key `status` (e.g., success, pending).
*   **Request Mapping**: Param Key: `status` -> Source: `KYC: status`.
*   **Response View (Table)**:
    *   **Table Data Key**: `data.transactions`
    *   **Columns**: `id`, `amount`, `status`

### 3. Product Catalog (Basic Auth) - Table & Message Guide
*   **Endpoint**: `/api/test/products`
*   **Auth Type**: `Basic Auth`. User: `admin`, Pass: `1234`.
*   **KYC Needed**: Add a KYC field with key `category`.
*   **Request Mapping**: Param Key: `category` -> Source: `KYC: category`.
*   **Response View (Message)**: 
    *   **Template**: `Found {{response.data.length}} products for your query "{{category}}".`
*   **Response View (Table)**:
    *   **Table Data Key**: `data`
    *   **Columns**: `name`, `category`, `response.success`

### 4. Inventory Lookup (API Key + Filtering)
*   **Endpoint**: `/api/test/inventory`
*   **Auth Type**: `API Key`. Header: `x-api-key`. Value: `mysecretapikey123`.
*   **KYC Needed**: Add field `category`.
*   **Request Mapping**: `category` -> `KYC: category`, `limit` -> `Static: 5`.
*   **Response View (Table)**:
    *   **Table Data Key**: `data`
    *   **Columns**: `name`, `category`

---

## 🌍 Localization
The system supports English and Amharic by default. 
*   **Menu Labels**: Translated labels appear as buttons in chat.
*   **Response Templates**: Success and error messages can be fully localized.
*   **Table Headers**: Use the "Table" tab in Response View Mapping to provide localized column titles.

## 🔑 System Variables & Root-to-Key Mapping
The following placeholders are available in templates and table keys:
*   `{{user_id}}`: Resolves to the current session user ID.
*   `{{user_token}}`: Resolves to the static system token.
*   `{{response.path.to.key}}`: Accesses any value from the JSON response root.
*   `{{kyc_field_name}}`: Accesses any data collected from the user in the current flow.

## 🪄 Pro-Tips for Admin
*   **Magic Wand**: Use the Magic Wand icon next to "Table Data Key" or "Columns" to automatically pick fields from your Live Preview data.
*   **Root Fallback**: If a column key is not found in a table row, the system automatically checks the root `response` object using the `response.` prefix.
*   **Custom Headers**: Configure custom headers like `Content-Type` or `X-App-ID` in the Connectivity section.

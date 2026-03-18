# TalkTree - Conversational Menu System

TalkTree is a dynamic, chatbot-driven menu management system built with Next.js, ShadCN, and Genkit. It allows administrators to build conversational trees that integrate with external APIs using flexible authentication and KYC collection.

## 🚀 Getting Started

1.  **Admin Panel** (`/admin`): Define your menu structure, configure API endpoints, and set up localization (Amharic/English).
2.  **User Chat** (`/`): Interact with the chatbot. The bot automatically handles KYC collection based on your API configurations.

---

## 🛠 API Scenario Testing Guide

The system includes several mock APIs to test different integration patterns. Follow these steps in the **Admin Panel** to verify each one:

### 1. Exchange Rates (Header-based API Key + Query Param)
*   **Goal**: Test combining API Key validation and Request Parameter mapping.
*   **Configuration**:
    *   **Endpoint**: `/api/test/exchange-rate`
    *   **Auth Type**: `API Key`. Header: `X-API-KEY`. Value: `secret-123`.
    *   **Request Mapping**: Param Key: `base` -> Source: `Static` -> Value: `USD`.
*   **Chat Interaction**: Click "Exchange Rates". If configured correctly, it returns a table of rates. If the `base` parameter is missing, the API returns a 400 error.

### 2. Profile Lookup (Dynamic Path Parameter)
*   **Goal**: Test injecting user-provided values directly into the URL path.
*   **Configuration**:
    *   **Endpoint**: `/api/test/profile/{{account_id}}`
    *   **KYC Needed**: Add a KYC field with key `account_id`.
    *   **Auth**: `Bearer Token`. Template: `Bearer {{user_token}}`.
*   **Chat Interaction**: The bot will ask for your ID. Enter `user_123` to see the profile result.

### 3. Transactions (Multi-Parameter Query)
*   **Goal**: Test sending multiple variables (KYC + Static) as query parameters.
*   **Configuration**:
    *   **Endpoint**: `/api/test/transactions`
    *   **Request Mapping**: 
        *   `account_id` -> Source: `KYC: account_id`
        *   `limit` -> Source: `Static: 3`
    *   **Response View**: Set to **Table**.
*   **Chat Interaction**: The bot asks for your account ID (try `88991122`). It returns exactly 3 transactions.

### 4. Multi-KYC Secure Action (Custom Header Logic)
*   **Goal**: Test complex header construction using multiple KYC segments.
*   **Configuration**:
    *   **Endpoint**: `/api/test/multi-kyc`
    *   **KYC Fields**: `account` and `code`.
    *   **Auth**: `Bearer Token`. Template: `Bearer {{user_token}}.{{account}}.{{code}}`.
*   **Chat Interaction**:
    1.  Enter Account: `12345`.
    2.  Enter Code: `9988`.
    3.  **Result**: Returns the balance. Try `67890` / `1122` to see a "Suspended" account error.

### 5. Basic Auth (Fixed vs. Dynamic)
*   **Goal**: Test standard username/password authentication.
*   **Fixed Mode**: Uses `admin` : `password123`.
*   **Dynamic Mode**: Uses KYC fields to source credentials from the chat input (try `TEST_USER` : `TEST_PASS`).

---

## 🌍 Localization
The system supports English and Amharic by default. 
*   **Menu Labels**: Translated labels appear as buttons in chat.
*   **Response Templates**: Success and error messages can be fully localized.
*   **Table Headers**: Use the "Table" tab in Response View Mapping to provide localized column titles.

## 🔑 System Variables
The following system-level placeholders are always available for use in URLs, Headers, and Parameters:
*   `{{user_id}}`: Resolves to `user_123`.
*   `{{user_token}}`: Resolves to `talktree_static_token_778899`.

---

## 🪄 Pro-Tips for Admin
*   **Live Preview**: Always click the "Live Preview" button after configuring an API to see the raw JSON response.
*   **Magic Wand**: Use the Magic Wand icon next to "Data Keys" or "Templates" to automatically pick fields from your Live Preview data.
*   **Attach Related**: Use the "Attach Related Menus" section at the bottom to suggest "Quick Actions" after a bot response.

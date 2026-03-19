# TalkTree - Conversational Menu System

TalkTree is a dynamic, chatbot-driven menu management system built with Next.js, ShadCN, and Genkit. It allows administrators to build conversational trees that integrate with external APIs using flexible authentication and KYC collection.

## 🚀 Getting Started

1.  **Admin Panel** (`/admin`): Define your menu structure, configure API endpoints, and set up localization (Amharic/English).
2.  **User Chat** (`/`): Interact with the chatbot. The bot automatically handles KYC collection based on your API configurations.

---

## 🛠 API Scenario Testing Guide

The system includes several mock APIs to test different integration patterns. Follow these steps in the **Admin Panel** to verify each one:

### 1. Order History (API Key Auth)
*   **Goal**: Test standard API Key validation via custom headers.
*   **Configuration**:
    *   **Endpoint**: `/api/test/orders`
    *   **Auth Type**: `API Key`. Header: `x-api-key`. Value: `mysecretapikey123`.
    *   **Request Mapping**: Param Key: `limit` -> Source: `Static` -> Value: `2`.
    *   **Response View**:
        *   **Table Data Key**: `data`
        *   **Columns**: `id`, `total`
*   **Chat Interaction**: Returns a list of the first 2 orders.

### 2. User Secure Transactions (Bearer Auth + Path Parameter)
*   **Goal**: Test Bearer token authentication and path parameter injection.
*   **Configuration**:
    *   **Endpoint**: `/api/test/user-transactions/{{user_id}}`
    *   **Auth Type**: `Bearer Token`. Template: `Bearer mysecrettoken123`.
    *   **KYC Needed**: Add a KYC field with key `status` (e.g., success, pending).
    *   **Request Mapping**: Param Key: `status` -> Source: `KYC: status`.
    *   **Response View**:
        *   **Table Data Key**: `data.transactions`
        *   **Columns**: `id`, `amount`, `status`
*   **Chat Interaction**: The bot asks for a status. Enter `success` to see matching transactions.

### 3. Product Catalog (Basic Auth)
*   **Goal**: Test standard Basic Authentication.
*   **Configuration**:
    *   **Endpoint**: `/api/test/products`
    *   **Auth Type**: `Basic Auth`. User: `admin`, Pass: `1234`.
    *   **KYC Needed**: Add a KYC field with key `category`.
    *   **Request Mapping**: Param Key: `category` -> Source: `KYC: category`.
    *   **Response View**:
        *   **Table Data Key**: `data`
        *   **Columns**: `id`, `name`, `category`
*   **Chat Interaction**: The bot asks for a category. Enter `fruit` to see results.

---

## 🌍 Localization
The system supports English and Amharic by default. 
*   **Menu Labels**: Translated labels appear as buttons in chat.
*   **Response Templates**: Success and error messages can be fully localized.
*   **Table Headers**: Use the "Table" tab in Response View Mapping to provide localized column titles.

## 🔑 System Variables
The following system-level placeholders are always available:
*   `{{user_id}}`: Resolves to the current session user ID.
*   `{{user_token}}`: Resolves to the static system token.

---

## 🪄 Pro-Tips for Admin
*   **Magic Wand**: Use the Magic Wand icon next to "Data Keys" or "Templates" to automatically pick fields from your Live Preview data.
*   **Custom Headers**: Configure custom headers like `Content-Type` or `X-App-ID` in the Connectivity section.
*   **Attach Related**: Use "Attach Related Menus" at the bottom to suggest "Quick Actions" after a bot response.

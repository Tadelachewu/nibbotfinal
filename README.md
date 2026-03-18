# TalkTree - Conversational Menu System

TalkTree is a dynamic, chatbot-driven menu management system built with Next.js, ShadCN, and Genkit. It allows administrators to build conversational trees that integrate with external APIs using flexible authentication and KYC collection.

## 🚀 Getting Started

1. **Admin Panel** (`/admin`): Define your menu structure, configure API endpoints, and set up localization (Amharic/English).
2. **User Chat** (`/`): Interact with the chatbot. The bot automatically handles KYC collection based on your API configurations.

---

## 🛠 API Scenario Testing Guide

The system includes several mock APIs to test different integration patterns. Follow these steps to verify each one:

### 1. Exchange Rates (Header-based API Key)
*   **Goal**: Test simple API Key validation in headers.
*   **In Admin**: Set Endpoint to `/api/test/exchange-rate`. Auth Type: `API Key`. Header: `X-API-KEY`. Value: `secret-123`.
*   **In Chat**: Click "Exchange Rates". It will return a table of currencies.

### 2. Profile Lookup (Dynamic Path Parameter)
*   **Goal**: Test injecting a user-provided value directly into the URL path.
*   **In Admin**: Set Endpoint to `/api/test/profile/{{account_id}}`.
*   **KYC Needed**: Add a KYC field with key `account_id`.
*   **Auth**: Use `Bearer Token` with template `Bearer {{user_token}}`.
*   **Testing**: When you click this in chat, the bot will ask for your ID. Enter `user_123` to see the profile result.

### 3. Transactions (Multi-Parameter Query)
*   **Goal**: Test sending multiple variables (KYC + Static) as query parameters.
*   **In Admin**: Set Endpoint to `/api/test/transactions`.
*   **Request Mapping**: 
    *   `account_id` -> `KYC: account_id`
    *   `limit` -> `Static: 3`
*   **Testing**: The bot asks for your account ID (e.g., `88991122`), and the API returns a list of the last 3 transactions.

### 4. Multi-KYC Secure Action (Custom Header Logic)
*   **Goal**: Test complex, high-security header construction.
*   **Logic**: Constructs `Authorization: Bearer {{token}}.{{account}}.{{code}}`.
*   **Testing**:
    1. Click "Secure Account Access".
    2. Enter Account: `12345`.
    3. Enter Code: `9988`.
    4. Result: Returns the balance. Try `67890` / `1122` to see a "Suspended" error.

### 5. Basic Auth (Fixed vs. Dynamic)
*   **Goal**: Test standard username/password authentication.
*   **Fixed Mode**: Uses `admin` : `password123`.
*   **Dynamic Mode**: Uses KYC fields to source the username and password from the user's chat input.

---

## 🌍 Localization
The system supports English and Amharic. The Admin Panel includes **AI-powered localization** (via Genkit) to automatically suggest Amharic translations for your menu items and responses.

## 🔑 System Variables
The following system-level placeholders are always available for use in URLs, Headers, and Parameters:
*   `{{user_id}}`: Default is `user_123`.
*   `{{user_token}}`: Default is `talktree_static_token_778899`.

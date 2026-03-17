# TalkTree - Conversational Menu System

TalkTree is a dynamic, chatbot-driven menu management system built with Next.js, ShadCN, and Genkit. It allows administrators to build conversational trees that integrate with external APIs using flexible authentication and KYC collection.

## 🚀 Getting Started

1. **Admin Panel** (`/admin`): Define your menu structure, configure API endpoints, and set up localization (Amharic/English).
2. **User Chat** (`/`): Interact with the chatbot. The bot automatically handles KYC collection based on your API configurations.

---

## 🛠 Available Test APIs

The following APIs are included in the project for testing various authentication and data mapping scenarios:

### 1. Exchange Rates (`/api/test/exchange-rate`)
*   **Method**: `GET`
*   **Auth Type**: API Key
*   **Default Header**: `X-API-KEY`
*   **Test Value**: `secret-123`
*   **Mode**: Returns limited data without key; full list with key.

### 2. Account Balance (`/api/test/balance`)
*   **Method**: `GET`
*   **Auth Types**: Basic Auth OR Bearer Token
*   **Params**: `account_id` (e.g., `88991122`)
*   **Dynamic Auth**: Supports placeholders like `Bearer {{user_token}}-{{account_id}}`.

### 3. Basic Auth Validator (`/api/test/basic-auth-check`)
*   **Method**: `GET`
*   **Auth Type**: Basic Auth (Fixed or Per-User)
*   **Fixed Credentials**: `admin` : `password123`
*   **Dynamic Credentials**: `TEST_USER` : `TEST_PASS`

### 4. Multi-KYC Secure Action (`/api/test/multi-kyc`)
*   **Method**: `POST`
*   **Auth Type**: Bearer Token (Complex Template)
*   **Template**: `Bearer {{user_token}}.{{account_number}}.{{verification_code}}`
*   **Required KYC**: `account_number` (Test: `12345`) and `verification_code` (Test: `9988`).
*   **Body**: Expects JSON with mapped KYC fields.

---

## 🧪 How to Test Scenarios

### Test: API Key (Static)
1. In Admin, edit "Exchange Rates".
2. Set **Auth Type** to `API Key`.
3. Set **Header** to `X-API-KEY` and **Value** to `secret-123`.
4. Test in Chat: It should return the full rates table immediately.

### Test: Basic Auth (Per-User / Dynamic)
1. In Admin, edit a menu and set **Auth Type** to `Basic Auth`.
2. Choose **Per-user (Dynamic)** mode.
3. Map **Username Source** and **Password Source** to KYC fields (e.g., `user` and `pass`).
4. Test in Chat: The bot will ask for your username and password, encode them to Base64, and call the API.

### Test: Multi-KYC Bearer Token
1. In Admin, edit "Multi-KYC Secure Action".
2. Set **Auth Type** to `Bearer Token`.
3. Use Template: `Bearer {{user_token}}.{{account_number}}.{{verification_code}}`.
4. Add KYC fields `account_number` and `verification_code`.
5. Test in Chat: The bot will collect both values sequentially before constructing the multi-part header.

---

## 🌍 Localization
The system supports English and Amharic. The Admin Panel includes **AI-powered localization** (via Genkit) to automatically suggest Amharic translations for your menu items and responses.

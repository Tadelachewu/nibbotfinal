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

### 2. Multi-KYC Secure Action (`/api/test/multi-kyc`) - **Production Simulation**
*   **Method**: `POST`
*   **Header**: `Authorization: Bearer {{token}}.{{account}}.{{code}}`
*   **Verification**: Extracts segments from the header and verifies against a mock database.
*   **Mock Database**:
    *   **Account**: `12345` | **Code**: `9988` (Status: Active)
    *   **Account**: `67890` | **Code**: `1122` (Status: Suspended)
    *   **Account**: `11223` | **Code**: `3344` (Status: Pending)

### 3. Basic Auth Validator (`/api/test/basic-auth-check`)
*   **Method**: `GET`
*   **Auth Type**: Basic Auth (Fixed or Per-User)
*   **Fixed Credentials**: `admin` : `password123`
*   **Dynamic Credentials**: `TEST_USER` : `TEST_PASS`

---

## 🧪 How to Test Production Scenarios

### Test: Multi-KYC Secure Access
1. In Chat: Click **"Secure Account Access (Multi-KYC)"**.
2. **Bot**: Prompts for Account Number. Enter **`12345`**.
3. **Bot**: Prompts for Verification Code. Enter **`9988`**.
4. **Result**: The system constructs a "signed" multi-part Bearer token. The API extracts the segments, verifies them against the internal store, and returns the balance for account `12345`.
5. **Try Failure**: Restart and enter `67890` with code `1122`. The API will correctly report that the account is **Suspended**.

---

## 🌍 Localization
The system supports English and Amharic. The Admin Panel includes **AI-powered localization** (via Genkit) to automatically suggest Amharic translations for your menu items and responses.

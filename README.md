# 🌳 TalkTree

TalkTree is an advanced, production-grade Conversational AI and Dynamic Menu Management system. It seamlessly bridges a highly interactive user-facing chatbot with a powerful Admin interface that requires zero coding to configure complex API integrations, data collection (KYC), and UI mappings.

## 🚀 Key Features

*   **No-Code API Integration**: Admins can visually map external REST APIs to chatbot responses (Messages or Data Tables) using absolute paths (`data.rates[0].currency`).
*   **Dual Engine Evaluation**: Supports both "Exact Path (Unified Engine)" for direct JSON pathing and "Array Path (Legacy Engine)" for auto-looping table rows.
*   **Dynamic Data Collection (KYC)**: Formulate sequential prompts to collect user data (Account IDs, Emails) and securely inject them into API payloads or headers as `{{variables}}`.
*   **Production-Grade Real-Time Presence**: Next.js App Router wrapped in a custom Node server (`server.js`) powering native **WebSockets (Socket.io)** and **Redis**. It provides absolutely precise, real-time metrics on the Dashboard for active users utilizing TTL (Time-To-Live) purging.
*   **Anonymous Secure Sessions**: Client-side storage dynamically generates a unique browser `sessionId` allowing users to maintain state indefinitely without complex authentication systems.
*   **Multi-Language UI**: Integrated dual language support out of the box (e.g., English and Amharic).

---

## 🛠 Tech Stack

*   **Framework**: Next.js 15 (App Router) + React 19
*   **Styling**: Tailwind CSS + Shadcn UI
*   **Real-Time & Caching**: Socket.io + Upstash Redis (`ioredis`)
*   **Icons**: Lucide React
*   **Data Vis**: Recharts

---

## ⚙️ Setup & Installation

### 1. Prerequisites
*   Node.js 18.x or above.
*   A local Redis Server running on port `6379`, OR a free Upstash Redis database url. 

### 2. Environment Variables
Create a `.env` file at the root of the directory:
```env
NODE_ENV=development
PORT=9002

# Redis configuration (vital for Socket.io tracking to prevent crashes)
REDIS_URL=redis://localhost:6379
```

### 3. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 4. Running the Application
Because TalkTree heavily relies on persistent Socket.io connections bypassing Next.js serverless limitations, **do not use `npm run dev`**. Instead, use the custom unified Node server:

```bash
npm run dev:io
```

*   **User Chat Interface**: `http://localhost:9002/`
*   **Admin Dashboard**: `http://localhost:9002/admin`

---

## 🧪 Admin Playground: Test Scenarios

To help you get started, we've provided a comprehensive **[API Documentation & Test Guide](docs/API_GUIDE.md)** that covers both internal test endpoints and the external mock banking server.

The system is pre-loaded with mock `/api/test/...` endpoints inside the codebase so you can practice configuring the Admin Dashboard. Here is how to configure three powerful scenarios:

### Scenario 1: User Profile (Message Mapping)
Tests securely passing session variables and parsing absolute paths into a message string.

1.  **Menu Name**: `My Profile` -> Action Type: `API Action`
2.  **API Method**: `GET` -> URL: `/api/test/profile/{{user_id}}`
3.  **Root Mapping Key**: `data` 
4.  **Authorization**: `Bearer Token` -> Template: `Bearer talktree_static_token_778899`
5.  **Response Mapping (Message)**: 
    *   *Template*: `Hello {{data.data.full_name}}, your email is {{data.data.email}} and KYC status is {{data.data.kyc_status}}`

### Scenario 2: Remote Balance (Dynamic KYC Collection)
Tests prompting the user for an exact parameter and injecting it into the URL.

1.  **Menu Name**: `Check Balance` -> Action Type: `API Action`
2.  **KYC / Collected Fields**: Add Field -> Key: `account_id`, Type: `Number`, Prompt: `Enter your 8-digit Account Number (e.g. 88991122)`
3.  **API Method**: `GET` -> URL: `/api/test/balance`
4.  **Root Mapping Key**: `data`
5.  **Authorization**: `Bearer Token` -> Template: `Bearer talktree_static_token_778899`
6.  **Request Mapping**: Map Parameter -> Key: `account_id`, Source: `KYC: account_id`
7.  **Response Mapping (Message)**:
    *   *Template*: `Account {{data.data.account_id}} has {{data.data.balance}} {{data.data.currency}}`

### Scenario 3: Exchange Rates (Legacy Array Table Mapping)
Tests evaluating JSON arrays natively into a generated UI table.

1.  **Menu Name**: `Today's Rates` -> Action Type: `API Action`
2.  **API Method**: `GET` -> URL: `/api/test/exchange-rate`
3.  **Root Mapping Key**: `data`
4.  **Authorization**: `API Key` -> Header Name: `X-API-KEY`, Key Value: `secret-123`
5.  **Request Mapping**: Map Parameter -> Key: `base`, Source: Static (`USD`)
6.  **Response Mapping (Result Table)**:
    *   Switch to **Array Path (Legacy Engine)**
    *   *Table Data Key*: `data.rates`
    *   *Columns*: 
        * Header: `Currency` -> Data Key: `currency`
        * Header: `Rate` -> Data Key: `rate`

---

## 🔧 Architecture: How `Online Now` Works

TalkTree doesn't cheat metrics. When you open the `/admin` dashboard, the **Online Now** metric uses true WebSockets:

1.  When a user opens `ChatInterface.tsx`, the `socket.io-client` initiates a handshake with `server.js` and emits `user_active` every 15 seconds.
2.  The NodeJS server catches this and runs a **Redis ZADD** command, updating the user's explicit Unix timestamp score on the `online_users` Set.
3.  Every 5 seconds, a custom garbage collection loop in `server.js` triggers **ZREMRANGEBYSCORE**, instantly purging any `sessionId` that hasn't pinged in >20 seconds.
4.  Finally, it counts the absolute remainder and natively broadcasts `online_count_updated` through Socket.io to any listening Admin dashboard.




redis   sudo service redis-server start  on ubuntu
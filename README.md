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
*   PostgreSQL (local or hosted).
*   Redis (local on `6379`) or a hosted Redis URL (optional but recommended for accurate “Online Now”).

### 2. Environment Variables
Create a `.env` file at the root of the directory:
```env
NODE_ENV=development
PORT=9002

# Required
DATABASE_URL=postgresql://user:password@localhost:5432/nibbot?schema=public
SECRET_COOKIE_PASSWORD=replace-with-a-long-random-secret

# Socket.IO origin allowlist for custom websocket ports or domains
SOCKET_IO_ALLOWED_ORIGINS=http://localhost:9002
# App origin used for CORS and static asset access in production
APP_ORIGIN=http://localhost:9002
# Public site URL used for client-side URL generation and reset links
NEXT_PUBLIC_SITE_URL=http://localhost:9002

# Redis configuration (used for Socket.io presence tracking)
REDIS_URL=redis://localhost:6379

# Optional: initial seeded admin password
# ADMIN_INITIAL_PASSWORD=Admin@1234
```

### 3. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 4. Database (Prisma) Setup & Seeding
This project uses Prisma migrations stored in `prisma/migrations/` and a TypeScript seed script at `prisma/seed.ts`.

```bash
# Generate Prisma client
npx prisma generate

# Apply migrations to your database (creates DB tables)
# - Use this for local development (creates new migration files when schema changes)
npx prisma migrate dev

# Seed initial data (menus, app settings, admin credentials)
npx tsx prisma/seed.ts
```

#### Troubleshooting: "Cannot find module '.prisma/client/default'"

- Symptoms: running `npx tsx prisma/seed.ts` errors with "Cannot find module '.prisma/client/default'".
- Causes & fixes:
    - You didn't install dependencies: run `npm install` (or `npm ci`) first so `@prisma/client` and `prisma` are present.
    - Prisma client not generated: run `npx prisma generate` before running the seed script.
    - Missing `DATABASE_URL`: ensure `.env` contains a valid `DATABASE_URL` pointing to your database before running `npx prisma generate` or `npx prisma migrate dev`.
    - Using a custom Prisma schema path: pass `--schema` to `prisma generate` (e.g. `npx prisma generate --schema=prisma/schema.prisma`).
    - If you're running the seed via TypeScript (`npx tsx prisma/seed.ts`), ensure `tsx` is available (installed in `devDependencies`) or run the compiled JS script instead.

- Minimal sequence to prepare and seed locally:

```bash
npm install
export DATABASE_URL="postgresql://user:pass@localhost:5432/nibbot?schema=public" # Windows: set via PowerShell or .env
npx prisma generate
npx prisma migrate dev
npx tsx prisma/seed.ts
```

If you still see the missing module error after these steps, delete `node_modules/.prisma` and re-run `npx prisma generate`.

Notes:
*   If you change `prisma/schema.prisma`, run `npx prisma migrate dev --name <change_name>` to create a new migration.
*   If you deleted `prisma/migrations`, Prisma will show “No migration found in prisma/migrations” until you recreate migrations.
*   Deleting migration files does not force Prisma to create new migrations. `prisma migrate dev` only creates a migration when it detects schema changes (difference between `schema.prisma` and the current database).
*   If you deleted `prisma/migrations` but your database already has migration history, you must either:
    *   (Dev, data can be lost) run `npx prisma migrate reset --force` then `npx prisma migrate dev --name init`
    *   (Keep data) recreate a baseline migration using `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` and then mark it applied with `npx prisma migrate resolve --applied 0_init`

### 5. Running the Application
Because TalkTree heavily relies on persistent Socket.io connections bypassing Next.js serverless limitations, **do not use `npm run dev`**. Instead, use the custom unified Node server:

```bash
npm run dev:io
```

*   **User Chat Interface**: `http://localhost:9002/`
*   **Admin Dashboard**: `http://localhost:9002/admin`

---

## � Admin Forced Password Change (`mustChangePassword`)

When an admin account is newly created or password-reset, the `mustChangePassword` flag is set in the database. This enforces a password change on the next login:

### How it works

1. **Login with forced change**: When logging in with `mustChangePassword=true`, the login response includes the flag and the client automatically redirects to `/admin/change-password`.
2. **Change password page**: The dedicated page (`src/app/admin/change-password/page.tsx`) prompts the user to enter their current password, new username, and new password.
3. **Password validation**: New passwords must be strong (8+ chars, uppercase, lowercase, number, special character).
4. **Flag cleared**: After successful change, the `mustChangePassword` flag is set to false in the database and the user is redirected to the admin dashboard.

### Testing the flow

Run the integration test script to verify the full flow:

```bash
# PowerShell (Windows)
./scripts/test-mustChangePassword-flow.ps1

# Optional: customize credentials
./scripts/test-mustChangePassword-flow.ps1 -Username admin -OldPassword Admin@1234 -NewPassword NewAdmin@5678 -NewUsername admin_updated
```

The test verifies:
- Login with a seeded admin account returns `mustChangePassword: true`
- Session endpoint reflects the flag
- Change-password endpoint clears the flag
- Re-login with new credentials shows the flag is cleared

---

## �🔌 API Configuration (Admin)

The Admin dashboard can call external APIs using:
*   **Endpoint URL**: supports placeholders like `{{account_id}}` (from collected KYC)
*   **Auth**: API Key / Bearer / Basic
*   **Request Mapping**: maps query/body parameters from KYC or static values
*   **Response Mapping**: renders either a Message or a Table

### Example: Express Mock Banking API (Bearer + API Key)

Assume your external API server runs on `http://localhost:3000` and exposes:
*   `GET /api/accounts/:account_id/balance` (Bearer token)
*   `GET /api/accounts/:account_id/transactions` (Bearer token)
*   `GET /api/apikey/accounts/summary` (API Key)

#### 1) Balance (Bearer auth, path param + optional query)
Create a menu (Action Type: **API Action**) with:
*   **Method**: `GET`
*   **Endpoint URL**: `http://localhost:3000/api/accounts/{{account_id}}/balance`
*   **KYC fields**: `account_id` (type: number/text, required)
*   **Auth**: Bearer
    *   Header: `Authorization`
    *   Template: `Bearer secret-token-123`
*   **Request Mapping** (optional): add query param `currency` as Static `ETB`
*   **Root Mapping Key**: `data`
*   **Response Mapping (Message)** example:
    *   `Balance: {{data.data.available_balance}} {{data.data.currency}} (Account {{data.data.account_id}})`

#### 2) Transactions (Bearer auth, returns an array)
Create a menu (Action Type: **API Action**) with:
*   **Method**: `GET`
*   **Endpoint URL**: `http://localhost:3000/api/accounts/{{account_id}}/transactions`
*   **KYC fields**: `account_id` (required), optionally `type` and `minAmount` (optional)
*   **Auth**: Bearer → `Authorization: Bearer secret-token-123`
*   **Request Mapping** (optional):
    *   `type` → Source: KYC `type` (e.g. `debit` / `credit`)
    *   `minAmount` → Source: KYC `minAmount`
*   **Root Mapping Key**: `data`
*   **Response Mapping (Table)**:
    *   Mapping mode: Array Path
    *   Table Data Key: `data.data`
    *   Columns: `amount`, `type`, `date`

#### 3) Account Summary (API Key, mandatory query params)
Create a menu (Action Type: **API Action**) with:
*   **Method**: `GET`
*   **Endpoint URL**: `http://localhost:3000/api/apikey/accounts/summary`
*   **Auth**: API Key
    *   Header: `X-API-KEY`
    *   Value: `my-secret-api-key`
*   **Request Mapping** (query params):
    *   `account_id` → Source: KYC `account_id` (required)
    *   `currency` → Static `ETB` (required by the API)
    *   `includeTransactions` → Static `true` (optional)
*   **Root Mapping Key**: `data`
*   **Response Mapping (Message)** example:
    *   `Account {{data.data.account_id}} balance: {{data.data.balance}} {{data.data.currency}}`

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

## Production Notes (Migrations)
*   Use `npx prisma migrate deploy` in production to apply existing migrations (it will not create new ones).
*   Keep the `prisma/migrations/` folder in source control to ensure environments stay in sync.

## Internal API Endpoints (Reference)
This app includes internal Next.js API routes for both the chatbot and admin console.

**Core (DB-backed)**
*   `GET /api/menus` (public: active menus only)
*   `GET /api/menus?includeInactive=1` (admin only: includes suspended menus)
*   `POST /api/menus`, `PUT /api/menus/:id`, `DELETE /api/menus/:id` (admin only)
*   `POST /api/menus/:id/click` (public)
*   `GET /api/app-settings` (public)
*   `PUT /api/app-settings` (admin only)
*   `POST /api/reports` (public)
*   `GET /api/reports` (admin only)
*   `GET /api/reports/:id` (public: status lookup)
*   `PATCH /api/reports/:id`, `DELETE /api/reports/:id` (admin only)
*   `POST /api/logs` (public)
*   `GET /api/logs` (admin only)

**Admin Auth**
*   `POST /api/admin/auth/login`
*   `POST /api/admin/auth/logout`
*   `GET /api/admin/auth/session`
*   `POST /api/admin/auth/change-password`

**Test APIs (used for demo menus)**
*   `GET /api/test/exchange-rate`
*   `GET /api/test/balance`
*   `GET /api/test/profile/:userId`
*   `GET /api/test/user-transactions/:userId`
*   Additional examples under `/api/test/*` (see [API_GUIDE.md](docs/API_GUIDE.md))




redis

Wsl then ubuntu
sudo service redis-server start
redis-cli  then ping
it says pong



on windows native (without linux)
    winget install -e --id Memurai.MemuraiDeveloper
    memurai-cli =>  so PING it says pong


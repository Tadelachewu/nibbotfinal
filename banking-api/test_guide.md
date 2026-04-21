# 🏦 Nib Bot API Documentation & Test Guide (Updated)

This guide provides a comprehensive overview of all operational APIs in the Nib Bot ecosystem, including both the **Mock Banking API (External)** and the **Local Test APIs (Internal)**.

---

## 🌎 1. Mock Banking API (External)
The system supports two standalone Express servers: `server.js` (Port 3000) and `postget.js` (Port 3001).

### ⚙️ Setup & Run
```bash
cd banking-api
npm install
node server.js   # Main Mock API (Port 3000)
node postget.js  # Transfer & GET/POST Demo (Port 3001)
```

### 🔐 Authentication Secrets
| Server | Header Name | Key/Value | Required Type |
| :--- | :--- | :--- | :--- |
| `server.js` | `Authorization` | `secret-token-123` | Bearer Token |
| `server.js` | `x-api-key` | `my-secret-api-key` | API Key |
| `postget.js` | `Authorization` | `secure-bank-token` | Bearer Token |

---

## 🚀 Mock Endpoints (Port 3001 - postget.js)

### 1️⃣ Money Transfer (POST)
- **Method:** `POST`
- **Path:** `http://localhost:3001/api/transfer`
- **Auth:** Bearer (`secure-bank-token`)
- **Body / Mapping Keys:**
  - `sender_account`: (String) e.g. `1001`
  - `receiver_account`: (String) e.g. `1002`
  - `amount`: (Number) e.g. `50.00`
  - `currency`: (String, optional) defaults to `ETB`
  - `remark`: (String, optional)
- **Response Root:** `data`
- **Success Message Example:** `{{data.message}}! Ref: {{data.data.reference_id}}. New Balance: {{data.data.sender.balance_after}} ETB.`

#### Quick test (curl)
```bash
curl -s -X POST http://localhost:3001/api/transfer \
    -H "Authorization: Bearer secure-bank-token" \
    -H "Content-Type: application/json" \
    -d '{
        "sender_account": "1001",
        "receiver_account": "1002",
        "amount": 50.00,
        "currency": "ETB",
        "remark": "Test transfer"
    }'
```

Expected (example) JSON response:

```json
{
    "success": true,
    "data": {
        "reference_id": "TXN-000011",
        "sender": { "account_id": "1001", "balance_after": 14950.00 },
        "receiver": { "account_id": "1002", "balance_after": 8250.00 }
    },
    "message": "Transfer completed"
}
```

If auth fails you will see a 401 or an error JSON containing an auth error message.

### 2️⃣ Account Info (GET)
- **Method:** `GET`
- **Path:** `http://localhost:3001/api/account/{{account_id}}`
- **Auth:** Bearer (`secure-bank-token`)

### 3️⃣ Transaction Lookup (GET)
- **Method:** `GET`
- **Path:** `http://localhost:3001/api/transaction/{{ref_id}}`
- **Auth:** Bearer (`secure-bank-token`)

---

## 🚀 Mock Endpoints (Port 3000 - server.js)

### 1️⃣ Account Balance (GET)
- **Path:** `http://localhost:3000/api/accounts/{{account_id}}/balance`
- **Auth:** Bearer (`secret-token-123`)

#### Quick test (curl)
```bash
curl -s http://localhost:3000/api/accounts/1001/balance \
    -H "Authorization: Bearer secret-token-123"
```

Expected (example) JSON response:

```json
{
    "success": true,
    "data": {
        "account_id": "1001",
        "available_balance": 15000.00,
        "currency": "ETB"
    }
}
```

If the token is invalid you'll receive a 401 and an error message.

### 2️⃣ Account Summary (GET)
- **Path:** `http://localhost:3000/api/apikey/accounts/summary`
- **Auth:** API Key (`my-secret-api-key`)

---

## 🔁 Exchange Rate API (Port 3003 - exchangerate.js)

The Exchange Rate microservice runs independently on port `3003` and provides currency rates and conversion endpoints.

### ⚙️ Setup & Run
```bash
cd banking-api
npm install
node exchangerate.js   # Exchange Rate API (Port 3003)
```

### 🔐 Authentication
- **Header Name:** `x-api-key` (also accepts `api-key` as fallback)
- **Key Value:** `my-secret-api-key`

If the header is missing or invalid the API returns a 401/403 JSON error.

### Endpoints

- `GET http://localhost:3003/api/rates?base=USD`
    - Returns all rates for `base` currency.
    - Required query param: `base` (e.g. `USD`, `EUR`, `ETB`).

- `GET http://localhost:3003/api/convert-all?base=USD&amount=10`
    - Convert a given `amount` from `base` into all supported target currencies.
    - Query params: `base` (required), `amount` (optional, defaults to 1).

- `POST http://localhost:3003/api/convert`
    - Body JSON: `{ "from": "USD", "to": "ETB", "amount": 10 }`
    - Auth: `x-api-key` header required.

### Quick tests (curl)

Get rates for USD:
```bash
curl -s "http://localhost:3003/api/rates?base=USD" \
    -H "x-api-key: my-secret-api-key"
```

Convert 10 USD to all supported currencies:
```bash
curl -s "http://localhost:3003/api/convert-all?base=USD&amount=10" \
    -H "x-api-key: my-secret-api-key"
```

Convert single pair (POST):
```bash
curl -s -X POST http://localhost:3003/api/convert \
    -H "x-api-key: my-secret-api-key" \
    -H "Content-Type: application/json" \
    -d '{"from":"USD","to":"ETB","amount":5}'
```

### Admin Console / Connectivity Configuration

When configuring an Admin Console connectivity entry for exchange rates:

- **Method:** `GET` (for `/api/rates` and `/api/convert-all`) or `POST` for `/api/convert`.
- **Endpoint URL:** `http://localhost:3003/api/rates?base={{base}}` (use query param templating as supported by your admin UI).
- **Auth Type:** `API Key` with header `x-api-key` and value `my-secret-api-key`.
- **Response Root:** use `data` for rate responses and `data` for convert responses.

Example mapping for `GET /api/rates`:
- Map `base` -> KYC or static field.
- Read `data.rates` as the rates object.

Example mapping for `POST /api/convert`:
- Request body mapping: `from` -> KYC/base, `to` -> KYC/target, `amount` -> KYC/amount.
- Response root: `data.converted` (numeric) and `data.rate`.

---

## 🛠️ 2. Local Test APIs (Internal)
**Base URL:** `/api/test/...` (Use relative paths)
**Auth:** Bearer (`nib_static_token_778899`)

- `/api/test/balance` (GET)
- `/api/test/transactions` (GET)
- `/api/test/exchange-rate` (Public GET)
- `/api/test/multi-kyc` (POST)

---

## 🧪 3. Admin Console: POST Transfer Configuration

To configure the `Transfer` feature in the Admin Console:

1.  **Menu Management**: Create a new menu named `Send Money`.
2.  **Collected Fields (KYC)**:
    - Add `receiver_account` (Number, Prompt: `Enter Receiver Account`)
    - Add `transfer_amount` (Number, Prompt: `Enter Amount to send`)
    - Add `transfer_remark` (Text, Prompt: `Add a remark?`)
3.  **Connectivity Tab**:
    - **Method**: Select `POST`.
    - **Endpoint URL**: `http://localhost:3001/api/transfer`.
    - **Response Root**: `data`.
4.  **Auth Config**:
    - Select `Bearer Token`.
    - Token Template: `Bearer secure-bank-token`.
5.  **Request Mapping**:
    - Map `sender_account` -> Static: `1001` (or get from user login state).
    - Map `receiver_account` -> KYC: `receiver_account`.
    - Map `amount` -> KYC: `transfer_amount`.
    - Map `remark` -> KYC: `transfer_remark`.
6.  **Message Template**:
    - *Template*: `Transfer Successful! Your new balance is {{data.data.sender.balance_after}} ETB. Transaction ID: {{data.data.reference_id}}`

---

## 📝 Demo Account Registry

| Account ID | Holder | Balance |
| :--- | :--- | :--- |
| **1001** | Abel Tesfaye | 15,000 ETB |
| **1002** | Selam Worku | 8,200 ETB |
| **1003** | Dawit Kebede | 500 ETB |
| **1004** | Marta Tesfaye | 25,000 (Business) |
| **1005** | Biruk Alemu | 0 (Inactive) |

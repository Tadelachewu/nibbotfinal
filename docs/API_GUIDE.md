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

### 2️⃣ Account Info (GET)
- **Method:** `GET`
- **Path:** `http://localhost:3001/api/account/{{account_id}}`
- **Auth:** Bearer (`secure-bank-token`)

### 3️⃣ Transaction Lookup (GET)
- **Method:** `GET`
- **Path:** `http://localhost:3001/api/transaction/{{ref_id}}`
- **Auth:** Bearer (`secure-bank-token`)

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

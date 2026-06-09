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

## 🛠️ 3. How to Configure APIs (Step-by-Step)

Follow these steps in the **Admin Console** to connect a menu item to an external or internal API.

### Step 1: Initialize the Menu
1.  Go to **Menu Hierarchy** in the Admin Console.
2.  Click **Add Main Menu** or edit an existing item.
3.  Set the **Response Type** to `API Call` (found in the General tab).
4.  If you need user input (like account numbers), add fields in the **Collected Fields (KYC)** section.

### Step 2: API Connectivity
1.  Switch to the **Connectivity** tab (appears after selecting Response Type: API).
2.  **Method**: Choose `GET` or `POST`.
3.  **Endpoint URL**: Enter the full URL. You can use placeholders like `{{account_id}}` which will be replaced by user input from the KYC fields.
4.  **Authorization**:
    - **None**: For public APIs.
    - **API Key**: Set the Header name (e.g., `x-api-key`) and the Secret Value.
    - **Bearer Token**: Enter your token (e.g., `secure-bank-token`). The system adds the "Bearer " prefix automatically if you use the template.

### Step 3: Request Mapping (Parameters)
1.  Add parameters that the API expects.
2.  **API Param Key**: The name of the field the API expects (e.g., `receiver_account`).
3.  **Source Type**:
    - `KYC Field`: Link it to a field you created in Step 1.
    - `Static`: Enter a fixed value.
    - `Admin Default`: A pre-configured system value.
4.  **Source Value**: Select the specific KYC field or type the static value.

### Step 4: Response View Mapping
Decide how the bot should display the API results to the user.

#### Option A: Message Template (Simple Text)
1.  Use `{{data.path.to.field}}` to display specific values from the API response.
2.  **Example**: `Your balance is {{data.account.balance}} ETB.`
3.  **Error Fallback**: Provide a message to show if the API fails.

#### Option B: Result Table (Multiple Rows)
1.  **Response Root**: Enter the path to the array in the API response (e.g., `data.transactions`).
2.  **Table Columns**:
    - **Header**: The label users will see (e.g., "Date").
    - **Data Key**: The key in the API response object (e.g., `transaction_date`).

### Step 5: Test & Verify
1.  Click the **Live Preview** button in the Connectivity tab.
2.  The system will attempt to call the API and show you the raw JSON response.
3.  If successful, you will see a list of "Available Fields" which you can use to map your Message Template or Table Columns.
4.  Click **Save Changes** and wait for approval (if required).

---

## �️ 4. Troubleshooting: CSP & Protocol Errors

If you see an error like `violates the following Content Security Policy directive: "connect-src..."`, follow these steps:

### 1. Protocol Mismatch (HTTP vs HTTPS)
**Reason**: You are trying to connect to `http://192.168.100.56...` but the security policy (CSP) only allows `https` by default for production safety.
**Fix**: 
- **Recommended**: Use `https://192.168.100.56:8280` in your Admin Console configuration.
- **Alternative (Enable HTTP)**: If your internal API does not support HTTPS, you can enable HTTP support via environment variables:
  1. Open your `.env` file.
  2. Set `ALLOW_HTTP=true`.
  3. Restart the server.
  4. Once enabled, the CSP will allow both `http` and `https` for the internal bank API.
  5. If `ALLOW_HTTP` is `false` or not set, only `https` is allowed.

### 2. Updating Allowed Origins (CSP)
**Reason**: The external API domain/IP is not in the "Whitelist".
**Fix**:
1.  Open your environment configuration (e.g., `.env` file or server environment variables).
2.  Locate the `ALLOWED_CONNECT_SRC` variable.
3.  Add the new API origin (including protocol and port).
    - **Example**: `ALLOWED_CONNECT_SRC="https://api.external.com http://192.168.100.56:8280 https://192.168.100.56:8280"`
4.  Restart the application server for changes to take effect.

### 3. Mixed Content Warnings
**Reason**: The main app is running on `https`, but you are trying to call an `http` API.
**Fix**: Browsers often block `http` calls from `https` sites for security. Always prefer `https` for your API endpoints if available.

### 4. Network Timeout (ERR_TIMED_OUT)
**Reason**: The browser tried to connect to the API but received no response within the time limit. This is a network connectivity issue, not a code error.
**Fix**:
1.  **Check IP Accessibility**: Try to "ping" the IP address `192.168.100.56` from your command prompt. If it fails, you are not on the same network.
2.  **Verify Server Status**: Ensure the API service is actually running on the target machine.
3.  **Check Port & Protocol**: 
    - Ensure port `8280` is open.
    - If the server only supports HTTP, make sure you are using `http://` (and have `ALLOW_HTTP=true` set in your `.env`).
    - Using `https://` on a port that only supports `http` will often cause a timeout.
4.  **Firewall**: Ensure that the firewall on the server (192.168.100.56) allows incoming connections on port `8280`.

---

## �📝 Demo Account Registry

| Account ID | Holder | Balance |
| :--- | :--- | :--- |
| **1001** | Abel Tesfaye | 15,000 ETB |
| **1002** | Selam Worku | 8,200 ETB |
| **1003** | Dawit Kebede | 500 ETB |
| **1004** | Marta Tesfaye | 25,000 (Business) |
| **1005** | Biruk Alemu | 0 (Inactive) |

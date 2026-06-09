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

## 💎 4. Example: Configuring Exchange Rate API

For the endpoint `http://192.168.100.56:8280/nib/exchangeRate`, the **Result Table** is the best response type.

**Why Result Table?**
Exchange rate APIs usually return a list of many currencies (USD, EUR, GBP, etc.). A table allows the user to compare all rates at once in a professional, organized layout rather than reading a long, messy text message.

### Step-by-Step Configuration:

1.  **General Tab**:
    - **Menu Name**: `Daily Exchange Rates`
    - **Response Type**: Select `API Call`.
2.  **Connectivity Tab**:
    - **Method**: `GET`
    - **Endpoint URL**: `http://192.168.100.56:8280/nib/exchangeRate`
    - **Authorization**: `None` (assuming it's an internal open API).
3.  **Response View Mapping**:
    - Select the **Result Table** tab.
    - **Response Root**: Enter the path to the currency array. 
      - *Common values*: `data`, `rates`, or `exchangeRates`. Use **Live Preview** to find the exact key.
    - **Table Columns**: Add columns for the data you want to show:
      - Header: `Currency` | Data Key: `currencyCode`
      - Header: `Buying` | Data Key: `buyRate`
      - Header: `Selling` | Data Key: `sellRate`

---

## 🛡️ 5. Troubleshooting: Common API Errors

### 1. Protocol Mismatch (Automatic HTTPS Upgrade)
**Reason**: Your browser is automatically changing your `http://` link to `https://`. This is caused by a security directive called `upgrade-insecure-requests`.
**Fix**: 
1.  **Environment Fix**: Ensure you have `ALLOW_HTTP=true` in your `.env` file.
    - When `ALLOW_HTTP=true`, the system automatically disables the "Automatic HTTPS Upgrade" directive, allowing the browser to respect your `http://` choice.
2.  **Browser Cache**: If it still upgrades, your browser might have "remembered" that the site should be secure. Try:
    - Clearing your browser cache for the site.
    - Testing in an **Incognito/Private** window.
3.  **Check Admin Console**: Verify the **Endpoint URL** definitely starts with `http://`.

### 2. CORS Policy Block (ERR_FAILED)
**Reason**: This is a **Cross-Origin Resource Sharing (CORS)** error. Your browser is blocking the request because the bank's API server has not given "permission" to your chatbot's domain to access its data.

**The Fix (Integrated Proxy)**:
To solve this without needing any changes on the banking API server, this application now includes an **Internal API Proxy**.
1.  **How it works**: The chatbot sends requests to our own server-side proxy (`/api/proxy`).
2.  **Bypassing CORS**: Since our server calls the banking API server (server-to-server), the browser's CORS rules are completely bypassed.
3.  **No Action Required**: This mechanism is automatically used by the **Live Preview** and the **Chatbot**.

### 3. Network Timeout (ERR_TIMED_OUT)
**Reason**: The browser tried to connect to the API but received no response within the time limit.
**Fix**:
1.  **Check IP Accessibility**: Try to `ping 192.168.100.56`. If it fails, you are not on the same network.
2.  **Check Port**: Ensure port `8280` is open and the service is running.
3.  **Firewall**: Ensure the server firewall allows incoming connections on port `8280`.

### 4. SSL/Self-Signed Certificate Error (DEPTH_ZERO_SELF_SIGNED_CERT)
**Reason**: The banking API uses an `https` certificate that is not recognized by a global certificate authority (it is "self-signed"). By default, Node.js blocks these connections.
**Fix**:
1.  Open your `.env` file.
2.  Set `ALLOW_SELF_SIGNED_CERTS=true`.
3.  Restart the application server.

---

## 📝 Demo Account Registry

| Account ID | Holder | Balance |
| :--- | :--- | :--- |
| **1001** | Abel Tesfaye | 15,000 ETB |
| **1002** | Selam Worku | 8,200 ETB |
| **1003** | Dawit Kebede | 500 ETB |
| **1004** | Marta Tesfaye | 25,000 (Business) |
| **1005** | Biruk Alemu | 0 (Inactive) |

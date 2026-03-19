
# 📖 Detailed Response Mapping Guide

This document explains how TalkTree resolves data from various sources (API responses, user input, system variables) and maps them into the user interface.

---

## 1. The Placeholder Syntax
TalkTree uses a Handlebars-inspired syntax: `{{variable_name}}`. These placeholders are automatically resolved in:
*   **API Endpoints**: `/api/user/{{userId}}`
*   **Auth Headers**: `Bearer {{user_token}}`
*   **Success Messages**: `Hello {{full_name}}, your balance is {{response.data.balance}}`
*   **Error Fallbacks**: `Sorry, account {{account_id}} was not found.`

---

## 2. Data Scopes (Resolution Priority)
When the system sees `{{key}}`, it looks for data in this specific order:

### A. System Variables
Reserved keywords that are always available:
*   `{{user_id}}`: The unique session ID of the current browser user.
*   `{{user_token}}`: The static security token configured in the app.

### B. KYC (User Input)
Any field collected from the user during the current flow. 
*   If you have a KYC field named `account_id`, you access it via `{{account_id}}`.

### C. Response (Root/Global)
Access the **entire JSON response** from the API using the `response.` prefix.
*   **Input**: `{{response.status}}` -> **Output**: `success`
*   **Input**: `{{response.data.profile.email}}` -> **Output**: `john@doe.com`
*   **Input**: `{{response.data.transactions.length}}` -> **Output**: `5` (Counts items in an array)

---

## 3. Result Table Logic
Tables are used when the `Response View Mapping` is set to **Table**.

### Step 1: Defining the "Table Data Key"
This tells the system where the array of items is located in your JSON.
*   **JSON**: `{ "data": { "orders": [...] } }`
*   **Table Data Key**: `data.orders`

### Step 2: Mapping Columns
Each column has a **Data Key**. The system resolves this key for *every row* in the array.

1.  **Row Scope (Direct)**: If the Data Key is `total`, the system looks for `item['total']` inside the current row.
2.  **Global Scope (Prefix)**: If you use the `response.` prefix, the system "jumps out" of the row to the root JSON.
    *   **Example**: Column Key `response.meta.currency`. 
    *   **Result**: Every row in the table will show the same currency code from the root metadata.

---

## 4. Universal Resolver (The `getVal` Engine)
The system uses a recursive path resolver. If you provide a path like `data.user.permissions.0.name`, it will:
1.  Navigate to `data`
2.  Navigate to `user`
3.  Navigate to `permissions`
4.  Access the first item in the array `[0]`
5.  Retrieve the `name` property.

---

## 5. Pro-Tips
*   **Magic Wand**: In the Admin Panel, use the Sparkle/Wand icon to see a list of paths detected in your **Live Preview**.
*   **HTML Support**: Success messages support the same WYSIWYG tags (Bold, Links, Lists) as static content.
*   **Localization**: You can provide different templates for English and Amharic. The system will resolve the same placeholders in both.

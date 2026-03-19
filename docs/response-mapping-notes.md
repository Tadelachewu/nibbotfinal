# 📖 Strict Mapping Protocol (Response Mapping Guide)

This document explains the mandatory standards for mapping API responses to the TalkTree UI. Adhering to these rules ensures that placeholders and tables resolve correctly every time.

---

## 1. The Root Mapping Standard
Admins must define a **Root Key** (e.g., `data`) in the API Configuration panel. This key represents the entire JSON object returned by the server.

### ❌ WRONG (Ambiguous)
*   Template: `Your balance is {{balance}}`
*   *Issue: The system doesn't know if `balance` is a KYC input, a system variable, or part of the API response.*

### ✅ RIGHT (Explicit)
*   **Root Key**: `data`
*   Template: `Your balance is {{data.balance}}`
*   *Result: The system explicitly looks inside the API response object for the `balance` field.*

---

## 2. Validation Checklist
Before deploying a menu, verify the following:

1.  **[ ] Root Key Defined**: Is the "Root Mapping Key" set in the API Config (default is `data`)?
2.  **[ ] Namespace Matching**: Do all success message placeholders start with that key? (e.g., `{{data.id}}`)
3.  **[ ] Case Sensitivity**: Does the path match the API response exactly? (e.g., `data.account_id` vs `data.accountId`).
4.  **[ ] Table Root**: Does the "Table Data Key" correctly point to the array from the root? (e.g., `data.orders`).
5.  **[ ] Live Preview Valid**: Run "Live Preview" and use the **Magic Wand (✨)** icon to see the actual detected paths.

---

## 3. Data Resolution Priority
When a placeholder `{{key}}` is found, the system resolves it in this order:

1.  **System Variables**: `{{user_id}}`, `{{user_token}}`.
2.  **Explicit Response**: If the key starts with your defined Root Key (e.g., `{{data.xxx}}`), it fetches from the API JSON.
3.  **KYC Input**: If it matches a field collected from the user (e.g., `{{account_number}}`).
4.  **Raw Fallback**: If no match is found, the placeholder is displayed raw to help you debug.

---

## 4. Result Table Protocol
Tables resolution follows the same explicit paths.

*   **Table Data Key**: Path to the array (e.g., `data.results`).
*   **Column Keys**: 
    *   To get a value from the *current row*: Just the key (e.g., `amount`).
    *   To get a value from the *root response*: Use the root key (e.g., `data.meta.currency`).

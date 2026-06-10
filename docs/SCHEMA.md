# 🗄️ Nib Bot Database Schema Documentation

This document provides a comprehensive overview of the PostgreSQL database schema used by the Nib Bot application, managed via Prisma ORM.

---

## 🏗️ Core Application Models

### 1. `MenuItem` (`menu_items`)
The backbone of the conversational bot. Represents every node in the chat hierarchy.

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id` | Unique identifier (slug-like). |
| `parentId` | `String?` | Optional | References parent menu for tree structure. |
| `name` | `String` | Required | Display name in English. |
| `nameAm` | `String?` | Optional | Display name in Amharic. |
| `responseType` | `Enum` | `ResponseType` | `static`, `api`, or `report`. |
| `apiConfig` | `Json?` | Optional | Connectivity settings (URL, Method, Auth). |
| `approvalStatus`| `Enum` | `MenuApprovalStatus`| `pending`, `approved`, `rejected`. |
| `trackClicks` | `Boolean` | Default: `false` | Enables analytics for this menu. |

**Relationships:**
- **Self-Relation**: `parentId` relates to another `MenuItem` (One-to-Many).
- **Attachments**: Related to `MenuAttachment` for side-menus.
- **KYC**: Related to `MenuKYC` for form fields.
- **Reports**: Related to `UserReport` if type is `report`.

---

### 2. `KYCField` (`kyc_fields`)
Defines the input fields required from users during a conversation (e.g., Account Number, Name).

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id` | Unique ID. |
| `name` | `String` | Required | Internal field name. |
| `prompt` | `String` | Required | The question the bot asks the user. |
| `type` | `Enum` | `KYCFieldType` | `text`, `number`, `tel`, `email`, etc. |
| `required` | `Boolean` | Default: `false` | If the user must provide this info. |

**Relationships:**
- **Menu Mappings**: Linked to `MenuItem` via the `MenuKYC` join table.

---

### 3. `MenuKYC` (`menu_kyc`)
Join table linking `MenuItem` and `KYCField`.

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `menuId` | `String` | Foreign Key | Links to `MenuItem`. |
| `kycId` | `String` | Foreign Key | Links to `KYCField`. |
| `order` | `Int` | Default: `0` | Order of appearance in the form. |

---

## 📈 User Interactions & Submissions

### 4. `UserReport` (`user_reports`)
Stores data submitted by users via forms (KYC collection).

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id` | Unique Report ID (generated based on config). |
| `data` | `Json` | Required | All user answers stored as a JSON object. |
| `status` | `Enum` | `ReportStatus` | `pending`, `reviewed`, `resolved`. |
| `priority` | `Enum` | `ReportPriority` | `low`, `medium`, `high`, `urgent`. |

**Relationships:**
- **Menu**: Links to the `MenuItem` that generated the report.
- **Activities**: One-to-Many with `ReportActivity` for history.

---

### 5. `InteractionLog` (`interaction_logs`)
Stores every chat exchange for analytics and troubleshooting.

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `sessionId` | `String` | Required | Identifies a specific user chat session. |
| `userMessage` | `String` | Text | The raw or masked user input. |
| `botResponse` | `String` | Text | What the bot replied. |
| `responseTime`| `Int?` | Milliseconds | Performance metric of the response. |

---

## 🔐 Security & Administration

### 6. `AdminCredential` (`admin_credentials`)
Stores admin accounts and roles.

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `username` | `String` | `@unique` | Admin login name. |
| `role` | `Enum` | `AdminRole` | `admin`, `checker`, or `support`. |
| `passwordHash`| `String` | Required | Securely hashed password. |

---

### 7. `AuditLog` (`audit_logs`)
Tracks all sensitive administrative actions.

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `actor` | `String` | Index | Username of the admin who did the action. |
| `action` | `String` | Required | e.g., "DELETE_MENU", "UPDATE_SETTINGS". |
| `target` | `String` | Required | The ID or name of the modified object. |
| `details` | `String?` | Text | JSON-stringified details of the change. |

---

## ⚙️ Configuration Models

### 8. `AppSettings` (`app_settings`)
Singleton table storing global application configuration.

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `appLogo` | `String?` | Text | Base64 or URL for the bank logo. |
| `botAvatarText`| `String?` | Optional | Text displayed in the bot avatar. |
| `reportIdId` | `Int?` | `@unique` | Link to Report ID configuration. |

---

## 🔗 Key Relationships Summary

1.  **Menu Hierarchy**: `MenuItem` uses a self-referencing relationship (`parentId`) to build the navigation tree.
2.  **Form Collection**: `MenuItem` <-> `MenuKYC` <-> `KYCField`. This allows reusing the same field (like "Account Number") across different menus.
3.  **Submission Flow**: When a user fills a form, a `UserReport` is created and linked to the `MenuItem` of type `report`.
4.  **Audit Trail**: Administrative changes to `MenuItem` or `AppSettings` trigger an entry in the `AuditLog` table.
5.  **Analytics**: Every click on a menu is tracked in `ClickHistory` and linked back to the `MenuItem`.

---

# Low-Level Design (LLD) Document

**Project Name:** Nibbot — Conversational Bot Platform  
**Document Version:** 1.0  
**Derived From:** Codebase Reverse-Engineering  

---

## 1. Introduction

### 1.1 Purpose of the LLD Document

This Low-Level Design (LLD) document provides a comprehensive technical specification that defines how each component of the Nibbot system is implemented. It translates the High-Level Design into detailed instructions for developers and engineers and serves as the definitive implementation reference.

#### 1.1.1 In-Scope Features

The following features are explicitly implemented in the codebase and are covered by this document:

- Admin authentication with role-based access control (Admin, Checker, Support)
- Dynamic hierarchical menu creation and management with maker-checker approval
- KYC (Know Your Customer) data collection via conversational chat forms
- Dynamic API endpoint configuration and response mapping per menu item
- User report submission with configurable sequential ID generation
- Report lifecycle management (pending → reviewed → resolved) with activity logging
- Real-time online user presence tracking via WebSocket and Redis
- Interaction logging with sensitive data masking
- Multi-language localization support (English and Amharic)
- Application-level settings management (avatars, branding, report ID format)
- Password recovery via database-persisted tokens and SMTP email delivery
- Click analytics tracking per menu item

#### 1.1.2 Out-of-Scope

The following features are **not explicitly identified in implementation**:

- Free-text AI/NLP intent recognition (system uses deterministic menu routing)
- External OAuth/SSO authentication providers
- Native mobile applications (iOS/Android)
- Third-party CRM or ERP integrations
- Automated CI/CD pipeline definitions
- Infrastructure as Code (Terraform, CloudFormation)

#### 1.1.3 Assumptions and Constraints

**Assumptions:**
- A PostgreSQL database instance is available and accessible via `DATABASE_URL`.
- The deployment environment supports long-lived WebSocket connections.
- Target users have access to modern web browsers supporting React 19.

**Constraints:**
- Socket.io state is in-memory per instance; horizontal scaling requires a Redis adapter (not yet configured).
- Avatar and logo images are persisted to local filesystem (`public/uploads/`), not to object storage.
- The `app_settings` table enforces a singleton row pattern (id=1).
- API configuration is stored as untyped JSON in PostgreSQL, validated at the application layer only.

#### 1.1.4 Audience for the Document

This document is intended for:
- Software Developers and Engineers implementing or maintaining the system
- Quality Assurance Engineers designing test cases
- System Architects reviewing implementation compliance
- DevOps Engineers managing deployment and infrastructure

### 1.2 Significance of the Project

Nibbot is designed to automate customer service interactions for banking and financial institutions. By replacing manual phone/email support with a structured, configurable conversational interface, the system reduces operational overhead, ensures consistent data collection via KYC forms, and provides a complete audit trail for support tickets. The maker-checker workflow ensures governance compliance for configuration changes.

### 1.3 System Design and Analysis

#### 1.3.1 Development Environment

| Component | Specification |
|:---|:---|
| **Operating System** | Cross-platform (Windows, macOS, Linux) |
| **Runtime** | Node.js ≥18 |
| **Language** | TypeScript 5.x, JavaScript (ES2022+) |
| **Package Manager** | npm (package-lock.json present) |
| **Dev Server** | `npm run dev` (Next.js Turbopack, port 9003) or `npm run dev:io` (Custom server + Socket.io, port 9002) |
| **Database** | PostgreSQL (local or remote via `DATABASE_URL`) |
| **Cache** | Redis (optional, via `REDIS_URL`) |

#### 1.3.2 Development Tools

| Tool | Version | Purpose |
|:---|:---|:---|
| Next.js | 16.2.1-canary | Framework (SSR, App Router, API routes) |
| Prisma | 7.5.0 | ORM and database migration tool |
| TypeScript | 5.x | Static type checking |
| ESLint | 9.x | Code linting and quality enforcement |
| TipTap | 2.11.5 | WYSIWYG rich-text editor |
| Tailwind CSS | 3.4.1 | Utility-first CSS framework |
| Radix UI | Various | Accessible headless UI components |
| Recharts | 2.15.1 | Data visualization in Dashboard |
| Zod | 3.24.2 | Runtime schema validation |

#### 1.3.3 Testing Procedures

- **Unit Testing:** Not explicitly identified in implementation. No test runner configuration (Jest, Vitest) or test files found in the codebase.
- **Integration Testing:** Not explicitly identified in implementation.
- **End-to-End Testing:** Not explicitly identified in implementation. No Playwright or Cypress configuration found.
- **Manual Testing:** The `/api/test/*` route group (10 endpoints) serves as mock API endpoints for manual integration testing of the dynamic API mapping engine.

### 1.4 Acronyms and Definitions

| Acronym/Term | Definition |
|:---|:---|
| **KYC** | Know Your Customer — data collection fields for user identity verification |
| **CSP** | Content Security Policy — HTTP header controlling resource loading |
| **CSRF** | Cross-Site Request Forgery — attack vector mitigated via token validation |
| **RBAC** | Role-Based Access Control — permission model (Admin, Checker, Support) |
| **SSR** | Server-Side Rendering — HTML generated on the server per request |
| **ORM** | Object-Relational Mapping — database abstraction layer (Prisma) |
| **HSTS** | HTTP Strict Transport Security — forces HTTPS connections |
| **TTL** | Time To Live — expiration mechanism for tokens and cache entries |
| **Maker-Checker** | Dual-control workflow where one user creates and another approves |

---

## 2. System Functionality Overview

The Nibbot system provides two primary interfaces:

1. **End-User Chat Interface** — A conversational bot that presents hierarchical menus, collects KYC data through dynamic forms, executes configured API calls, and submits support reports.

2. **Admin Dashboard** — A comprehensive management portal for configuring menus, managing reports, administering users, viewing interaction logs, and customizing system settings.

The system operates on three response types per menu item:
- **Static** — Renders pre-configured HTML/text content directly in the chat
- **API** — Collects KYC inputs, constructs an API request using template variables, and renders the JSON response as a formatted table
- **Report** — Collects KYC inputs and creates a support ticket with a sequential ID

---

## 3. Detailed Design

### 3.1 Use Case Diagram

```mermaid
flowchart LR
    %% Actors
    EU(("End User"))
    AD(("Admin"))
    CK(("Checker"))
    SP(("Support"))

    %% End User Use Cases
    subgraph "End User Use Cases"
        EU_UC1(["Browse Chat Menus"])
        EU_UC2(["Fill KYC Form"])
        EU_UC3(["View Dynamic API Data"])
        EU_UC4(["Submit Support Report"])
        EU_UC5(["Check Report Status"])
        EU_UC6(["Rate Support Service"])
        EU_UC7(["View Chat History"])
    end

    EU --> EU_UC1
    EU --> EU_UC5
    EU --> EU_UC7

    EU_UC2 -. "<<extend>>\n(If API/Report type)" .-> EU_UC1
    EU_UC3 -. "<<include>>" .-> EU_UC2
    EU_UC4 -. "<<include>>" .-> EU_UC2
    EU_UC6 -. "<<extend>>\n(If Resolved)" .-> EU_UC5

    %% System Actor (Admin/Checker/Support)
    subgraph "Admin / Staff Use Cases"
        SYS_UC1(["Login to Dashboard"])
        
        %% Admin specific
        AD_UC1(["Manage Menus"])
        AD_UC1_1(["Configure API Endpoint"])
        AD_UC1_2(["Attach KYC Fields"])
        
        AD_UC2(["Manage Reports (All)"])
        AD_UC2_1(["Escalate Report"])
        
        AD_UC3(["Configure App Settings"])
        AD_UC3_1(["Upload Avatars & Logos"])
        
        AD_UC4(["Manage Admin Accounts"])
        AD_UC5(["View Interaction Logs"])
        AD_UC6(["Manage KYC Definitions"])
        AD_UC7(["View Dashboard Metrics"])
        
        %% Checker specific
        CK_UC1(["Review Pending Menus"])
        CK_UC1_1(["Approve Menu Change"])
        CK_UC1_2(["Reject with Reason"])
        
        %% Support specific
        SP_UC1(["Manage Assigned Reports"])
        SP_UC1_1(["Update Status"])
        SP_UC1_2(["Add Admin Response"])
        SP_UC1_3(["Add Internal Notes"])
    end

    AD --> SYS_UC1
    CK --> SYS_UC1
    SP --> SYS_UC1

    AD --> AD_UC1
    AD --> AD_UC2
    AD --> AD_UC3
    AD --> AD_UC4
    AD --> AD_UC5
    AD --> AD_UC6
    AD --> AD_UC7

    AD_UC1_1 -. "<<include>>" .-> AD_UC1
    AD_UC1_2 -. "<<include>>" .-> AD_UC1
    
    AD_UC2_1 -. "<<extend>>" .-> AD_UC2
    AD_UC3_1 -. "<<include>>" .-> AD_UC3

    CK --> CK_UC1
    CK_UC1_1 -. "<<extend>>" .-> CK_UC1
    CK_UC1_2 -. "<<extend>>" .-> CK_UC1

    SP --> SP_UC1
    SP_UC1_1 -. "<<include>>" .-> SP_UC1
    SP_UC1_2 -. "<<include>>" .-> SP_UC1
    SP_UC1_3 -. "<<include>>" .-> SP_UC1
```

### 3.2 Description of the Components

#### 3.2.1 Login Component

| Attribute | Detail |
|:---|:---|
| **Source File** | `src/components/admin/AdminLoginPage.tsx`, `src/app/api/admin/auth/login/route.ts` |
| **Input Fields** | Username (text), Password (password) |
| **Processing** | Same-origin validation → credential lookup (Prisma) → bcrypt comparison → iron-session creation → CSRF token generation |
| **Output** | JSON `{success, username, role, csrfToken}` or 401 error |
| **Special Logic** | On first-ever login, if no admin exists, an initial admin is auto-seeded from environment variables (`ADMIN_INITIAL_USERNAME`, `ADMIN_INITIAL_PASSWORD`). On localhost, defaults to `admin` / `Admin@1234`. |

#### 3.2.2 Register Admin User

| Attribute | Detail |
|:---|:---|
| **Source File** | `src/components/admin/UsersManagement.tsx`, `src/app/api/admin/users/route.ts` |
| **Input Fields** | Username, Email, Password, Role (admin/checker/support), Group Name |
| **Validations** | Email regex, password strength (8+ chars, upper, lower, digit, special), unique username/email |
| **Authorization** | Only users with `admin` role can create new users |
| **Error Handling** | Prisma `P2002` error → "Username or email already exists" (409) |

#### 3.2.3 Menu Management Component

| Attribute | Detail |
|:---|:---|
| **Source File** | `src/components/admin/MenuManagement.tsx`, `src/app/api/menus/route.ts`, `src/app/api/menus/[id]/route.ts` |
| **Operations** | Create (POST), Update (PUT), Delete (DELETE), Approve/Reject (POST with action) |
| **Key Fields** | Name, NameAm, ResponseType, Content, ContentAm, ApiConfig, ParentId, Order, IsActive, SupportAssignee, AttachedMenuIds, KYCFields, TrackClicks, Translations |
| **Maker-Checker Logic** | New menus created with `approvalStatus: 'pending'`. Updates to approved menus are stored in `pendingUpdate` JSON field. Checker role approves/rejects. Self-approval is blocked. |
| **API Config Normalization** | `rootKey` defaults to `'data'`. `tableMappingMode` supports `array_path` and `exact_path`. Endpoint templates validated against mapped KYC field names. |

#### 3.2.4 Report Management Component

| Attribute | Detail |
|:---|:---|
| **Source File** | `src/components/admin/ReportsManagement.tsx`, `src/app/api/reports/route.ts`, `src/app/api/reports/[id]/route.ts` |
| **Create** | Public submission via POST. Generates sequential ID from `ReportIdConfig` (prefix + year + padded sequence). Auto-assigns `supportAssignee` from menu config. Creates `ReportActivity` entries for creation and assignment. |
| **Update (PATCH)** | Admin can change status, priority, supportAssignee, adminResponse, internalNotes. Support can only update reports assigned to them; cannot change priority. Escalation requires `supportAssignmentType` and `supportAssignmentReason`. |
| **Delete** | Admin-only. Requires CSRF token. |
| **Activity Logging** | Activities of type: `creation`, `assignment`, `response`, `resolution`, `escalation` are created automatically on state changes. |

#### 3.2.5 Application Settings Component

| Attribute | Detail |
|:---|:---|
| **Source File** | `src/app/api/app-settings/route.ts` |
| **Managed Settings** | Supported languages (JSON array), system translations (JSON object), bot/user avatar configuration (type + text/image), app logo, report ID configuration, show/hide admin panel icon |
| **Image Handling** | Base64 data URLs are decoded, validated (PNG/JPG/WebP/GIF/SVG), size-checked (≤600KB), and persisted to `public/uploads/avatars/` or `public/uploads/branding/` with random filenames. HTTP URLs and existing `/uploads/` paths are passed through. |

### 3.3 Class Diagram

```mermaid
classDiagram
    %% Enumerations
    class ResponseType {
        <<enumeration>>
        static
        api
        report
    }
    class MenuApprovalStatus {
        <<enumeration>>
        pending
        approved
        rejected
    }
    class KYCFieldType {
        <<enumeration>>
        text
        number
        tel
        email
        password
        boolean
    }
    class ReportStatus {
        <<enumeration>>
        pending
        reviewed
        resolved
    }
    class ReportPriority {
        <<enumeration>>
        low
        medium
        high
        urgent
    }
    class LogStatus {
        <<enumeration>>
        success
        failed
        error
    }
    class AdminRole {
        <<enumeration>>
        admin
        checker
        support
    }

    %% Classes
    class MenuItem {
        -String id
        -String parentId
        -String name
        -String nameAm
        -ResponseType responseType
        -String content
        -Json apiConfig
        -String supportAssignee
        -Int order
        -Boolean isActive
        -MenuApprovalStatus approvalStatus
        -Boolean trackClicks
        -Int clickCount
        -Int sessionClickCount
        -Json pendingUpdate
        -DateTime createdAt
        -DateTime updatedAt
        +create(data: Object) MenuItem
        +update(id: String, data: Object) MenuItem
        +delete(id: String) Boolean
        +get(id: String) MenuItem
        +getAll() MenuItem[]
        +approve(id: String) Boolean
        +reject(id: String, reason: String) Boolean
    }

    class MenuAttachment {
        -Int id
        -String menuId
        -String attachedMenuId
        -DateTime createdAt
    }

    class KYCField {
        -String id
        -String name
        -String prompt
        -String promptAm
        -KYCFieldType type
        -String validation
        -Int order
        -Boolean required
        -DateTime createdAt
        -DateTime updatedAt
        +upsert(data: Object) KYCField
        +delete(id: String) Boolean
    }

    class MenuKYC {
        -Int id
        -String menuId
        -String kycId
        -Int order
    }

    class UserReport {
        -String id
        -String userId
        -String menuId
        -String menuName
        -Json data
        -ReportStatus status
        -ReportPriority priority
        -String adminResponse
        -String internalNotes
        -String supportAssignee
        -Int serviceRating
        -DateTime timestamp
        -DateTime createdAt
        +submit(data: Object) UserReport
        +updateStatus(id: String, status: ReportStatus) UserReport
        +addAdminResponse(id: String, response: String) UserReport
        +assignToSupport(id: String, assignee: String) UserReport
    }

    class ReportActivity {
        -Int id
        -String reportId
        -String type
        -String actor
        -String target
        -String content
        -DateTime timestamp
        +logActivity(reportId: String, type: String, actor: String) ReportActivity
    }

    class AppSettings {
        -Int id
        -Json supportedLanguages
        -Json systemTranslations
        -String botAvatarType
        -String botAvatarImage
        -String appLogo
        -Boolean showAdminPanelIcon
        +getSettings() AppSettings
        +updateSettings(data: Object) AppSettings
    }

    class ReportIdConfig {
        -Int id
        -String prefix
        -Boolean yearEnabled
        -Int numberLength
        -Int startValue
        -Boolean resetEveryYear
    }

    class AdminCredential {
        -Int id
        -String username
        -String email
        -String passwordHash
        -AdminRole role
        -String groupName
        -DateTime createdAt
        +login(username: String, password: String) Object
        +register(data: Object) AdminCredential
        +changePassword(oldPass: String, newPass: String) Boolean
    }

    class AdminRecoveryToken {
        -String token
        -String username
        -DateTime expiresAt
        -Boolean consumed
        +generate(username: String) AdminRecoveryToken
        +verifyAndConsume(token: String) Boolean
    }

    class InteractionLog {
        -Int id
        -String sessionId
        -String userMessage
        -String botResponse
        -LogStatus status
        -Int responseTime
        -DateTime timestamp
        +logInteraction(data: Object) InteractionLog
        +getLogs() InteractionLog[]
    }

    class ClickHistory {
        -Int id
        -String menuId
        -String sessionId
        -DateTime clickedAt
        +recordClick(menuId: String, sessionId: String) ClickHistory
    }

    %% Relationships
    MenuItem "1" -- "0..*" MenuItem : association
    MenuItem *-- "0..*" MenuAttachment : composition
    MenuItem *-- "0..*" MenuKYC : composition
    KYCField "1" -- "0..*" MenuKYC : association
    MenuItem "1" -- "0..*" UserReport : association
    MenuItem *-- "0..*" ClickHistory : composition
    UserReport *-- "0..*" ReportActivity : composition
    AppSettings o-- "0..1" ReportIdConfig : aggregation
    AdminCredential "1" -- "0..*" AdminRecoveryToken : association
```

### 3.4 Component Diagram

```mermaid
graph TB
    subgraph "Presentation Layer"
        ChatUI["ChatInterface.tsx<br/>ChatBubble.tsx"]
        AdminUI["AdminLoginPage.tsx<br/>Dashboard.tsx<br/>MenuManagement.tsx<br/>ReportsManagement.tsx<br/>UsersManagement.tsx<br/>LocalizationManagement.tsx<br/>LogViewer.tsx"]
        SharedUI["Radix UI Components<br/>WysiwygEditor.tsx<br/>ThemeToggle.tsx"]
    end

    subgraph "API Layer (Next.js App Router)"
        MenuAPI["/api/menus"]
        ReportAPI["/api/reports"]
        AuthAPI["/api/admin/auth/*"]
        UserAPI["/api/admin/users"]
        SettingsAPI["/api/app-settings"]
        LogAPI["/api/logs"]
        TestAPI["/api/test/*"]
    end

    subgraph "Service Layer (src/lib/)"
        SessionSvc["session.ts<br/>iron-session + CSRF"]
        AuthSvc["auth.ts<br/>bcrypt hashing"]
        EmailSvc["email.ts<br/>Nodemailer SMTP"]
        RecoverySvc["adminRecovery.ts<br/>Token lifecycle"]
        LoggerSvc["logger.ts<br/>Client-side logging"]
        PrismaSvc["prisma.ts<br/>DB Client"]
    end

    subgraph "Infrastructure Layer"
        PG["PostgreSQL"]
        RD["Redis"]
        FS["Local Filesystem<br/>(public/uploads/)"]
    end

    ChatUI --> MenuAPI
    ChatUI --> ReportAPI
    ChatUI --> LogAPI
    AdminUI --> AuthAPI
    AdminUI --> UserAPI
    AdminUI --> MenuAPI
    AdminUI --> ReportAPI
    AdminUI --> SettingsAPI
    AdminUI --> LogAPI

    MenuAPI --> SessionSvc
    MenuAPI --> PrismaSvc
    ReportAPI --> PrismaSvc
    AuthAPI --> AuthSvc
    AuthAPI --> SessionSvc
    AuthAPI --> RecoverySvc
    AuthAPI --> EmailSvc
    UserAPI --> AuthSvc
    SettingsAPI --> PrismaSvc

    PrismaSvc --> PG
    SettingsAPI --> FS
```

---

## 4. Testing

### 4.1 Unit Testing

Not explicitly identified in implementation. No unit test framework configuration (Jest, Vitest, Mocha) or test files (`*.test.ts`, `*.spec.ts`) were found in the codebase.

### 4.2 Integration Testing

Not explicitly identified in implementation. However, the `/api/test/*` route group contains 10 mock endpoints that simulate external API behaviors (balance queries, transactions, exchange rates, multi-KYC flows, profile lookups). These serve as integration test fixtures for validating the dynamic API mapping engine.

### 4.3 System Testing

Not explicitly identified in implementation. No end-to-end test framework (Playwright, Cypress) or test configuration was found.

### 4.4 Acceptance Testing

Not explicitly identified in implementation. No UAT scripts or acceptance criteria documents were found in the codebase.

---

## 5. Deployment

| Attribute | Detail |
|:---|:---|
| **Production Command** | `npm run start` → executes `server.js` with `NODE_ENV=production` on port `3020` (configurable via `PORT`) |
| **Build Command** | `npm run build` → `next build` |
| **Target Platform** | Firebase App Hosting (`apphosting.yaml`, maxInstances: 1) or any Node.js-compatible PaaS |
| **Database Migrations** | `npx prisma db push` (schema push) or `npx prisma migrate deploy` (migration-based) |
| **Seed Data** | `npx tsx prisma/seed.ts` — populates initial menu items, KYC fields, and sample data |
| **Required Environment** | `DATABASE_URL`, `SECRET_COOKIE_PASSWORD` (minimum). Optional: `REDIS_URL`, `SMTP_*`, `ADMIN_INITIAL_*` |

---

## 6. References

| Reference | Location |
|:---|:---|
| Prisma Schema | `prisma/schema.prisma` |
| Custom Server | `server.js` |
| Next.js Configuration | `next.config.ts` |
| Edge Middleware | `middleware.ts` |
| Session Management | `src/lib/session.ts` |
| Authentication | `src/lib/auth.ts` |
| Email Service | `src/lib/email.ts` |
| Recovery Tokens | `src/lib/adminRecovery.ts` |
| Menu API Routes | `src/app/api/menus/route.ts`, `src/app/api/menus/[id]/route.ts` |
| Report API Routes | `src/app/api/reports/route.ts`, `src/app/api/reports/[id]/route.ts` |
| Admin Auth Routes | `src/app/api/admin/auth/login/route.ts`, `src/app/api/admin/auth/session/route.ts` |
| Admin User Routes | `src/app/api/admin/users/route.ts` |
| App Settings Route | `src/app/api/app-settings/route.ts` |
| Interaction Logs Route | `src/app/api/logs/route.ts` |
| Package Dependencies | `package.json` |
| Deployment Config | `apphosting.yaml` |

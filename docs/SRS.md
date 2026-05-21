# Software Requirements Specification (SRS)
**Project Name:** Nibbot  
**Document Version:** 1.0  
**Generated via Codebase Reverse-Engineering**  

---

## 1. Executive Summary
The Nibbot application is a comprehensive, real-time conversational bot platform designed to facilitate dynamic user interactions, secure data collection, and automated API routing. Built on a Next.js and Node.js architecture, the system provides end-users with an intuitive chat interface while empowering administrators with a robust dashboard to manage conversational workflows, map KYC (Know Your Customer) requirements, and process support tickets (Reports). This SRS defines the functional and non-functional specifications derived directly from the implemented system architecture.

---

## 2. Business Context and Objectives
The primary objective of the Nibbot system is to automate customer service interactions and data collection through a deterministically configured chat interface. 

**Key Objectives:**
- Enable administrators to visually construct hierarchical conversational menus without code changes.
- Securely collect user data through dynamic KYC forms mapped directly to chat interactions.
- Provide a structured ticketing system for support staff to manage and resolve user-submitted reports.
- Monitor system health and user engagement via real-time WebSocket presence tracking.

---

## 3. Project Scope

### 3.1 In-Scope
Based on the implemented codebase, the following features are actively supported:
- **Dynamic Menu Engine:** Creation of hierarchical menus (parent-child relationships) and associated action responses (Static, API, Report).
- **KYC Data Collection:** Configurable input fields (text, number, boolean, telephone, email, password) injected into the chat flow.
- **API Response Mapping:** Capability to map external/internal API JSON responses into UI tables based on administrative configuration (`tableMappingMode`).
- **Support Ticketing System:** Automatic generation of sequential report IDs (e.g., `NIB-2026-0001`) with complete status lifecycles and activity logging.
- **Real-Time Analytics:** Live tracking of concurrent online users utilizing Socket.io and Redis TTL polling.
- **Role-Based Access Control (RBAC):** Distinct permissions for Admin, Checker, and Support roles.

### 3.2 Out-of-Scope
- External CRM integrations (Not explicitly identified in implementation).
- Native Mobile Applications (iOS/Android).
- Free-text AI/NLP intent recognition (The implemented system utilizes structured, deterministic menu routing).
- Third-party OAuth logins (Authentication is handled via internal `bcrypt` credentials).

---

## 4. Functional Requirements

### 4.1 Authentication & Authorization
- **FR1.1:** The system must authenticate administrative users against securely hashed (`bcrypt`) credentials stored in the `admin_credentials` table.
- **FR1.2:** The system must issue and manage HTTP-only, secure `iron-session` cookies.
- **FR1.3:** The system must enforce Role-Based Access Control allowing only `Admin` users to manipulate active menu states, while `Support` users manage their assigned reports.

### 4.2 Menu and Conversational Flow Management
- **FR2.1:** The system must allow administrators to define menus with parent-child relationships and attachments.
- **FR2.2:** The system must support attaching specific `KYCField` entities to menus, defining the order and validation rules of data collection in the chat interface.
- **FR2.3:** The system must dynamically validate endpoint templates (e.g., `{{kyc.accountId}}`) against mapped KYC fields before executing API calls.

### 4.3 Report and Ticketing Generation
- **FR3.1:** The system must allow users to submit interactive forms that generate a `UserReport`.
- **FR3.2:** The system must generate deterministically formatted Report IDs based on `app_settings` (e.g., Prefix + Year + Sequence Number).
- **FR3.3:** The system must track all mutations to a report inside the `report_activities` log.

### 4.4 Real-Time Capabilities
- **FR4.1:** The system must establish a persistent WebSocket connection with active client interfaces.
- **FR4.2:** The system must update and broadcast the count of active users using Redis Sorted Sets to track connection lifespans.

---

## 5. Non-Functional Requirements

### 5.1 Security
- **NFR1.1 (CSRF):** All state-mutating API routes must validate an `x-csrf-token` header against the active user session.
- **NFR1.2 (CSP):** The application server must inject a strict Content Security Policy (CSP) utilizing dynamically generated cryptographic nonces for script execution.
- **NFR1.3 (Payloads):** The custom HTTP server must reject payloads exceeding the defined byte limit (1MB default).

### 5.2 Performance & Reliability
- **NFR2.1 (Real-Time Resilience):** If the Redis cache fails, the Socket server must silently disable presence tracking without causing HTTP service degradation.
- **NFR2.2 (Database):** The system must utilize connection pooling (via Prisma) to handle concurrent PostgreSQL operations efficiently.

---

## 6. Stakeholders and Users

| Role | Description |
| :--- | :--- |
| **End User** | Interacts with the public-facing chat interface to navigate menus, query data, and submit reports. |
| **Admin** | Possesses full CRUD capabilities over the entire system configuration, including menus, KYC fields, API mapping, and user management. |
| **Checker** | possesses read-only or verification capabilities over system configurations. |
| **Support** | Restricted to viewing and updating the status of `UserReports` explicitly assigned to them. |

---

## 7. Assumptions, Dependencies, and Constraints

### 7.1 Dependencies
- **PostgreSQL:** Primary relational data store.
- **Redis:** Required exclusively for the "Online Now" real-time presence metric.
- **Node.js Environment:** Required to run the custom combined HTTP/Socket engine.

### 7.2 Assumptions
- The deployment environment permits long-lived WebSocket connections through load balancers or proxies.
- Target audiences possess modern web browsers capable of rendering React-based UI components.

### 7.3 Constraints
- Dynamic API responses mapped into the chat UI are constrained to JSON formatting compatible with the defined `rootKey` and `tableMappingMode` parsers.

---

## 8. High-Level Business Process

### Current State
*Not explicitly identified in implementation. Expected to be manual phone/email support operations.*

### Future State (System Workflow)
1. **Configuration:** Admin logs into the portal and constructs a Menu tree, attaching necessary KYC data fields.
2. **Interaction:** An End User opens the chat UI and selects a menu option.
3. **Data Collection:** The bot prompts the user sequentially for the required KYC inputs.
4. **Resolution:** 
   - *API Route:* The system formats an external request using the KYC data and returns a data table to the user.
   - *Report Route:* The system creates a pending ticket, alerting the Support role via the Admin Dashboard.
5. **Fulfillment:** Support staff reviews the report, updates the status to 'Resolved', and logs the activity.

---

## 9. High-Level Timeline, Risks, and Benefits

### High-Level Timeline

| Phase | Milestone | Status |
| :--- | :--- | :--- |
| **Initiation** | Project Charter & Requirements Gathering | Completed |
| **Design** | HLD and LLD Documentation | Completed |
| **Development** | Core Platform Implementation (Menu Engine, Auth, Reports, Real-Time) | Completed |
| **Testing** | Integration Testing via Mock API Endpoints (`/api/test/*`) | Completed |
| **UAT** | User Acceptance Testing & Security Review | Pending |
| **Deployment** | Production Deployment to Firebase App Hosting / Company Server | Pending |
| **Post-Launch** | Monitoring, Feedback Collection, Iterative Enhancements | Pending |

*Note: Formal project schedule with exact dates is not explicitly defined in the codebase. The above milestones are inferred from implementation maturity.*

### Risks

| Risk | Impact | Likelihood | Mitigation (Observed in Code) |
| :--- | :--- | :--- | :--- |
| Misconfigured API templates by admins | High — could expose internal error traces | Medium | Strict endpoint template validation implemented on `POST /api/menus` |
| Redis cache failure | Medium — loss of real-time presence tracking | Low | Graceful degradation implemented in `server.js`; HTTP service continues |
| Single admin account compromise | High — full system access | Low | Maker-checker workflow, CSRF rotation, session idle timeout (15 min) |
| Database schema drift | Medium — runtime errors | Low | Prisma ORM enforces schema; API returns helpful error on `P2022` |

### Benefits

- **Operational Efficiency:** Reduces human overhead by automating standard customer queries via configurable API mapping.
- **Auditability:** Complete, immutable activity logs for every report state change (creation, assignment, escalation, resolution).
- **Governance Compliance:** Maker-checker workflow ensures no single individual can deploy untested configurations.
- **Security:** Enterprise-grade session handling, CSP policies, CSRF protection, and sensitive data masking protect KYC data streams.

---

## 10. Approval and Sign-Off

*(To be completed by Project Sponsors)*

| Name | Role | Signature | Date |
| :--- | :--- | :--- | :--- |
| ______________ | Project Sponsor | ______________ | ______________ |
| ______________ | Technical Lead | ______________ | ______________ |
| ______________ | Security Officer | ______________ | ______________ |

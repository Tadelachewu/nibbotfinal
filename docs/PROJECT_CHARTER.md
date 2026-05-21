
# PROJECT CHARTER

---

## TalkTree — Conversational AI & Dynamic Menu Management Platform

---

| | |
|--------------------------|--------------------------------------------------------------|
| **Document Title**       | Project Charter — TalkTree Platform                          |
| **Document ID**          | PC-TALKTREE-2026-001                                         |
| **Version**              | 1.0                                                          |
| **Status**               | Final Draft                                                  |
| **Classification**       | Internal — Confidential                                      |
| **Date**                 | May 13, 2026                                                 |
| **Prepared By**          | `[YOUR NAME — TO BE COMPLETED]`                              |
| **Department**           | `[DEPARTMENT NAME — TO BE COMPLETED]`                        |
| **Approved By**          | `[DIRECTOR NAME — TO BE COMPLETED]`                          |
| **Organization**         | Nib International Bank S.C.                                  |

---

### Document Control

| Version | Date           | Author                             | Change Description        |
|---------|----------------|-------------------------------------|---------------------------|
| 0.1     | `[DATE]`       | `[AUTHOR]`                          | Initial draft              |
| 1.0     | May 13, 2026   | `[YOUR NAME — TO BE COMPLETED]`     | Final draft for review     |

### Approval Sign-Off

| Role                  | Name                                  | Signature | Date |
|-----------------------|---------------------------------------|-----------|------|
| Project Manager       | `[TO BE COMPLETED]`                   |           |      |
| Project Sponsor       | `[TO BE COMPLETED]`                   |           |      |
| Director of IT/Digital| `[TO BE COMPLETED]`                   |           |      |

---

## Table of Contents

1. [High-Level Project Structure](#1-high-level-project-structure)
2. [Project Description](#2-project-description)
3. [Objectives (Purpose)](#3-objectives-purpose)
4. [Scope](#4-scope)
5. [Project Success Criteria](#5-project-success-criteria)
6. [Project Requirements](#6-project-requirements)
7. [High-Level Milestones](#7-high-level-milestones)
8. [Deliverables](#8-deliverables)
9. [Assumptions](#9-assumptions)
10. [Constraints](#10-constraints)
11. [Initial Risks](#11-initial-risks)
12. [Stakeholders](#12-stakeholders)
13. [Estimated Budget](#13-estimated-budget)
14. [Project Manager Role & Authority](#14-project-manager-role--authority)

---

## 1. High-Level Project Structure

TalkTree is architected as a unified full-stack web platform composed of the following major subsystems:

| Subsystem                     | Purpose                                                                                       |
|-------------------------------|-----------------------------------------------------------------------------------------------|
| **User Chatbot Interface**    | A web-based conversational interface that serves dynamic menus, executes live API transactions, collects customer data, and enables report/ticket submissions. |
| **Admin Console**             | A role-based management dashboard for configuring all chatbot behavior, managing reports, monitoring analytics, and administering users — without writing code. |
| **Real-Time Engine**          | A custom Node.js server providing WebSocket-based live presence tracking and real-time dashboard metrics via Redis. |
| **Database Layer**            | A PostgreSQL relational database managed through Prisma ORM, storing menus, reports, user sessions, admin credentials, and application settings. |
| **Mock Banking API**          | A companion Express.js service simulating banking endpoints for demonstration and testing of API integration capabilities. |

### Technology Stack

| Layer                  | Technology                                         |
|------------------------|----------------------------------------------------|
| Frontend Framework     | Next.js 16 (App Router) + React 19                 |
| UI Component Library   | Tailwind CSS + Shadcn/ui (36 reusable components)  |
| Backend / API          | Next.js API Routes (RESTful, 20+ endpoints)        |
| Database               | PostgreSQL via Prisma ORM v7.5                      |
| Real-Time              | Socket.io (WebSockets) + Redis                      |
| Authentication         | iron-session (encrypted server-side cookies) + bcrypt |
| Email Service          | Nodemailer (SMTP)                                   |
| Rich Content Editor    | TipTap WYSIWYG (12 extensions)                      |
| Data Visualization     | Recharts                                            |
| Hosting Target         | Firebase App Hosting                                |

---

## 2. Project Description

TalkTree is a **production-grade, no-code Conversational AI and Dynamic Menu Management Platform** developed for Nib International Bank S.C. The system empowers non-technical bank administrators to build, configure, and manage a customer-facing chatbot entirely through a visual dashboard — eliminating the need for developer intervention when adding new services, integrating APIs, or updating content.

The platform serves two primary audiences:

- **Bank Customers** interact with an intelligent chatbot interface that guides them through hierarchical service menus, executes real-time banking API calls (e.g., balance inquiries, exchange rates), collects required customer information via conversational forms, and enables submission of service requests or fraud reports.

- **Bank Administrators** manage all chatbot behavior through a secure, role-based console featuring six functional modules: Dashboard Analytics, Menu Management, Report/Ticket Management, User Administration, Localization (Multi-Language), and Interaction Logs.

The system features a **dual-language interface** (English and Amharic) with a fully translatable UI framework, **real-time presence tracking** showing live active users on the admin dashboard, and a **three-role access control model** (Admin, Checker, Support) ensuring operational governance and separation of duties.

---

## 3. Objectives (Purpose)

| #   | Objective                                                                                              |
|-----|-------------------------------------------------------------------------------------------------------|
| O1  | Deliver a no-code chatbot platform that enables bank administrators to configure customer-facing services without developer involvement. |
| O2  | Integrate with the bank's existing REST APIs to provide real-time transactional capabilities (balance checks, exchange rates, account lookups) directly within the chatbot. |
| O3  | Implement dynamic Know Your Customer (KYC) data collection through conversational forms with field-level validation. |
| O4  | Provide a structured report and ticket submission system with full lifecycle management (pending → reviewed → resolved). |
| O5  | Deliver real-time operational metrics through a live analytics dashboard with WebSocket-based presence tracking. |
| O6  | Support bilingual user experience (English and Amharic) with an extensible localization framework. |
| O7  | Enforce role-based access control (Admin, Checker, Support) to ensure operational governance and separation of duties. |
| O8  | Implement production-grade security standards including CSP, CSRF protection, session management, and encrypted credential storage. |

---

## 4. Scope

### 4.1 In-Scope

**Customer-Facing Chatbot**

- Hierarchical, tree-based menu navigation with parent/child relationships
- Three response engines:
  - **Static Content** — Rich HTML content served via WYSIWYG-authored entries
  - **API Action** — Live external API calls with configurable authentication (API Key, Bearer Token, Basic Auth)
  - **Report Submission** — Structured ticket/request forms with auto-generated reference IDs
- Dynamic KYC data collection with sequential prompts and field-type validation (text, number, phone, email, password, boolean)
- Dual API response mapping: Message Templates and Auto-Generated Data Tables
- Two mapping engines: Exact Path (Unified) and Array Path (Legacy)
- Report status lookup by reference ID
- Anonymous user sessions (no customer login required)
- Bilingual interface (English / Amharic) with real-time language switching
- Dark/light theme support
- Online/offline connectivity detection
- Menu interaction click tracking (total and unique sessions)

**Admin Console**

- Secure login with session-based authentication
- Six management modules:
  - **Dashboard** — Real-time metrics (online users, pending tasks, urgent triage, resolved cases), pie/bar charts
  - **Menu Management** — Full CRUD operations with WYSIWYG editor, API configuration wizard, KYC field builder, menu attachments, approval workflows
  - **Submissions** — Report lifecycle management with priority levels, admin responses, internal notes, support assignment, activity timeline
  - **User Administration** — Admin credential management with role and group assignment
  - **Localization** — System translation key management for all UI strings
  - **Interaction Logs** — Session-level chatbot interaction analytics
- Menu approval workflow (Admin creates → Checker reviews → approved/rejected)
- Password change and email-based password recovery
- CSRF token rotation on all state-changing operations

**Backend Infrastructure**

- 20+ RESTful API endpoints
- PostgreSQL database with 17 data models and 8 enumerations
- Custom Node.js server with integrated Socket.io WebSocket support
- Redis-backed real-time presence tracking with time-to-live purging
- Automated database seeding with demo data

**Companion Services**

- Express.js mock banking API for demonstration and testing
- Firebase App Hosting configuration for cloud deployment

### 4.2 Out-of-Scope

The following items are **not** included in the current release:

| Item                                    | Notes                                                         |
|-----------------------------------------|---------------------------------------------------------------|
| Customer authentication / login         | System uses anonymous browser sessions                        |
| AI / Natural Language Processing        | AI module is scaffolded for future use but not currently active|
| File upload within chatbot              | Not implemented in current version                            |
| Push notifications                      | Not implemented                                               |
| Multi-tenant (multi-organization) mode  | System is designed for single-organization deployment         |
| Mobile native application               | Web-only (responsive design for mobile browsers)              |
| Automated test suite                    | No automated tests included in current release                |
| CI/CD deployment pipeline               | Not configured; manual deployment process                     |
| API rate limiting                       | Not implemented in current version                            |

---

## 5. Project Success Criteria

| #   | Criterion                                                                                          | Verification Method                                      |
|-----|----------------------------------------------------------------------------------------------------|----------------------------------------------------------|
| SC1 | Users can navigate the chatbot menu hierarchy and receive content-rich static responses.            | Functional walkthrough of the chatbot interface           |
| SC2 | Admins can configure API-connected menu items that execute live external API calls and render structured responses. | End-to-end test: create API menu → verify chatbot output |
| SC3 | KYC prompts appear sequentially, validate input, and inject collected values into API endpoints.    | Configure KYC-enabled menu, verify variable substitution  |
| SC4 | Users can submit reports/tickets and receive a unique reference ID; admins can manage the full report lifecycle. | Submit report via chat, verify in admin Submissions tab    |
| SC5 | Real-time "Online Now" counter on the admin dashboard accurately reflects connected user sessions.  | Open multiple browser sessions, verify live counter        |
| SC6 | Role-based access control correctly restricts each role to its designated console view.             | Login with admin/checker/support credentials separately    |
| SC7 | Language toggle switches all UI labels and system messages between English and Amharic.             | Toggle language, verify all visible strings change          |
| SC8 | System serves with production security headers (CSP, HSTS, CSRF, X-Frame-Options).                | HTTP response header inspection                            |
| SC9 | `[ADDITIONAL CRITERIA — TO BE COMPLETED BY PROJECT SPONSOR]`                                       |                                                            |

---

## 6. Project Requirements

### 6.1 Functional Requirements

| ID    | Requirement                                                                                              |
|-------|----------------------------------------------------------------------------------------------------------|
| FR-01 | The system shall render a hierarchical menu tree from database-stored menu item records.                  |
| FR-02 | The system shall support three response types: Static Content, API Action, and Report Submission.         |
| FR-03 | API Action menus shall support GET and POST methods with configurable authentication (None, API Key, Basic Auth, Bearer Token). |
| FR-04 | The system shall collect user data via sequential KYC prompts with field-type validation before API execution. |
| FR-05 | API responses shall be mappable to message templates (using `{{variable}}` syntax) or auto-generated data tables. |
| FR-06 | The system shall generate unique, configurable report reference IDs (e.g., NIB-2026-100001).              |
| FR-07 | The admin console shall enforce role-based access control with three defined roles: Admin, Checker, and Support. |
| FR-08 | The system shall track real-time user presence using WebSockets and Redis with automatic session expiry.   |
| FR-09 | The system shall support bilingual UI (English and Amharic) with an extensible translation framework.     |
| FR-10 | Administrators shall be able to create, update, delete, activate, and deactivate menus through the admin console. |
| FR-11 | The system shall support a menu approval workflow where changes are reviewed by a Checker role before publication. |
| FR-12 | Administrator password recovery shall be supported via a secure email-based token mechanism.               |

### 6.2 Non-Functional Requirements

| ID     | Category        | Requirement                                                                                            |
|--------|-----------------|--------------------------------------------------------------------------------------------------------|
| NFR-01 | Security        | The system shall enforce Content Security Policy (CSP) with nonce-based script execution.              |
| NFR-02 | Security        | All state-changing admin operations shall be protected by CSRF token validation with automatic rotation.|
| NFR-03 | Security        | The system shall set HTTP security headers: HSTS, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), COEP, COOP, CORP. |
| NFR-04 | Security        | Passwords shall be hashed using bcrypt with a minimum of 10 salt rounds.                               |
| NFR-05 | Security        | Admin sessions shall enforce configurable idle timeouts (default: 15 minutes).                         |
| NFR-06 | Security        | Sensitive data (passwords, tokens, PINs) shall be masked in all interaction logs.                      |
| NFR-07 | Security        | API request body size shall be limited to 1MB by default with Content-Type validation.                 |
| NFR-08 | Performance     | User presence tracking shall use Redis sorted sets with 20-second TTL purging for precise metrics.     |
| NFR-09 | Availability    | The system shall degrade gracefully if Redis is unavailable — core chatbot functionality shall remain operational. |
| NFR-10 | Usability       | The interface shall be responsive and functional on both desktop and mobile browsers.                  |
| NFR-11 | Maintainability | `[ADDITIONAL NFRs — TO BE COMPLETED AS NEEDED]`                                                        |

---

## 7. High-Level Milestones

| #   | Milestone                              | Target Date                          | Status                  |
|-----|----------------------------------------|--------------------------------------|-------------------------|
| M1  | Core Menu System & Chat UI             | `[TO BE COMPLETED]`                  | ✅ Complete              |
| M2  | API Integration Engine                 | `[TO BE COMPLETED]`                  | ✅ Complete              |
| M3  | Admin Console & Authentication         | `[TO BE COMPLETED]`                  | ✅ Complete              |
| M4  | Report/Ticket Submission System        | `[TO BE COMPLETED]`                  | ✅ Complete              |
| M5  | Real-Time Infrastructure (WebSocket + Redis) | `[TO BE COMPLETED]`            | ✅ Complete              |
| M6  | Localization & Multi-Language Support  | `[TO BE COMPLETED]`                  | ✅ Complete              |
| M7  | Security Hardening                     | `[TO BE COMPLETED]`                  | ✅ Complete              |
| M8  | Menu Approval Workflow                 | `[TO BE COMPLETED]`                  | ✅ Complete              |
| M9  | Mock Banking API & Demo Scenarios      | `[TO BE COMPLETED]`                  | ✅ Complete              |
| M10 | User Acceptance Testing (UAT)          | `[TO BE COMPLETED]`                  | `[TO BE COMPLETED]`     |
| M11 | Production Deployment                  | `[TO BE COMPLETED]`                  | `[TO BE COMPLETED]`     |
| M12 | Post-Launch Support & Monitoring       | `[TO BE COMPLETED]`                  | `[TO BE COMPLETED]`     |

---

## 8. Deliverables

| #   | Deliverable                                    | Type                | Status           |
|-----|------------------------------------------------|---------------------|------------------|
| D1  | User-Facing Chatbot Web Application            | Web Application     | ✅ Delivered      |
| D2  | Admin Console (6 Management Modules)           | Web Application     | ✅ Delivered      |
| D3  | RESTful API Layer (20+ endpoints)              | API Service         | ✅ Delivered      |
| D4  | Custom Real-Time Node.js Server                | Server Application  | ✅ Delivered      |
| D5  | PostgreSQL Database Schema (17 models)         | Database            | ✅ Delivered      |
| D6  | Database Seed Script (demo data)               | Utility             | ✅ Delivered      |
| D7  | Mock Banking API Server                        | Companion Service   | ✅ Delivered      |
| D8  | Reusable UI Component Library (36 components)  | UI Library          | ✅ Delivered      |
| D9  | API Documentation & Test Guide                 | Documentation       | ✅ Delivered      |
| D10 | Business Presentation Document                 | Documentation       | ✅ Delivered      |
| D11 | Project Charter                                | Documentation       | ✅ Delivered      |
| D12 | Firebase App Hosting Configuration             | Infrastructure      | ✅ Delivered      |
| D13 | User Acceptance Testing (UAT) Report           | Documentation       | `[TO BE COMPLETED]` |
| D14 | Production Deployment Guide                    | Documentation       | `[TO BE COMPLETED]` |
| D15 | System Administration Manual                   | Documentation       | `[TO BE COMPLETED]` |

---

## 9. Assumptions

| #   | Assumption                                                                                                  |
|-----|-------------------------------------------------------------------------------------------------------------|
| A1  | The primary deployment target is Nib International Bank S.C. as a single-organization platform.              |
| A2  | End-user customers do not require authentication to interact with the chatbot; anonymous browser sessions are acceptable. |
| A3  | The admin console will be operated by a small, designated team of internal bank staff.                        |
| A4  | Amharic is the primary secondary language; the localization framework supports future language additions.     |
| A5  | Redis is available in the production environment for real-time presence tracking; if unavailable, the system degrades gracefully. |
| A6  | The mock banking API is for demonstration and testing purposes only; production will connect to real banking APIs. |
| A7  | The AI/NLP module (Genkit) is reserved for a future phase and is not part of the current release scope.      |
| A8  | The bank's IT infrastructure supports PostgreSQL databases and Node.js runtime environments.                 |
| A9  | `[ADDITIONAL ASSUMPTIONS — TO BE COMPLETED]`                                                                 |

---

## 10. Constraints

| #   | Constraint                                                                                                |
|-----|-----------------------------------------------------------------------------------------------------------|
| C1  | **Runtime Environment**: Requires Node.js version 18.x or higher.                                         |
| C2  | **Database**: PostgreSQL is the only supported database engine.                                             |
| C3  | **Real-Time Server**: The custom Node.js server (`server.js`) must be used instead of the standard Next.js dev server to support WebSocket connections. |
| C4  | **Hosting**: Firebase App Hosting is configured with a maximum of 1 instance.                              |
| C5  | **Session Security**: A `SECRET_COOKIE_PASSWORD` environment variable must be configured for session encryption. |
| C6  | **Single Tenant**: The system is designed for single-organization deployment; multi-tenant support would require architectural changes. |
| C7  | **Initial Setup**: Admin credentials must be seeded via the database seed script; there is no self-registration for administrators. |
| C8  | **Request Limits**: API request bodies are limited to 1MB by default.                                      |
| C9  | `[ADDITIONAL CONSTRAINTS — TO BE COMPLETED]`                                                               |

---

## 11. Initial Risks

| #   | Risk Description                                                     | Severity | Likelihood | Mitigation Strategy                                         |
|-----|----------------------------------------------------------------------|----------|------------|--------------------------------------------------------------|
| R1  | Framework dependency on a pre-release (canary) version of Next.js may introduce instability. | High     | Medium     | Evaluate upgrading to a stable release before production deployment. |
| R2  | TypeScript build errors are suppressed in configuration, potentially masking runtime issues. | High     | High       | Enable strict type checking and resolve all errors before launch. |
| R3  | No automated test suite exists, increasing the risk of undetected regressions. | High     | High       | Develop a minimum viable test suite covering critical API and UI paths. |
| R4  | Single-instance hosting configuration creates a single point of failure. | Medium   | Medium     | Increase `maxInstances` in hosting configuration for production. |
| R5  | Large component files (e.g., 173KB Menu Management) increase maintenance complexity. | Medium   | High       | Plan for code modularization in a future refactoring phase. |
| R6  | WebSocket CORS policy currently accepts all origins.                  | Medium   | Low        | Restrict allowed origins to the production domain before launch. |
| R7  | Redis unavailability disables real-time presence metrics.             | Low      | Medium     | Graceful degradation is implemented; core functionality unaffected. |
| R8  | `[ADDITIONAL RISKS — TO BE COMPLETED]`                               |          |            |                                                              |

---

## 12. Stakeholders

| #   | Role                          | Name / Contact                          | Responsibility                                        |
|-----|-------------------------------|-----------------------------------------|-------------------------------------------------------|
| S1  | Project Sponsor               | `[TO BE COMPLETED]`                     | Strategic oversight, funding approval, final sign-off  |
| S2  | Director of IT / Digital      | `[TO BE COMPLETED]`                     | Technical governance and infrastructure alignment      |
| S3  | Project Manager               | `[TO BE COMPLETED]`                     | Day-to-day project execution and stakeholder reporting |
| S4  | Lead Developer                | `[TO BE COMPLETED]`                     | Technical delivery, architecture decisions             |
| S5  | System Administrator (Admin)  | Seeded user: `admin`                    | Full platform administration via Admin console         |
| S6  | Menu Reviewer (Checker)       | Seeded user: `checker`                  | Review and approve/reject menu changes                 |
| S7  | Support Agent                 | `[TO BE ASSIGNED]`                      | Handle customer reports and ticket resolution           |
| S8  | Business Analyst / QA         | `[TO BE COMPLETED]`                     | Requirements validation and acceptance testing          |
| S9  | End Users (Bank Customers)    | General Public                          | Interact with the chatbot interface                     |
| S10 | `[ADDITIONAL STAKEHOLDERS]`   | `[TO BE COMPLETED]`                     |                                                        |

---

## 13. Estimated Budget

| Category                          | Estimated Cost                      |
|-----------------------------------|-------------------------------------|
| Development (Labor)               | `[TO BE COMPLETED]`                 |
| Infrastructure (Hosting, DB)      | `[TO BE COMPLETED]`                 |
| Third-Party Services (Redis, SMTP)| `[TO BE COMPLETED]`                 |
| Testing & QA                      | `[TO BE COMPLETED]`                 |
| Training & Documentation          | `[TO BE COMPLETED]`                 |
| Contingency (%)                   | `[TO BE COMPLETED]`                 |
| **Total Estimated Budget**        | **`[TO BE COMPLETED]`**             |

> *Note: Budget details are not maintained within the codebase. The above table is provided as a template for the project sponsor to complete.*

---

## 14. Project Manager Role & Authority

### Role Definition

| Attribute               | Detail                                                                  |
|--------------------------|-------------------------------------------------------------------------|
| **Assigned PM**          | `[TO BE COMPLETED]`                                                     |
| **Reporting Line**       | `[TO BE COMPLETED]`                                                     |
| **Authority Level**      | `[TO BE COMPLETED — e.g., Full / Limited / Advisory]`                   |

### Responsibilities

1. Oversee end-to-end project delivery from development through production deployment.
2. Manage project scope, schedule, budget, and quality.
3. Serve as the primary point of contact between the development team and executive stakeholders.
4. Escalate risks and issues to the Project Sponsor in a timely manner.
5. Coordinate User Acceptance Testing (UAT) and production readiness reviews.
6. Ensure all deliverables meet organizational standards before release.

### Decision Authority

| Decision Area                              | Authority Level                          |
|--------------------------------------------|------------------------------------------|
| Feature scope changes                      | `[TO BE COMPLETED — e.g., Requires Sponsor Approval]` |
| Budget allocation (within approved limits) | `[TO BE COMPLETED]`                      |
| Team resource assignment                   | `[TO BE COMPLETED]`                      |
| Production deployment go/no-go             | `[TO BE COMPLETED]`                      |
| Vendor/third-party selection               | `[TO BE COMPLETED]`                      |

---

## Appendix A: Glossary

| Term            | Definition                                                                                  |
|-----------------|----------------------------------------------------------------------------------------------|
| **KYC**         | Know Your Customer — a process of collecting and validating customer identity information.    |
| **CSP**         | Content Security Policy — an HTTP header that restricts resource loading to prevent XSS.     |
| **CSRF**        | Cross-Site Request Forgery — an attack prevented by token-based request validation.          |
| **HSTS**        | HTTP Strict Transport Security — forces HTTPS connections.                                   |
| **WebSocket**   | A protocol providing full-duplex real-time communication between client and server.          |
| **Redis**       | An in-memory data store used for caching and real-time presence tracking.                    |
| **Prisma ORM**  | An Object-Relational Mapping tool for type-safe database access.                             |
| **Socket.io**   | A library enabling real-time, bidirectional event-based communication.                       |
| **WYSIWYG**     | What You See Is What You Get — a rich text editor for visual content authoring.              |
| **TTL**         | Time-To-Live — automatic expiry mechanism used for session presence tracking.                |

---

## Appendix B: Reference Documents

| #   | Document                              | Location / Status                              |
|-----|---------------------------------------|-------------------------------------------------|
| 1   | API Documentation & Test Guide        | `docs/API_GUIDE.md`                             |
| 2   | Business Presentation                 | `docs/business_presentation.md`                 |
| 3   | System Architecture Blueprint         | `docs/blueprint.md`                             |
| 4   | Response Mapping Technical Notes      | `docs/response-mapping-notes.md`                |
| 5   | Database Schema                       | `prisma/schema.prisma`                          |
| 6   | Environment Configuration Template   | `.env.example`                                   |
| 7   | User Acceptance Testing (UAT) Plan    | `[TO BE COMPLETED]`                             |
| 8   | Production Deployment Guide           | `[TO BE COMPLETED]`                             |

---

*— End of Document —*

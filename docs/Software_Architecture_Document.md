# Software Architecture Document (SAD)
## Nibbot Platform

---

### 1. Introduction

#### 1.1 Purpose
This document provides a comprehensive architectural overview of the Nibbot platform. It serves to communicate the system's structural design, deployment topology, and core technical decisions to stakeholders, software engineers, security auditors, and system administrators.

#### 1.2 Scope
The scope of this document covers the entire Nibbot chatbot ecosystem, including the customer-facing conversational interfaces, the administrative dashboard, real-time presence mechanisms, data persistence layers, and external integration points (such as AI models and Core Banking mock APIs).

---

### 2. Architectural Representation

The system architecture follows a tiered security model, strictly dividing public internet traffic from internal business logic and data persistence. 

Below is the standard representation of the architecture mapping the deployment topology and data flow:

```mermaid
flowchart TD
    %% Define Styles to match the design template
    classDef userBox fill:#F4F8FC,stroke:#4A90E2,stroke-width:1px,color:#000
    classDef routerBox fill:#FFFFFF,stroke:#9013FE,stroke-width:1.5px,color:#000
    classDef firewall fill:#FFFFFF,stroke:#D0021B,stroke-width:1.5px,color:#D0021B
    classDef frontend fill:#FFFFFF,stroke:#417505,stroke-width:1.5px,color:#417505
    classDef backend fill:#FFFFFF,stroke:#4A90E2,stroke-width:1.5px,color:#4A90E2
    classDef middleware fill:#FFFFFF,stroke:#50E3C2,stroke-width:1.5px,color:#008B8B
    classDef dbLayer fill:#F4F8FC,stroke:#4A90E2,stroke-width:1.5px,color:#000
    classDef dmzZone fill:#FFF5EA,stroke:#F5A623,stroke-width:2px,color:#000
    classDef intZone fill:#F2FAF5,stroke:#417505,stroke-width:2px,color:#000

    USER["👤 USER<br/><span style='font-size:10px'>Customer / End User</span>"]:::userBox
    Browser["🖥️ Browser"]:::userBox
    Internet(("🌐 Internet")):::userBox

    USER -- "Https / Public Access" --> Browser
    Browser <--> Internet

    subgraph DMZ ["DMZ ZONE (Public Zone)"]
        direction LR
        Edge["Edge Router /<br/>Load Balancer"]:::routerBox
        FW1["🧱 Firewall"]:::firewall
        FE["💻 Frontend<br/><span style='font-size:10px'>(Next.js React UI)</span>"]:::frontend
        BE["⚙️ Backend<br/><span style='font-size:10px'>(Next.js API & Socket.IO)</span>"]:::backend
        MW["🛠️ Middleware<br/><span style='font-size:10px'>(Node server.js & Rate Limiter)</span>"]:::middleware

        Edge <--> FW1
        FW1 <--> FE
        FE <--> BE
        BE <--> MW
    end

    Internet <--> Edge

    subgraph INTERNAL ["INTERNAL NETWORK"]
        direction TB
        FW2["🧱 Firewall"]:::firewall
        
        CoreServices["Nibbot Core Services<br/><span style='font-size:10px'>Prisma ORM & Auth Layer</span>"]:::backend
        
        subgraph DBLayer ["DATABASE LAYER"]
            DB[("🛢️ DB<br/><span style='font-size:10px'>PostgreSQL & Redis</span>")]:::dbLayer
        end
        
        BankingSys["🏦 Core Banking System<br/><span style='font-size:10px'>(Mock Express.js API)</span>"]:::backend

        FW2 <--> CoreServices
        CoreServices <-->|"Read/Write"| DBLayer
        CoreServices <-->|"Core Banking Transactions"| BankingSys
    end

    %% Link the DMZ Backend to the Internal Network Firewall
    BE <-->|"Business Service Requests"| FW2

    %% Apply Subgraph Styles
    class DMZ dmzZone
    class INTERNAL intZone
    class DBLayer dbLayer
```

---

### 3. Architectural Goals and Constraints

- **Security & Perimeter Defense:** The system mandates a strict separation between the DMZ and the Internal Network. Administrative endpoints must be protected by anti-spoofing IP mechanisms, rate limiting, and HTTP-only encrypted session cookies.
- **Real-Time Responsiveness:** The platform must support instantaneous live chat and presence tracking using full-duplex WebSockets.
- **Scalability:** Next.js API routes are designed statelessly to support horizontal scaling, utilizing Redis as the centralized state manager for sessions and rate locks.
- **Extensibility:** The system's integration layers (particularly the LLM integration) are abstracted, ensuring the capability to transition from external AI providers to internally hosted Retrieval-Augmented Generation (RAG) models seamlessly.

---

### 4. Logical View

The Logical View describes the functional components of the system across the two main network zones.

#### 4.1 DMZ (Public Zone) Components
- **Edge Router / Load Balancer:** The primary gateway for incoming internet traffic, responsible for SSL termination and traffic distribution.
- **Frontend (Next.js React UI):** Serves the Next.js Client Components (React 19). It renders both the anonymous customer-facing chat widget and the secure administrative dashboard.
- **Backend (Next.js App Router):** Handles Server-Side Rendering (SSR) and processes incoming REST API requests (`/api/*`).
- **Middleware (Custom Node `server.js`):** A wrapper executing alongside the Next.js instance. It enforces global rate limits, checks request payload limits, injects secure unforgeable client IP headers (`x-direct-client-ip`), and mounts the Socket.IO real-time engine.

#### 4.2 Internal Network Components
- **Nibbot Core Services:** The central business logic tier handling payload validation (via Zod), entity state management, identity verification, and object-relational mapping (Prisma ORM).
- **Database Layer:**
  - *PostgreSQL:* The primary relational persistent storage. Manages structural data such as User Reports, Chat Logs, Dynamic Menus, and encrypted Admin Credentials.
  - *Redis:* A high-performance in-memory datastore managing transient states like live user presence heartbeats, distributed rate-limit locks, and concurrent session tracking.
- **External / Mock Integrations:**
  - *Banking System Integration:* A localized Mock Banking API (Express.js) designed to simulate processing core financial transactions and exchange rate fetching securely.
  - *AI/LLM Services:* Authorized outbound connections to commercial LLMs for generative chat contextualization.

---

### 5. Process View / Data Flow

#### 5.1 Real-Time Chat & Presence Monitoring
1. A customer accesses the frontend application.
2. The Next.js custom server upgrades the connection from HTTP to WebSockets (via Socket.IO).
3. The user's presence heartbeat is periodically logged into the Redis cache using sorted sets (`zadd`).
4. Chat messages are routed through the Backend to the GenAI model, while the resulting interactions are asynchronously logged to PostgreSQL.

#### 5.2 Administrative Authentication Workflow
1. An administrator submits their credentials via the login interface.
2. The Node.js Middleware enforces strict, IP-based rate limiting to prevent credential stuffing and brute-forcing.
3. The Nibbot Core Services query PostgreSQL via Prisma, comparing the provided password against the `bcrypt` hash.
4. Upon successful validation, a strongly encrypted, HTTP-only `iron-session` cookie is issued, containing a CSRF token for subsequent requests.

---

### 6. Security Architecture

- **Proxy Trust Boundaries:** The Node.js custom server directly captures raw TCP socket IPs and forwards them down the stack via an internal header (`x-direct-client-ip`). This strictly prevents `X-Forwarded-For` header spoofing attacks.
- **Dependency Hardening:** External packages (such as `nodemailer` and `undici`) are pinned to hardened versions to prevent SSRF vulnerabilities and TLS verification bypasses.
- **Data Privacy & Storage:** Sensitive operations (such as managing report drafts and workflow metadata) are maintained entirely server-side. Browser `localStorage` is restricted exclusively to non-sensitive anonymous telemetry IDs that grant zero authentication privileges.
- **Malware Scanning:** File uploads are subjected to strict MIME type validation, Magic Byte signature verification, and anti-malware buffer scanning before being persisted to the internal network.

---

### 7. Technology Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend / Web Client** | Next.js 16 (React 19), Tailwind CSS, Framer Motion, Radix UI |
| **Backend Framework** | Next.js App Router, Node.js 20+ |
| **Relational Database** | PostgreSQL 16+ |
| **ORM / Data Access** | Prisma 7.5.0 |
| **Caching & PubSub** | Redis (`ioredis`) |
| **Real-Time Communication** | WebSockets (Socket.IO) |
| **Security & Auth** | `bcrypt` (hashing), `iron-session` (stateless sessions), Zod |

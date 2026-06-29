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
    classDef userBox fill:#F4F8FC,stroke:#4A90E2,stroke-width:1px,color:#000
    classDef routerBox fill:#FFFFFF,stroke:#9013FE,stroke-width:1.5px,color:#000
    classDef firewall fill:#FFFFFF,stroke:#D0021B,stroke-width:1.5px,color:#D0021B
    classDef appBox fill:#FFFFFF,stroke:#417505,stroke-width:1.5px,color:#417505
    classDef middleware fill:#FFFFFF,stroke:#50E3C2,stroke-width:1.5px,color:#008B8B
    classDef dbLayer fill:#F4F8FC,stroke:#4A90E2,stroke-width:1.5px,color:#000
    classDef dmzZone fill:#FFF5EA,stroke:#F5A623,stroke-width:2px,color:#000
    classDef intZone fill:#F2FAF5,stroke:#417505,stroke-width:2px,color:#000

    Admin["👤 Admin User"]:::userBox
    EndUser["👤 End User"]:::userBox

    Browser["🖥️ Browser"]:::userBox
    Phone["📱 Phone"]:::userBox

    Internet(("🌐 Internet")):::userBox

    Admin -- "HTTPS / Public Access" --> Browser
    Admin -- "HTTPS / Public Access" --> Phone
    EndUser -- "HTTPS / Public Access" --> Browser
    EndUser -- "HTTPS / Public Access" --> Phone

    Browser <--> Internet
    Phone <--> Internet

    subgraph DMZ ["DMZ ZONE (Public Zone)"]
        Edge["Edge Router /<br/>Load Balancer"]:::routerBox
        FW1["🧱 Firewall"]:::firewall
        Chatbot["⚙️ Chatbot<br/><span style='font-size:10px'>(Next.js App — Frontend, Backend, Socket.IO)</span>"]:::appBox
        MW["🛠️ Middleware<br/><span style='font-size:10px'>(Core Banking Middleware / ESB)</span>"]:::middleware

        Edge <--> FW1
        FW1 <--> Chatbot
        Chatbot <--> MW
    end

    Internet <--> Edge

    subgraph INTERNAL ["INTERNAL NETWORK"]
        direction TB
        FW2["🧱 Firewall"]:::firewall

        subgraph DBLayer ["DATABASE LAYER"]
            DB[("🛢️ DB<br/><span style='font-size:10px'>PostgreSQL & Redis</span>")]:::dbLayer
        end

        FW2 <-->|"Read / Write"| DBLayer
    end

    MW <-->|"DB Connection"| FW2

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

#### 4.1 Users
- **Admin User:** Bank staff who manage menus, triage reports, configure API integrations, and manage other admin users through the admin dashboard (`/admin`).
- **End User:** Bank customers who interact with the chatbot to access services, check information, and submit reports through the public chat interface (`/`).
- Both access the system through a **Browser** or **Phone** over HTTPS. There is no separate mobile app — the web interface is responsive and works on all devices.

#### 4.2 DMZ (Public Zone) Components
- **Edge Router / Load Balancer:** The first point of contact for internet traffic. Terminates SSL/TLS, distributes traffic across app servers. In the current deployment this is **nginx**.
- **Firewall (FW1):** Filters traffic between the Edge Router and the application. Only allows HTTP and WebSocket traffic on the app port. Blocks direct access to internal service ports.
- **Chatbot (Next.js Application):** A single unified application that contains the frontend (React UI), the backend (API routes), real-time presence engine (Socket.IO), and a custom Node.js server wrapper (`server.js`) that enforces security headers, rate limiting, IP capture, and request body limits. It serves the customer chat interface, the admin dashboard, processes all API requests, and connects to the Core Banking Middleware for external service calls.
- **Middleware (Core Banking Middleware / ESB):** The bank's enterprise integration layer that sits between the Chatbot application and the bank's internal systems. The Chatbot calls the Middleware through its server-side proxy endpoint (`/api/proxy`) to access banking services such as account lookups, balance checks, transaction history, and exchange rates. The proxy enforces a domain allowlist (`PROXY_ALLOWED_HOSTS`), blocks private IP ranges (SSRF protection), validates DNS resolution, and applies request timeouts before forwarding to the Middleware.

#### 4.3 Internal Network Components
- **Firewall (FW2):** Separates the DMZ from the internal network. Only allows the Chatbot and Middleware to connect to the Database Layer on specific ports (PostgreSQL 5432, Redis 6379). No other traffic passes through.
- **Database Layer:**
  - *PostgreSQL:* The primary relational database. Stores all persistent data — dynamic menus, admin credentials (bcrypt hashed), user reports, interaction logs, audit logs, app settings, KYC field definitions, and drafts.
  - *Redis:* An in-memory data store for transient state — rate limit counters, account lockout flags, online user presence heartbeats (sorted sets), and session version tracking for concurrent session control.

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

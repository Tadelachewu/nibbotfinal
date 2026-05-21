# High-Level Design (HLD) Document: Nibbot Platform

## 1. Overall System Architecture Diagram

This architecture reflects the actual system structure implemented in the codebase, showcasing the custom Next.js server configuration, the data persistence layer, real-time channels, and associated APIs.

```mermaid
flowchart TD
    subgraph Client Layer
        WebClient[Web Browser Client\nNext.js React Frontend]
    end

    subgraph Custom Node.js Server
        CustomServer[server.js\nHTTP Server]
        NextJSApp[Next.js App Router\nBackend & SSR]
        SocketIO[Socket.IO Server\nReal-time Engine]
    end

    subgraph Data & Persistence Layer
        PostgreSQL[(PostgreSQL DB)]
        PrismaORM[Prisma ORM]
        Redis[(Redis Cache)]
    end

    subgraph External & AI Integrations
        SMTP[SMTP Server\nNodemailer]
        GenAI[LLM Integration\n(Future: RAG System)]
        BankingAPI[Mock Banking APIs\nExpress.js]
    end

    %% Client Interactions
    WebClient <-->|REST / HTTP| NextJSApp
    WebClient <-->|WebSockets| SocketIO

    %% Server Internal Routing
    CustomServer --> NextJSApp
    CustomServer --> SocketIO

    %% Server to Persistence
    NextJSApp <-->|Queries / Mutations| PrismaORM
    PrismaORM <--> PostgreSQL
    SocketIO <-->|Presence / PubSub| Redis
    NextJSApp <-->|Session / Data| Redis

    %% External System Integrations
    NextJSApp -->|Emails| SMTP
    NextJSApp <-->|Prompts / ML| GenAI
    NextJSApp <-->|API Calls| BankingAPI
```

---

## 2. Major Modules / Components

Based on the project directory and files, the system comprises the following macro-level components:

*   **Next.js Web Application (`src/app`)**: The core application UI using React 19 and Next.js App Router. It is responsible for rendering the administrative dashboard, support panels, user interfaces, and serving static assets.
*   **API Routes (`src/app/api`)**: The RESTful backend logic serving client requests. Key modules include `admin`, `settings`, `exchange-rate`, `menus`, `otp`, `reports`, `logs`, and `support`.
*   **Real-time Engine (`server.js`)**: A custom Node.js server that simultaneously wraps the Next.js application and hosts a Socket.IO server. This handles bidirectional real-time communication for live tracking and interaction updates.
*   **Database ORM Layer (`prisma/`)**: Managed via Prisma (`schema.prisma`), this module defines the data schema, including entities for `MenuItem`, `UserReport`, `AppSettings`, `InteractionLog`, `AdminCredential`, and banking `Account` & `Transaction`.
*   **Mock Banking API (`banking-api/`)**: A standalone Express.js application designed to simulate external banking endpoints such as exchange rate fetching and account transaction processing.
*   **Core Library Services (`src/lib/`)**: A collection of shared backend utilities handling session management (`iron-session`), authentication (`bcrypt`), email dispatching (`nodemailer`), and dynamic ID generation.
*   **AI Integration Module (`src/ai/`)**: Architecture designed to interface with available commercial LLMs (e.g., OpenAI, Anthropic) with planned support for a Retrieval-Augmented Generation (RAG) system using company data in a later phase.

---

## 3. Data Flow and System Interactions

Data flow within the application follows primarily an API-driven and event-driven hybrid model:

1.  **Standard HTTP Traffic (REST/SSR)**:
    *   The user accesses the frontend; the request hits the Next.js App Router.
    *   For dynamic data, the frontend calls endpoints under `/api/*`.
    *   The API route leverages `src/lib/prisma.ts` to execute ORM queries against PostgreSQL.
    *   Data is returned via JSON and rendered into components on the client or server.
2.  **Real-Time Interactions & Presence**:
    *   The web client establishes a WebSocket connection with the `server.js` Socket.IO instance.
    *   When the user becomes active, the socket emits a `user_active` event.
    *   The Socket.IO server updates the user's presence heartbeat in Redis via `zadd`.
    *   A background validation loop continuously checks Redis (`zcount`) and broadcasts the active online user count to connected clients.
3.  **Authentication & Sessions**:
    *   Admin logins are hashed via `bcrypt` and validated against `AdminCredential` in Postgres.
    *   Authorized sessions are encrypted using `iron-session` and stored in secure cookies, validated on subsequent API and page requests.

---

## 4. Integration Points with External Systems

The codebase explicitly defines integrations with the following external systems:

*   **AI / LLM Provider**: The system is designed to integrate with standard available AI providers (OpenAI, Anthropic, etc.). Future phases will incorporate a company-specific Retrieval-Augmented Generation (RAG) pipeline for domain-specific knowledge.
*   **SMTP Service**: The `src/lib/email.ts` module uses `nodemailer` to dispatch outgoing emails for functionalities like Admin Password Recovery.
*   **Mock Banking API Services**: The main Next.js backend makes outbound REST calls to the internal `banking-api` module (or its deployed equivalent) to fetch mock financial data.
*   **Redis Database**: Connected via `ioredis` to manage transient presence states and session management.

---

## 5. Technology Stack and Platform Overview

The technology stack extracted directly from `package.json`, `.env.example`, and configuration files includes:

*   **Frontend**: Next.js 16 (React 19), Tailwind CSS, Framer Motion (`tailwindcss-animate`), Radix UI (Headless components), Tiptap (Rich Text Editor).
*   **Backend Runtime**: Node.js 20+ (TypeScript with `tsx`).
*   **Framework**: Next.js App Router with a Custom Node Server wrapper.
*   **Database**: PostgreSQL 16+.
*   **ORM**: Prisma 7.5.0 (`@prisma/client`, `@prisma/adapter-pg`).
*   **Caching & Real-time DB**: Redis (`ioredis`).
*   **WebSockets**: Socket.IO (`socket.io`, `socket.io-client`).
*   **AI / Machine Learning**: Agnostic LLM API integrations with a planned RAG framework.
*   **Security & Auth**: `bcrypt` (hashing), `iron-session` (stateless session cookies), `zod` (payload validation).

---

## 6. High-Level Security and Access Control

Security is explicitly implemented across the application in the following ways:

*   **Content Security Policy (CSP)**: Strongly enforced via `middleware.ts`. It generates a cryptographic `nonce` injected into scripts and inline styles, blocks `eval()` in production, restricts `frame-ancestors`, and governs external asset sources (`img-src`, `connect-src`).
*   **Authentication**: Admin credentials utilize hashed passwords (`bcrypt`). Session states are strictly managed via `iron-session`, eliminating plaintext session data on the client side.
*   **Payload Limitations**: The custom `server.js` actively throttles payload sizes via `MAX_REQUEST_BODY_BYTES`, rejecting excessively large requests (e.g., HTTP 413 Payload Too Large) to mitigate Denial of Service (DoS) risks.
*   **Rate Limiting & Directory Traversal**: `server.js` explicitly blocks direct directory access and enforces strict URL parsing to prevent unexpected traversal.
*   **CORS Policies**: Explicit Cross-Origin Resource Sharing logic is placed in `middleware.ts` and `server.js` to whitelist legitimate frontend origins and restrict unauthorized API usage.

---

## 7. Deployment Architecture

Based on evidence in the codebase:

*   **Hosting / Deployment**: Standard Company Server. The custom Node.js server (`server.js`) and persistent database infrastructure are designed to be self-hosted securely on company-managed bare metal or virtualized infrastructure.
*   **Custom Node.js Target**: The presence of `server.js` and custom `start` scripts in `package.json` (`node -e "process.env.NODE_ENV='production'... require('./server.js')"`) indicates the system is also designed to be deployed as a persistent long-running Docker container or on a traditional PaaS (like Render or Heroku) to support the stateful Socket.IO engine.
*   **Database Hosting**: Postgres and Redis are assumed to be hosted externally, as connected via `DATABASE_URL` and `REDIS_URL` connection strings.

*Note: Infrastructure as Code (e.g., Terraform) and explicit CI/CD workflow files (e.g., `.github/workflows`) are not explicitly defined in the root of this codebase.*

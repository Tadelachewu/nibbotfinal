# Nibbot Application Architecture

This Mermaid diagram is generated based on the design template provided in `SAD_Architecture_Sample.png`, adapted to fit the specific components and technologies of the `nibbotfinal` application.

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

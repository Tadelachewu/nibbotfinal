# NibBot Production Deployment Guide

## Introduction
This document covers two things: (1) step-by-step deployment commands, and (2) configuration and security hardening. Follow both before going live.

---

## Step-by-Step Deployment

### Prerequisites

Install these on the production server before starting:

| Software | Minimum Version | Purpose |
|---|---|---|
| **Node.js** | 18.x or 20.x LTS | Runtime |
| **PostgreSQL** | 14+ | Database |
| **Redis** | 6+ | Rate limiting, sessions, online presence |
| **nginx** | 1.18+ | Reverse proxy, TLS termination |
| **Git** | 2.x | Pulling code |

### Step 1 — Get the code on the server

```bash
# Clone the repository (or copy from your CI/CD)
git clone <your-repo-url> /opt/nibbot
cd /opt/nibbot

# Switch to the production branch
git checkout main
```

### Step 2 — Install dependencies

```bash
npm ci --omit=dev
```

This installs exact versions from `package-lock.json` and skips dev dependencies. The `postinstall` script automatically runs `prisma generate` to create the Prisma client.

### Step 3 — Configure environment

```bash
# Copy the template and edit it
cp .env.example .env
nano .env
```

Set these values for your production environment:

```env
# REQUIRED — generate a new one, do NOT reuse from dev
SECRET_COOKIE_PASSWORD=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# Database — use your production PostgreSQL credentials
DATABASE_URL=postgresql://prod_user:strong_password@localhost:5432/nibbot?schema=public

# MUST match your production domain exactly
NEXT_PUBLIC_SITE_URL=https://your-domain.com
APP_ORIGIN=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com

# Redis
REDIS_URL=redis://localhost:6379

# Core settings
NODE_ENV=production
PORT=3020
TRUST_PROXY=true
ENABLE_SESSION_BINDING=true

# Initial admin — change password on first login, then remove these lines
ADMIN_INITIAL_USERNAME=admin
ADMIN_INITIAL_PASSWORD=<12+ chars, uppercase, lowercase, number, special>

# SMTP for password recovery emails
SMTP_HOST=smtp.yourbank.com
SMTP_PORT=587
SMTP_USER=noreply@yourbank.com
SMTP_PASS=your_app_password
EMAIL_FROM="App Name <noreply@yourbank.com>"

# Socket.IO
NEXT_PUBLIC_ENABLE_SOCKET_IO=true
SOCKET_IO_ALLOWED_ORIGINS=https://your-domain.com

# CSP — list only the external APIs the app calls, NEVER use *
ALLOWED_CONNECT_SRC=https://api1.example.com,https://api2.example.com

# Proxy allowlist — which external hosts the proxy endpoint can reach
PROXY_ALLOWED_HOSTS=api1.example.com api2.example.com

# TLS — set to true ONLY if internal APIs use self-signed certs
ALLOW_SELF_SIGNED_CERTS=false
```

See the full configuration reference in the sections below.

### Step 4 — Set up the database

```bash
# Create the database (if it doesn't exist)
psql -U postgres -c "CREATE DATABASE nibbot;"

# Run all migrations
npx prisma migrate deploy

# (Optional) Seed demo data — skip in production unless you want sample menus
# npx prisma db seed
```

If the database already exists and has tables from `prisma db push` (no migration history):

```bash
# Mark existing migrations as applied
npx prisma migrate resolve --applied 20260605194828_init
npx prisma migrate resolve --applied 20260608104124_add_theme_colors
npx prisma migrate resolve --applied 20260611120000_add_show_bank_branding
npx prisma migrate resolve --applied 20260618100000_add_drafts_table

# Then apply any new ones
npx prisma migrate deploy
```

### Step 5 — Build the app

```bash
npm run build
```

This produces the optimized production build in `.next/`. Takes 2-5 minutes depending on server specs.

### Step 6 — Create the storage directory

```bash
# For uploaded files (stored outside the webroot)
mkdir -p storage/uploads/admin storage/uploads/avatars storage/uploads/branding
```

### Step 7 — Start the app

```bash
# Direct start (foreground)
npm start

# Or with a process manager (recommended)
npm install -g pm2
pm2 start npm --name "nibbot" -- start
pm2 save
pm2 startup    # auto-start on server reboot
```

The server starts on `http://localhost:3020` (or whatever `PORT` is set to). You should see:

```
[Redis] Connected (presence tracking enabled).
> Production Real-Time Engine Ready on http://localhost:3020
```

### Step 8 — Configure nginx reverse proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Proxy to Node.js
    location / {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (Socket.IO)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # File upload size limit
    client_max_body_size 5M;
}
```

```bash
# Test and reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Step 9 — Verify deployment

| Check | Command / URL | Expected |
|---|---|---|
| **App is running** | `curl http://localhost:3020` | HTML response |
| **HTTPS works** | Visit `https://your-domain.com` | No certificate errors |
| **Admin login** | Visit `https://your-domain.com/admin` | Login page loads |
| **First login** | Login with `ADMIN_INITIAL_USERNAME` / `PASSWORD` | Forced to change password |
| **Redis connected** | Check server logs | `[Redis] Connected` |
| **Socket.IO** | Open chat page, check Dashboard → Online Now | Count increases |
| **Password reset** | Trigger a reset from login page | Email arrives |

### Step 10 — Post-deployment cleanup

```bash
# After first admin login and password change, remove initial credentials from .env
# Edit .env and delete these lines:
#   ADMIN_INITIAL_USERNAME=admin
#   ADMIN_INITIAL_PASSWORD=...

# Then restart the app
pm2 restart nibbot
```

---

## Updating / Redeploying

```bash
cd /opt/nibbot

# Pull latest code
git pull origin main

# Install any new dependencies
npm ci --omit=dev

# Apply any new database migrations
npx prisma migrate deploy

# Rebuild
npm run build

# Restart
pm2 restart nibbot
```

---

## Quick Reference — Common Commands

| Task | Command |
|---|---|
| Start app | `npm start` or `pm2 start nibbot` |
| Stop app | `pm2 stop nibbot` |
| Restart app | `pm2 restart nibbot` |
| View logs | `pm2 logs nibbot` |
| Check status | `pm2 status` |
| Run migrations | `npx prisma migrate deploy` |
| Open DB console | `npx prisma studio` |
| Generate Prisma client | `npx prisma generate` |
| Build | `npm run build` |

---

## Configuration & Security Reference

Everything below explains each `.env` variable in detail, with consequences of misconfiguration.

---

## 1. Core Environment Configuration

### 1.1 Set NODE_ENV=production
**What to do**: Ensure your `.env` file has:
```env
NODE_ENV=production
```

**Consequences if missed**:
- Development-only error messages are exposed to users (leaks code structure)
- Security bypasses (like self-signed certificates) remain active
- Performance optimizations (React/Next.js production builds) are disabled
- Logs become overly verbose, impacting performance

**Verification**: Check server startup logs for "Production Real-Time Engine Ready"

---

### 1.2 Secure Cookie Secret
**What to do**: Generate a new, strong `SECRET_COOKIE_PASSWORD` using:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Update it in `.env`:
```env
SECRET_COOKIE_PASSWORD=your_new_strong_random_key_here
```

**Consequences if missed**:
- Session cookies can be forged or tampered with
- Attackers can impersonate admin users
- All user sessions become vulnerable to hijacking
- Compliance failures (GDPR, PCI, etc.) for not securing authentication

**Verification**: After setting, all existing admin sessions should be invalidated (users must re-login)

---

## 2. SSL/TLS Security

### 2.1 Disable Development SSL Bypasses
**What to do**: In `.env`, set:
```env
ALLOW_SELF_SIGNED_CERTS=false
NODE_TLS_REJECT_UNAUTHORIZED=1
ALLOW_HTTP=false
```

**Consequences if missed**:
- **Man-in-the-Middle (MITM) Attacks**: Attackers can intercept and read all traffic
- **Data Exfiltration**: User reports, KYC data, and API keys are exposed
- **Browser Warnings**: Users see "Not Secure" warnings, eroding trust
- **Compliance Violations**: Fails GDPR, PCI-DSS, and banking security requirements

---

### 2.2 Install Valid SSL Certificates
**What to do**:
1. Obtain CA-signed certificates (Let's Encrypt, Comodo, DigiCert, etc.)
2. Configure paths in `.env`:
```env
SSL_KEY_PATH=/path/to/private.key
SSL_CERT_PATH=/path/to/certificate.crt
```

**Consequences if missed**:
- Same as above, but also:
- **Modern Browser Blocking**: Chrome/Firefox block HTTP-only sites
- **SEO Penalties**: Search engines rank HTTPS sites higher
- **API Integration Failures**: Most external APIs require HTTPS clients

---

## 3. Content Security Policy (CSP)

### 3.1 Configure Allowed Origins
**What to do**: Update `.env` with your production domains:
```env
NEXT_PUBLIC_SITE_URL=https://nibbot.yourbank.com
APP_ORIGIN=https://nibbot.yourbank.com
ALLOWED_ORIGINS=https://nibbot.yourbank.com,https://admin.yourbank.com
```

**What to do for `ALLOWED_CONNECT_SRC`**:
Remove wildcards (`*`) and list only trusted APIs:
```env
ALLOWED_CONNECT_SRC=https://api.yourbank.com,https://calendarific.com
```

**Consequences if missed**:
- **XSS Attacks**: Malicious scripts can exfiltrate data to attacker-controlled domains
- **Data Leaks**: User session cookies or report data sent to unauthorized servers
- **Compliance Fails**: GDPR requires strict control over data destinations

---

### 3.2 Configure External API Proxy Allowlist
**What to do**:
Set the `ALLOWED_API_DOMAINS` (or `PROXY_ALLOWED_HOSTS`) environment variable to explicitly list any third-party APIs the chatbot needs to contact through the proxy.
```env
ALLOWED_API_DOMAINS=api.yourbank.com,api.weather.com
```

**Consequences if missed**:
- **Broken Features**: In production, if the allowlist is empty, all proxy requests are rejected immediately with `Proxy allowlist not configured.` (it does not fall back to permissive mode).
- **SSRF Protections**: Note that the proxy has hardcoded protections against Server-Side Request Forgery. It will actively block requests to private/internal IPs (e.g., `127.0.0.1`, `192.168.x.x`, `10.x.x.x`, `metadata.google.internal`) regardless of your allowlist settings.

---

## 4. Database Security

### 4.1 Secure Database Credentials
**What to do**:
1. Create a dedicated production database user with minimal permissions
2. Use a strong, unique password
3. Update `DATABASE_URL`:
```env
DATABASE_URL=postgresql://prod_user:strong_password@prod-db-host:5432/nibbot_prod?schema=public&sslmode=require
```

**Consequences if missed**:
- **Data Breach**: All user reports, KYC data, and admin credentials exposed
- **Data Loss**: Attacker can drop tables or delete all data
- **Permanent Reputation Damage**: Customers lose trust in your bank

**Verification**: Try connecting with old dev credentials - it should fail

---

### 4.2 Enable Database Encryption
**What to do**:
- Enable SSL/TLS for database connections (`sslmode=require`)
- Enable at-rest encryption on your database server

**Consequences if missed**:
- **Network Sniffing**: Database traffic can be intercepted on the network
- **Server Compromise**: If database server is hacked, unencrypted data is exposed

---

## 5. Redis Security

### 5.1 Secure Redis Connection
**What to do**:
1. Set a strong Redis password
2. Use TLS for Redis connections
3. Update `.env`:
```env
REDIS_URL=rediss://:strong_redis_password@prod-redis-host:6379
```

**Consequences if missed**:
- **Session Hijacking**: Attackers can steal all active user sessions
- **Cache Poisoning**: Fake "Online Now" data or cached API responses
- **Denial of Service**: Attacker can flush Redis, crashing the real-time features

---

## 6. Admin Credentials

### 6.1 Change Default Admin Password
**What to do**:
1. First deploy with `ADMIN_INITIAL_PASSWORD` set. **CRITICAL**: In production, this password *must* be at least 12 characters long, otherwise the server will throw a fatal error on startup!
2. Login immediately and change the admin password via the UI
3. **Remove** `ADMIN_INITIAL_USERNAME` and `ADMIN_INITIAL_PASSWORD` from `.env`

**Consequences if missed**:
- **Server Crash**: App will not start if the initial password is under 12 characters in prod.
- **Automated Takeover**: Bots scan the internet for default credentials
- **Full System Compromise**: Attacker gains admin access to everything
- **Fatal Security Breach**: Your entire chatbot system is under enemy control

---

### 6.2 Enable Maker-Checker Workflow
**What to do**:
1. Create separate "Maker" and "Checker" admin accounts
2. Never use a single admin account for everything
3. Enforce 4-eyes principle for all changes

**Consequences if missed**:
- **Human Error**: Accidental deletion of menus or wrong API config affects all users
- **Insider Threat**: A single rogue admin can cause irreversible damage
- **Audit Failures**: Cannot prove who approved what changes

---

## 7. Email/SMTP Security

### 7.1 Use Dedicated Production SMTP
**What to do**:
1. Create a dedicated service email account
2. Use app-specific password if using Gmail
3. Update `.env`:
```env
SMTP_HOST=smtp.yourbank.com
SMTP_PORT=587
SMTP_USER=nibbot-noreply@yourbank.com
SMTP_PASS=your_strong_app_password
EMAIL_FROM="NibBot <nibbot-noreply@yourbank.com>"
```
4. Ensure your `NEXT_PUBLIC_SITE_URL` starts with `https://`. The system will explicitly throw an error and refuse to send password recovery emails over HTTP in production.

**Consequences if missed**:
- **Password Reset Failures**: Users can't reset forgotten passwords (emails won't send at all if HTTP is used in prod).
- **Phishing Risk**: If personal email is compromised, attackers can use it
- **Email Deliverability**: Emails marked as spam or blocked entirely

---

## 8. Logging & Monitoring

### 8.1 Disable Debug Logs
**What to do**: Ensure no debug flags are set in production:
```env
# Remove or comment out any debug flags
# DEBUG=*
```

**Consequences if missed**:
- **Performance Degradation**: Verbose logging slows down the server
- **Sensitive Data Leaks**: Logs may contain user PII or API keys
- **Log Flooding**: Storage fills up quickly, causing crashes

---

### 8.2 Set Up Monitoring & Alerts
**What to do**:
- Monitor server health (CPU, memory, disk)
- Set up alerts for failed login attempts
- Monitor Redis and database connection pools

**Consequences if missed**:
- **Silent Failures**: System goes down without anyone noticing
- **Delayed Incident Response**: Breach happens hours/days before detection
- **Extended Downtime**: Small issues become big outages

---

## 9. Deployment Hardening

### 9.1 Use a Reverse Proxy
**What to do**: Put Nginx or Cloudflare in front of Node.js:
- Rate limiting
- DDoS protection
- Static file caching

**Consequences if missed**:
- **DDoS Attacks**: Server overwhelmed and crashes
- **Brute Force**: No rate limiting on login endpoints
- **Poor Performance**: No caching means slower page loads

---

### 9.2 Environment Isolation
**What to do**:
- Never use the same database/Redis for dev and prod
- Use separate cloud accounts/projects if possible

**Consequences if missed**:
- **Data Corruption**: Dev testing wipes production data
- **Compliance Violations**: Mixing test and real user data is illegal in many jurisdictions

---

## Pre-Launch Checklist

Before going live, verify **all** of these:

- [ ] `NODE_ENV=production` set
- [ ] Strong `SECRET_COOKIE_PASSWORD` generated
- [ ] `ALLOW_SELF_SIGNED_CERTS=false`
- [ ] `NODE_TLS_REJECT_UNAUTHORIZED=1`
- [ ] Valid SSL certificates installed
- [ ] Database credentials changed from dev defaults
- [ ] `DATABASE_URL` uses `sslmode=require`
- [ ] Redis password set and TLS enabled
- [ ] Default admin password changed and removed from .env
- [ ] Maker-Checker workflow implemented
- [ ] CSP `ALLOWED_CONNECT_SRC` has no wildcards
- [ ] All origins configured correctly
- [ ] Debug logging disabled
- [ ] Monitoring and alerts set up
- [ ] Reverse proxy (Nginx/Cloudflare) in place
- [ ] Full end-to-end security test completed

---

## Post-Launch Verification

1. **SSL Test**: Use https://www.ssllabs.com/ssltest/ - aim for A+
2. **Security Headers**: Use https://securityheaders.com/ - aim for A
3. **Penetration Test**: Hire professionals to attempt hacks
4. **Backup Test**: Verify you can restore from backups
5. **Disaster Recovery**: Test failover to standby systems

---

## Emergency Rollback Plan

If a security issue is discovered post-launch:

1. **Immediate Actions**:
   - Put up a maintenance page
   - Revoke all active sessions
   - Change all database/API/Redis passwords

2. **Root Cause Analysis**:
   - Identify what went wrong
   - Fix the vulnerability

3. **Recovery**:
   - Restore from clean backup
   - Re-deploy with fixes
   - Gradually bring users back

---

## 10. Scaling for Large User Numbers

### 10.1 Horizontal Scaling (Multiple App Servers)
**What to do**:
1. Deploy NibBot on multiple server instances
2. Use a load balancer (AWS ALB, Nginx, Cloudflare) to distribute traffic
3. Configure Redis for **shared session/presence storage** across all instances

**Consequences if missed**:
- **Single Point of Failure**: One server crashes = entire system goes down
- **Performance Degradation**: Too many users on one server = slow response times
- **Lost Connections**: Socket.IO connections drop when servers restart
- **Missed User Activity**: Presence tracking is inaccurate across separate servers

---

### 10.2 Database Scaling
**What to do**:
1. Use a managed PostgreSQL service (AWS RDS, Google Cloud SQL, Azure Database)
2. Enable read replicas for reporting/analytics queries
3. Set up connection pooling (PgBouncer) to handle thousands of concurrent connections

**Consequences if missed**:
- **Database Bottlenecks**: Queries queue up and time out
- **Reporting Slowdown**: Admin reporting console becomes unusable during peak times
- **Connection Limits**: Database rejects new connections under high load
- **Data Corruption**: Single DB failure loses all production data

---

### 10.3 Redis High Availability
**What to do**:
1. Set up Redis Sentinel or Redis Cluster for high availability
2. Use persistent Redis storage (AOF + RDB)
3. Configure automatic failover

**Consequences if missed**:
- **Real-Time Outage**: Presence tracking, online status, and Socket.IO fail
- **Session Loss**: All users get logged out if Redis restarts
- **No Failover**: Manual intervention required during Redis outages

---

### 10.4 Static Asset Caching & CDN
**What to do**:
1. Host all static files (images, CSS, JS) on a CDN (Cloudflare, AWS CloudFront)
2. Set long cache TTLs for hashed assets
3. Use the CDN as your primary entry point for user traffic

**Consequences if missed**:
- **Slow Load Times**: Users wait for assets to load from origin server
- **Bandwidth Costs**: High egress fees from your cloud provider
- **Poor Global Performance**: Users far from your data center get terrible latency

---

### 10.5 Auto-Scaling & Capacity Planning
**What to do**:
1. Configure auto-scaling groups (AWS ASG, GCP Instance Groups)
2. Set up scaling policies based on CPU, memory, or active connections
3. Run load tests (k6, Locust) to find your breaking point

**Consequences if missed**:
- **Sudden Traffic Spikes**: Viral marketing or news = system crash
- **Wasted Resources**: Over-provisioning during low traffic = high costs
- **Unexpected Limits**: You don't know how many users your system can handle

---

### 10.6 Asynchronous Processing
**What to do**:
1. Move report generation, email sending, and heavy analytics to a background queue
2. Use BullMQ or Celery with Redis as the broker
3. Never block the main event loop with long-running tasks

**Consequences if missed**:
- **Unresponsive Bot**: Users click buttons and nothing happens
- **Timeouts**: API calls and report submissions fail during peak
- **Domino Effect**: One slow request blocks all other users

---

### 10.7 Monitoring & Alerting for Scale
**What to do**:
1. Track key metrics: concurrent users, API latency, DB query times, Redis memory
2. Set up alerts for when you hit 70% of capacity
3. Use distributed tracing (Jaeger, OpenTelemetry) to find bottlenecks

**Consequences if missed**:
- **Blind Spots**: You don't know the system is struggling until it's too late
- **No Early Warning**: Outages happen with no time to react
- **Hard to Diagnose**: When things slow down, you don't know why

---

## Scalability Pre-Launch Checklist (for 10k+ Users)
- [ ] Load balancer set up and tested
- [ ] Multiple app servers running in parallel
- [ ] Shared Redis cluster for presence/sessions
- [ ] PostgreSQL read replicas configured
- [ ] PgBouncer or similar connection pooling
- [ ] CDN configured for static assets
- [ ] Auto-scaling policies defined and tested
- [ ] Background queue system in place
- [ ] Distributed tracing and monitoring dashboards ready
- [ ] Load tests completed and documented
- [ ] Failover and disaster recovery tested

---

## What "Large Number of Users" Looks Like
| User Scale | Key Risks | Must-Haves |
|------------|-----------|------------|
| **100-1,000** | Basic performance | Single server + managed DB |
| **1,000-10,000** | Latency, connection limits | Load balancer + read replicas |
| **10,000-100,000** | Bottlenecks, downtime | Redis cluster + CDN + auto-scaling |
| **100,000+** | Global latency, regional outages | Multi-region deployment + edge computing |

Remember: Security is not a one-time setup - it's an ongoing process! Scalability is not optional for banking systems serving thousands of customers!



RERANKER FOR THE AI:
    cd reranker-service
.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8001

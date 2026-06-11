# NibBot Production Setup Guide

## Introduction
This document outlines all necessary steps to securely deploy NibBot to production. Each step includes **consequences of skipping it** to emphasize importance.

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
1. First deploy with `ADMIN_INITIAL_PASSWORD` set
2. Login immediately and change the admin password via the UI
3. **Remove** `ADMIN_INITIAL_USERNAME` and `ADMIN_INITIAL_PASSWORD` from `.env`

**Consequences if missed**:
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

**Consequences if missed**:
- **Password Reset Failures**: Users can't reset forgotten passwords
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

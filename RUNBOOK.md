# Nib Bank Chatbot — Run Guide

Full setup and run guide for the chatbot.

---

## Prerequisites

| Service | Version | Purpose |
|---------|---------|---------|
| Node.js | 18 + | Runtime |
| PostgreSQL | 15 + | Main database |
| Redis | 7 + | Rate limiting, online presence |

---

## 1 — Install Node packages

```bash
npm install
```

This also runs `prisma generate` automatically via the `postinstall` hook.

---

## 2 — Configure `.env`

The `.env` file already exists. Key values to verify before running:

```env
# Database — must point to your running PostgreSQL
DATABASE_URL=postgresql://USER:PASS@localhost:5433/nibbot?schema=public

# Redis — must be running
REDIS_URL=redis://localhost:6379

# App port
PORT=3020

# Admin first-run credentials (used only if no admin exists in DB)
ADMIN_INITIAL_USERNAME=admin
ADMIN_INITIAL_PASSWORD=Nib@Secure2024!
```

---

## 3 — Set up PostgreSQL

### Run all migrations

```bash
npx prisma migrate deploy
```

This applies all migrations in order.

---

## 4 — Start Redis

```bash
# Linux/macOS
redis-server

# Windows (if installed via WSL or Redis for Windows)
redis-server

# Verify
redis-cli ping
# Should return: PONG
```

---

## 5 — Build the app

```bash
npm run build
```

This compiles Next.js pages and prepares the production bundle. Takes 1–3 minutes.

---

## 6 — Run the app

### Production (recommended)

```bash
npm start
```

This runs `node server.js` with `NODE_ENV=production`. The server:
- Starts on `PORT` from `.env` (default `3020`)
- Serves Next.js via the custom Express/Socket.IO server
- Applies all security headers (CSP, HSTS, etc.)

Open: `http://localhost:3020`

### Development (with hot reload)

```bash
npm run dev:io
```

This runs the custom server in development mode, so Next.js hot-reloads on file changes.

Or use Next.js dev server alone (no Socket.IO, no custom security headers):
```bash
npm run dev
# Runs on port 9003
```

---

## 7 — First login

1. Open `http://localhost:3020/admin`
2. Log in with:
   - Username: `admin` (from `ADMIN_INITIAL_USERNAME`)
   - Password: `Nib@Secure2024!` (from `ADMIN_INITIAL_PASSWORD`)
3. **Change the password immediately** via the profile menu.

---

## 8 — Use the chatbot as a user

1. Open `http://localhost:3020` (the root URL serves the chat widget)
2. Browse the menu options on the welcome message
3. Use **Live Agent** on the welcome/home message to reach a support agent

---

## Service startup order

Always start in this order:

```
PostgreSQL  →  Redis  →  npm start
```

---

## Environment summary

| Variable | What it controls |
|----------|----------------|
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_URL` | Redis connection |
| `PORT` | HTTP port (default 3020) |
| `ALLOW_PRIVATE_NETWORK` | Set `true` if running behind a public domain pointing to a private IP (Chrome PNA fix) |

---

## Troubleshooting

### Redis connection refused
- Start Redis: `redis-server`
- The app degrades gracefully — rate limiting and online presence won't work but the chatbot still runs

### `prisma migrate deploy` fails
- Ensure `DATABASE_URL` in `.env` is correct and PostgreSQL is running
- Check user has `CREATE TABLE` permissions on the database

### Port already in use
- Change `PORT=3020` in `.env` to any free port

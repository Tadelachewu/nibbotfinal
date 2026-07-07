# Nib Bank Chatbot — Run Guide

Full setup and run guide for the chatbot with Knowledge Base (KB) powered by Ollama.

---

## Prerequisites

| Service | Version | Purpose |
|---------|---------|---------|
| Node.js | 18 + | Runtime |
| PostgreSQL | 15 + | Main database |
| pgvector | 0.5 + | Vector storage for KB embeddings |
| Redis | 7 + | Rate limiting, online presence |
| Ollama | latest | Local LLM — embeddings + generation |

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

# Ollama — must be reachable from Node process
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=bge-m3
OLLAMA_GENERATE_MODEL=aya:8b
KB_VECTOR_DIMS=1024
KB_ENABLED=true
```

---

## 3 — Set up PostgreSQL

### 3a — Enable pgvector

Connect to your database and run once:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Using psql:
```bash
psql -U postgres -d nibbot -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3b — Run all migrations

```bash
npx prisma migrate deploy
```

This applies all migrations in order, including `20260702000000_add_kb` which:
- Adds `kb_enabled` column to `menu_items`
- Creates `kb_chunks` table with `vector(1024)` embedding column
- Creates `kb_config` singleton row
- Builds the HNSW index on embeddings

---

## 4 — Set up Ollama

### 4a — Install Ollama

Download from [ollama.com](https://ollama.com) and install. Then start the service:

```bash
# On Linux/macOS
ollama serve

# On Windows — Ollama runs as a background service after installation
# Verify it is running:
curl http://localhost:11434
```

### 4b — Pull required models

```bash
# Embedding model (produces 1024-dim vectors, multilingual)
ollama pull bge-m3

# Generation model (multilingual — handles English + Amharic)
ollama pull aya:8b
```

> **Note:** `bge-m3` is ~1 GB. `aya:8b` is ~5 GB. Ensure you have enough disk space.
> Pull takes a few minutes on first run.

### 4c — Verify models

```bash
ollama list
# Should show: bge-m3 and aya:8b
```

Quick embed test:
```bash
curl http://localhost:11434/api/embeddings \
  -d '{"model":"bge-m3","prompt":"hello"}' | python -c "import sys,json; d=json.load(sys.stdin); print('dims:', len(d['embedding']))"
# Should print: dims: 1024
```

### 4d — (Optional) Set up the reranker service

Only needed if you enable "Enable cross-encoder reranking" in Admin → Knowledge
Base → Config. Ollama cannot serve `bge-reranker-base` — it's a cross-encoder,
not a chat model — so it runs as its own small FastAPI process.

```bash
cd reranker-service
python -m venv .venv
.venv\Scripts\activate        # Windows — use `source .venv/bin/activate` on Linux/macOS
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

Add to `.env`:
```
RERANKER_URL=http://localhost:8001
```

See `docs/RERANKER_SERVICE.md` for the API contract, how to restart it, running
it as a persistent Windows service (it does **not** survive a reboot or
terminal close on its own by default), and performance tuning. If this service
is down or slow, KB queries fall back to plain retrieval order automatically —
it's not a hard dependency.

---

## 5 — Start Redis

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

## 6 — Build the app

```bash
npm run build
```

This compiles Next.js pages and prepares the production bundle. Takes 1–3 minutes.

---

## 7 — Run the app

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

## 8 — First login

1. Open `http://localhost:3020/admin`
2. Log in with:
   - Username: `admin` (from `ADMIN_INITIAL_USERNAME`)
   - Password: `Nib@Secure2024!` (from `ADMIN_INITIAL_PASSWORD`)
3. **Change the password immediately** via the profile menu.

---

## 9 — Index the Knowledge Base

After logging in as admin:

1. Go to **Admin → Knowledge Base** tab
2. Click **Rebuild All** — this indexes every active, approved menu into pgvector
3. Wait ~30 seconds, then click **Refresh** to see chunk counts per menu

> Indexing runs in the background and does not block the UI.
> Each menu approval or update automatically re-indexes that menu going forward.

> **Before writing menu/article content**, read `docs/KB_CONTENT_GUIDELINES.md` —
> how content is structured (headings, list items, sentence vs. fragment) directly
> determines whether the AI can find and answer from it correctly.
>
> **Before changing any KB Config value** (top-K, confidence thresholds, models,
> reranker settings), read `docs/AI_CONFIG.md` — every default there is calibrated
> against measured real scores, not guessed, and explains why.

### Test the KB

1. Still in **Admin → Knowledge Base → Test AI**
2. Type a question: `What are the requirements to open a savings account?`
3. Select language (English / Amharic)
4. Click **Ask** — you should see an answer with source chips

---

## 10 — Use the chatbot as a user

1. Open `http://localhost:3020` (the root URL serves the chat widget)
2. On the welcome message, click **✨ Ask a Question**
3. Type any question about the bank's services
4. The AI answers from the Knowledge Base, with source links back to the relevant menus

---

## Service startup order

Always start in this order:

```
PostgreSQL  →  Redis  →  Ollama  →  (reranker-service, if enabled)  →  npm start
```

---

## Environment summary

| Variable | What it controls |
|----------|----------------|
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_URL` | Redis connection |
| `PORT` | HTTP port (default 3020) |
| `OLLAMA_URL` | Ollama API base URL |
| `OLLAMA_EMBED_MODEL` | Model used for chunk embeddings (must produce `KB_VECTOR_DIMS` dims) |
| `OLLAMA_GENERATE_MODEL` | Model used to synthesize final answers |
| `KB_VECTOR_DIMS` | Embedding dimensions — must match model (bge-m3 = 1024) |
| `KB_TOP_K` | How many chunks to retrieve per query (default 5) |
| `KB_MIN_SCORE` | Minimum RRF confidence threshold (default 0.72) |
| `KB_ENABLED` | Master switch — `false` disables KB without redeployment |
| `RERANKER_URL` | Base URL of the optional cross-encoder reranker service (default `http://localhost:8001`) |
| `ALLOW_PRIVATE_NETWORK` | Set `true` if running behind a public domain pointing to a private IP (Chrome PNA fix) |

---

## Troubleshooting

### Ollama not responding
- Check `curl http://localhost:11434` — should return `Ollama is running`
- On Windows, check Task Manager for the Ollama process

### `vector` type not found / migration fails
- Run `CREATE EXTENSION IF NOT EXISTS vector;` in your database first
- Requires pgvector installed: `sudo apt install postgresql-15-pgvector` on Ubuntu

### KB returns no answers
- Run **Rebuild All** in the admin panel first
- Lower `KB_MIN_SCORE` in Admin → Knowledge Base → Config (try `0.60`)
- Check that menus are approved (`status=active`, `approved=true`, `kbEnabled=true`)

### Redis connection refused
- Start Redis: `redis-server`
- The app degrades gracefully — rate limiting and online presence won't work but the chatbot still runs

### `prisma migrate deploy` fails
- Ensure `DATABASE_URL` in `.env` is correct and PostgreSQL is running
- Check user has `CREATE TABLE` permissions on the database

### Port already in use
- Change `PORT=3020` in `.env` to any free port

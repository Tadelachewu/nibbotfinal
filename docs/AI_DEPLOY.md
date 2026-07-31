# Updating an Existing Server to the Latest Changes

This guide is for a server that is **already running an older deploy** of NibBot
and needs to be brought up to the current `main`/`contactcenter14` HEAD. It does
not cover a fresh install — see `RUNBOOK.md` (full local/dev setup with the AI
Knowledge Base) or `PRODUCTION_SETUP.md` (full production hardening + first-time
server setup) for that.

## What's new since a typical older deploy

| Feature | Adds |
|---|---|
| **AI Knowledge Base** (`cccc22b`) | New DB tables/columns (`kb_chunks`, `kb_config`, `kb_enabled`, etc.), a dependency on **Ollama** (embeddings + generation) and an optional Python reranker service, new env vars |
| **3CX Live Chat button** | New floating button in the chat widget that opens `https://callcenter.nibbank.com.et/callus/#LiveChat854959` in a popup window. **No env vars, no migration, no new dependency** — pure UI addition |
| Misc fixes (session, logo, theming, reporting counts, etc.) | Code only — covered by the normal rebuild/restart below |

If this server has never run the AI Knowledge Base feature before, do **not**
skip the Ollama / pgvector steps below — the app will still start without them
(KB degrades gracefully), but the "Ask a Question" feature will not work.

---

## 1 — Back up before touching anything

```bash
# Database dump
pg_dump -U <db_user> -d nibbot > nibbot_backup_$(date +%Y%m%d_%H%M).sql

# Note the currently deployed commit, in case you need to roll back
cd /opt/nibbot
git rev-parse HEAD > /tmp/nibbot_prev_commit.txt
```

## 2 — Pull the latest code

```bash
cd /opt/nibbot
git fetch origin
git checkout contactcenter14   # or main, whichever branch you deploy from
git pull
```

## 3 — Install dependencies

```bash
npm ci --omit=dev
```

`postinstall` regenerates the Prisma client automatically.

## 4 — Add any missing environment variables

Compare your live `.env` against `.env.example` and `RUNBOOK.md`'s
"Environment summary" table. If this server is adopting the AI Knowledge Base
for the first time, add:

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=bge-m3
OLLAMA_GENERATE_MODEL=aya:8b
KB_VECTOR_DIMS=1024
KB_ENABLED=true

# Optional — only if you enable cross-encoder reranking in Admin → Knowledge Base → Config
RERANKER_URL=http://localhost:8001
```

The 3CX live chat button needs no configuration — its URL is hardcoded in
`src/components/ThreeCXLiveChat.tsx`.

## 5 — One-time: enable pgvector (only if not already enabled)

```bash
psql -U <db_user> -d nibbot -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Skip this if the extension is already present (check with `\dx` in `psql`).

## 6 — One-time: install Ollama and pull models (only if adopting KB for the first time)

```bash
# Install from https://ollama.com, then:
ollama serve &          # or let the installer's service manage this
ollama pull bge-m3
ollama pull aya:8b
```

If Ollama is already running on this server with these models pulled, skip
this step. See `RUNBOOK.md` section 4 for verification commands.

## 7 — Optional: (re)start the reranker service

Only if "Enable cross-encoder reranking" is turned on in Admin → Knowledge
Base → Config:

```bash
cd reranker-service
python -m venv .venv        # first time only
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

See `docs/RERANKER_SERVICE.md` for running it as a persistent service.

## 8 — Apply database migrations

```bash
npx prisma migrate deploy
```

This applies every migration your database hasn't seen yet, in order —
safe to run even if some KB migrations were already applied manually.

## 9 — Rebuild

```bash
npm run build
```

## 10 — Restart the app

```bash
pm2 restart nibbot
pm2 logs nibbot --lines 50
```

Look for `[Redis] Connected` and `Production Real-Time Engine Ready` in the
logs, with no startup errors.

---

## 11 — Verify the update

| Check | How |
|---|---|
| App loads | Visit the site, chat widget renders |
| 3CX button | Bottom-right of the chat card, opens the live-agent popup on click, doesn't overlap the footer's Back button |
| KB search (if newly enabled) | Admin → Knowledge Base → **Rebuild All**, wait ~30s, then Admin → Knowledge Base → **Test AI** with a real question |
| Existing reports/menus | Spot-check a couple of menus and the reporting dashboard still show correct data |
| No console/server errors | Check `pm2 logs nibbot` and browser devtools console |

## Rollback

If something is broken after the update:

```bash
cd /opt/nibbot
git checkout $(cat /tmp/nibbot_prev_commit.txt)
npm ci --omit=dev
npm run build
pm2 restart nibbot

# Only if a migration needs reverting — restore the DB backup taken in step 1
psql -U <db_user> -d nibbot < nibbot_backup_YYYYMMDD_HHMM.sql
```

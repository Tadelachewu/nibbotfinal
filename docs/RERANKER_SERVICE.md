# Reranker service

A small standalone FastAPI process (`reranker-service/`) that serves
`BAAI/bge-reranker-base` — a cross-encoder — over HTTP for the KB pipeline's
optional reranking step (`rerankWithCrossEncoder()` in `src/lib/kb.ts`).

## When do you actually need this running?

Quick check, in order:

1. **Is "Enable cross-encoder reranking" off in Admin → Knowledge Base →
   Config?** Then you don't need this running at all — skip everything below.
   Reranking is opt-in; nothing else in the app depends on this service.
2. **Is it on, and are English (`lang: 'en'`) queries coming in?** Then yes,
   start it — English is the only language reranking actually runs for (see
   `AI_CONFIG.md` for why: it was measured badly miscalibrated for Amharic).
3. **Did you just restart the machine, restart your dev session, or close the
   terminal it was running in?** It's down again — this is not a persistent
   service yet (see "This does not survive reboots" below), so treat every
   fresh session as "assume it's down until `curl http://localhost:8001/health`
   proves otherwise."

If you're unsure whether it's currently running, don't guess — check:
```bash
curl http://localhost:8001/health
```
`{"status":"ok",...}` = running. Connection refused = it isn't; see
"Restarting it" below. Either way, a down reranker never breaks the chatbot —
queries just quietly fall back to plain retrieval (see below) — so there's no
urgency beyond "reranking isn't currently helping."

## Why this exists as a separate service

Ollama serves chat/completion and embedding models. A cross-encoder reranker is
neither — it's a sequence-classification model that scores how relevant a
passage is to a query, and Ollama has no endpoint for that. This service fills
that one gap; everything else (embeddings, answer generation) still goes
through Ollama as normal.

It is **not a hard dependency**. If it's down, slow, or unreachable, KB queries
fall back to plain vector+BM25 retrieval automatically (see `rerankWithCrossEncoder`'s
try/catch in `kb.ts`) — reranking being enabled in KB Config just stops helping,
nothing breaks.

## First-time setup

```bash
cd reranker-service
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on Linux/macOS
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

**Without a venv** (cmd or PowerShell) — installs these pinned dependencies
(`torch`, `fastapi`, etc.) globally instead of isolated, which can silently
conflict with a different project on the same machine needing different
versions of the same packages. Only skip the venv if that's not a concern here:
```bash
cd reranker-service
py -3.11 -m pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org
py -3.11 -m uvicorn main:app --host 0.0.0.0 --port 8001
```
Use `py -3.11` explicitly, not bare `python` — this machine's default Python
(3.14) doesn't have `torch` wheels available, which is exactly why the venv
above was built with 3.11 in the first place.

First startup downloads the model from Hugging Face (~1.1GB) and caches it
under `~/.cache/huggingface/hub` — subsequent starts are fast (a few seconds).

If `pip install` fails with an SSL/certificate error, you're likely behind a
corporate proxy doing TLS interception. Add
`--trusted-host pypi.org --trusted-host files.pythonhosted.org` to the pip
command as a workaround.

In `.env`, point the app at it (this is already the default):

```
RERANKER_URL=http://localhost:8001
```

Then enable it in **Admin → Knowledge Base → Config → "Enable cross-encoder
reranking"**.

## Restarting it

```bash
cd reranker-service
.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8001
```

or without activating the venv first:

```bash
reranker-service/.venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001
```

Verify it's up:

```bash
curl http://localhost:8001/health
# {"status":"ok","model":"BAAI/bge-reranker-base"}
```

Connection refused on that check means the service isn't running — restart it
with the command above.

## This does not survive reboots or terminal closure on its own

As set up, this is just a process running in a terminal — it stops the moment
that terminal, SSH session, or supervising process ends, including a machine
restart. There is currently no auto-restart or startup registration. If you
notice reranking silently stopped helping, this is the first thing to check.

To make it a persistent Windows service instead of a manual terminal process,
use a process manager such as [NSSM](https://nssm.cc/):

```bash
nssm install NibbotReranker "C:\path\to\reranker-service\.venv\Scripts\python.exe" "-m uvicorn main:app --host 0.0.0.0 --port 8001"
nssm set NibbotReranker AppDirectory "C:\path\to\reranker-service"
nssm start NibbotReranker
```

This runs it as a Windows service that starts automatically on boot and
restarts on crash — the same role systemd or Docker would play on Linux.

## Performance characteristics

Cross-encoder inference is CPU-bound and scales roughly linearly with the
number of candidate passages — measured at **~170–250ms per passage** on this
deployment. That means:

| `rerank_pool_size` | Approx. rerank time |
|---|---|
| 10 | ~2s |
| 15 | ~2.5–3.5s |
| 30 | ~5.3–7.4s |

`rerank_pool_size` (KB Config) directly trades reranking latency for how many
candidates get a chance to be reranked — see `docs/AI_CONFIG.md` for the full
tuning discussion, including why a larger pool didn't reliably fix multi-item
"list all X" questions and generally isn't worth its added latency cost.

## API contract

`POST /rerank`
```json
{ "query": "how do I open an account?", "passages": ["...", "..."] }
```
→
```json
{ "scores": [0.91, 0.12] }
```
Scores are relevance probabilities in `[0, 1]` (sigmoid-activated), same order
as the input passages. Max 50 passages per request (`MAX_PASSAGES` in `main.py`).

`GET /health` — readiness check, returns the model name currently loaded.

## Troubleshooting

- **Connection refused** — service isn't running. See "Restarting it" above.
- **Reranking seems to have no effect / KB Test always shows non-reranked-looking results** — check `GET /health` first; if it's down, queries are silently falling back to plain retrieval.
- **Queries got slower after enabling reranking** — expected; see "Performance characteristics" above. Consider lowering `rerank_pool_size`.
- **First request after a restart is slow** — normal; the model loads into memory on first use if the process was just started.
- **Scores look nonsensical (e.g. correct answer scores near zero, generic filler text scores near 1.0)** — this cross-encoder is sensitive to text fluency; see the "prefix vs. cross-encoder" note in `docs/AI_CONFIG.md` for a real example of this and why `rerank_min_score` is calibrated as low as it is.

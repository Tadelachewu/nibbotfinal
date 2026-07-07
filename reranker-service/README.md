# Nibbot Reranker Service

Serves `BAAI/bge-reranker-base` (a cross-encoder) over HTTP for the KB pipeline's
optional reranking step. See **`../docs/RERANKER_SERVICE.md`** for full setup,
restart, persistent-service, performance, and troubleshooting docs.

## Quick start

```bash
cd reranker-service
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

## API

`POST /rerank`
```json
{ "query": "how do I open an account?", "passages": ["...", "..."] }
```
→
```json
{ "scores": [0.91, 0.12] }
```

`GET /health` — readiness check.

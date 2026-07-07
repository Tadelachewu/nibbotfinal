"""Minimal cross-encoder reranking service for the Nibbot KB pipeline.

Exposes POST /rerank, called from src/lib/kb.ts (rerankWithCrossEncoder).
Contract:
  request:  {"query": str, "passages": [str, ...]}
  response: {"scores": [float, ...]}   # same order/length as passages, higher = more relevant

BAAI/bge-reranker-base is a cross-encoder (sequence-classification model), not a
chat/completion model — it cannot be served through Ollama's /api/chat, which is
why this runs as its own small process.
"""
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

MODEL_NAME = os.environ.get("RERANKER_MODEL", "BAAI/bge-reranker-base")
MAX_PASSAGES = 50  # sanity cap — kb.ts sends at most rerankPoolSize (default 15)

app = FastAPI(title="Nibbot Reranker Service")
model = CrossEncoder(MODEL_NAME)


class RerankRequest(BaseModel):
    query: str
    passages: list[str]


class RerankResponse(BaseModel):
    scores: list[float]


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/rerank", response_model=RerankResponse)
def rerank(req: RerankRequest):
    if not req.query or not req.passages:
        raise HTTPException(status_code=400, detail="query and passages are required")
    if len(req.passages) > MAX_PASSAGES:
        raise HTTPException(status_code=400, detail=f"too many passages (max {MAX_PASSAGES})")

    pairs = [(req.query, p) for p in req.passages]
    # bge-reranker-base's CrossEncoder config applies a sigmoid activation by
    # default, so scores come back as relevance probabilities in [0, 1] —
    # directly comparable to the rerank_min_score config threshold.
    scores = model.predict(pairs)
    return {"scores": [float(s) for s in scores]}

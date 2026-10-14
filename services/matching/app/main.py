"""Matching Service."""
from fastapi import FastAPI

app = FastAPI(title="Matching Service", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "matching"}


@app.post("/api/v1/matching/join")
def join_queue() -> dict:
    return {"code": 501, "message": "TODO: join queue (week 2/5)"}


@app.post("/api/v1/matching/cancel")
def cancel_queue() -> dict:
    return {"code": 501, "message": "TODO: cancel (week 2/5)"}


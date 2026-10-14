"""Match Service."""
from fastapi import FastAPI

app = FastAPI(title="Match Service", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "match"}


from fastapi import WebSocket


@app.post("/api/v1/matches", status_code=201)
def create_match() -> dict:
    return {"code": 501, "message": "TODO: create match (week 3)"}


@app.websocket("/ws/matches/{match_id}")
async def watch_match(ws: WebSocket, match_id: str) -> None:
    await ws.accept()
    await ws.send_json({"type": "HELLO", "payload": {"match_id": match_id}})
    await ws.close()


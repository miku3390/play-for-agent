"""Agent Service."""
from fastapi import FastAPI

app = FastAPI(title="Agent Service", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "agent"}


@app.post("/api/v1/agents", status_code=201)
def create_agent() -> dict:
    return {"code": 501, "message": "TODO: create agent (week 2)"}


@app.post("/api/v1/agents/{agent_id}/activate")
def activate_agent(agent_id: str) -> dict:
    return {"code": 501, "message": f"TODO: activate {agent_id} (week 2)"}


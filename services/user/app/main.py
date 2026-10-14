"""User Service."""
from fastapi import FastAPI

app = FastAPI(title="User Service", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "user"}


@app.post("/api/v1/users/register", status_code=201)
def register() -> dict:
    return {"code": 501, "message": "TODO: register (week 2)"}


@app.post("/api/v1/users/login")
def login() -> dict:
    return {"code": 501, "message": "TODO: login (week 2)"}


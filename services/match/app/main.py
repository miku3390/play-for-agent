"""Match Service: 起对局、WebSocket 实时事件流。

- POST /api/v1/matches          起一局（body 可带完整人格提示词；缺省用 strategies/ 占位文件或 mock）
- GET  /api/v1/matches/{id}     查询状态 / 结果
- WS   /ws/matches/{id}         实时事件流（连上先补发历史回放，再 live 推送，结束发 RESULT）

注：对局状态存进程内存（MATCHES），开发用；Redis/PG 持久化是后续里程碑的事。
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from dataclasses import asdict
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[3]
for _p in (ROOT / "engine" / "src", ROOT / "runtime" / "src"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from handkerchief_runtime import EventBus, MatchRunner, ScriptedAgent  # noqa: E402
from handkerchief_runtime.agents import (  # noqa: E402
    LLMAgent,
    early_dropper,
    late_checker,
    mid_checker,
    patient_never_drop,
)
from handkerchief_runtime.env import load_env_file  # noqa: E402

load_env_file(ROOT / ".env")

app = FastAPI(title="Match Service", version="0.2.0")

STRATEGY_FILES = [
    ROOT / "strategies" / "patient_dropper.txt",
    ROOT / "strategies" / "aggressive_checker.txt",
]


class AgentSpec(BaseModel):
    name: str
    system_prompt: str | None = None  # 完整人格配置；缺省回落到 strategies/ 占位文件


class MatchRequest(BaseModel):
    agent_a: AgentSpec
    agent_b: AgentSpec
    # 上限护栏：rounds 无限大 = LLM 成本失控（单局最多 50 轮，够出结果了）
    rounds: int = Field(default=10, ge=1, le=50)
    mock: bool = False  # 离线脚本 agent，不调 LLM


class MatchState:
    def __init__(self, match_id: str) -> None:
        self.match_id = match_id
        self.events: list[dict] = []          # 回放缓冲
        self.queues: list[asyncio.Queue] = []  # 每个 WS 订阅者一个队列
        self.result: dict | None = None
        self.status = "running"


MATCHES: dict[str, MatchState] = {}


def _sink(state: MatchState):
    def sink(e) -> None:
        d = asdict(e)
        d["_seq"] = len(state.events)
        state.events.append(d)
        for q in state.queues:
            q.put_nowait(d)
    return sink


def _build_agent(spec: AgentSpec, mock: bool, idx: int):
    if mock:
        return (
            ScriptedAgent(spec.name, early_dropper, mid_checker)
            if idx == 0
            else ScriptedAgent(spec.name, patient_never_drop, late_checker)
        )
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        # 缺 key 直接 4xx 拒绝，而不是等对局跑起来第一回合炸成 500
        raise HTTPException(status_code=422, detail="missing DEEPSEEK_API_KEY（填进 .env 或环境变量；离线演示用 mock:true）")
    prompt = spec.system_prompt
    if prompt is None:
        prompt = STRATEGY_FILES[idx].read_text(encoding="utf-8")
    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        base_url=os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        api_key=api_key,
        timeout=60.0,
    )
    return LLMAgent(spec.name, prompt, client, os.environ.get("ARENA_MODEL", "deepseek-chat"))


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "match"}


@app.post("/api/v1/matches", status_code=201)
async def create_match(req: MatchRequest) -> dict:
    # 同名会让观战页的 HP 条互相覆盖（deriveHp 用名字当 key），直接拒绝
    if req.agent_a.name == req.agent_b.name:
        raise HTTPException(status_code=422, detail="agent_a.name 与 agent_b.name 必须不同")
    match_id = uuid.uuid4().hex[:8]
    state = MatchState(match_id)
    MATCHES[match_id] = state

    bus = EventBus()
    bus.subscribe(_sink(state))
    runner = MatchRunner(bus=bus, max_rounds=req.rounds)
    agent_a = _build_agent(req.agent_a, req.mock, 0)
    agent_b = _build_agent(req.agent_b, req.mock, 1)

    async def _run() -> None:
        try:
            state.result = await runner.play(agent_a, agent_b, match_id=match_id)
        except Exception as exc:
            state.result = {"error": f"{type(exc).__name__}: {exc}"}
        finally:
            state.status = "finished"
            _prune_finished()
            for q in state.queues:
                q.put_nowait(None)  # 哨兵：通知所有订阅者收工

    asyncio.create_task(_run())
    return {"code": 200, "message": "ok", "data": {"match_id": match_id, "status": "running"}}


MATCH_MEMORY = 50


def _prune_finished() -> None:
    """MATCHES 只进不出会拖死长跑进程：最多保留 50 局已结束的对局。"""
    finished = [mid for mid, s in MATCHES.items() if s.status == "finished"]
    for mid in finished[:-MATCH_MEMORY]:
        MATCHES.pop(mid, None)


@app.get("/api/v1/matches/{match_id}")
def get_match(match_id: str) -> dict:
    state = MATCHES.get(match_id)
    if state is None:
        return {"code": 404, "message": "match not found", "data": None}
    return {"code": 200, "message": "ok",
            "data": {"match_id": match_id, "status": state.status,
                     "events": len(state.events), "result": state.result}}


@app.websocket("/ws/matches/{match_id}")
async def watch_match(ws: WebSocket, match_id: str) -> None:
    state = MATCHES.get(match_id)
    if state is None:
        await ws.close(code=4404)
        return
    await ws.accept()
    q: asyncio.Queue = asyncio.Queue()
    # 先上证、后快照：反过来的话，补发历史与入列之间产生的查询会被永久跳过
    state.queues.append(q)
    try:
        snapshot = list(state.events)
        for d in snapshot:
            await ws.send_json(d)
        seen = len(snapshot)
        if state.status == "finished":
            await ws.send_json({"type": "RESULT", "match_id": match_id, "payload": state.result})
            return
        while True:
            item = await q.get()
            if item is None:
                break
            if item.get("_seq", 0) < seen:
                continue  # 去重：补发历史时已发过
            await ws.send_json(item)
        await ws.send_json({"type": "RESULT", "match_id": match_id, "payload": state.result})
    except WebSocketDisconnect:
        pass
    finally:
        if q in state.queues:
            state.queues.remove(q)
        try:
            await ws.close()
        except Exception:
            pass

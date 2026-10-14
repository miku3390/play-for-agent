"""Match-level driver: rounds, role swaps, win detection.

Scaffold only — 接入对战服务（services/match）时补全：
- Agent 决策调用（沙箱 / LLM 网关）与超时降级为 WAIT
- 随机种子驱动的可复现随机源
- 每回合事件回调（WebSocket 广播、turns 表持久化）
"""
from __future__ import annotations

from .engine import HandkerchiefEngine
from .models import EngineConfig


class MatchRunner:
    """Drives a full match between two agents. (TODO: implement with Match Service)"""

    def __init__(self, engine: HandkerchiefEngine | None = None) -> None:
        self.engine = engine or HandkerchiefEngine(EngineConfig())

    def run(self) -> None:
        raise NotImplementedError("Match loop lands with the Match Service (milestone week 3).")

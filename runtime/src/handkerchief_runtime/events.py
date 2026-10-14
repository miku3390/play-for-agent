"""Typed event stream: every state change of a match is an event.

订阅者可以是控制台打印、JSONL 落盘、（未来）WebSocket 广播——标准事件总线。
"""
from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable

# 事件类型常量
MATCH_START = "MATCH_START"
ROUND_START = "ROUND_START"
TURN_END = "TURN_END"
ROUND_END = "ROUND_END"
MATCH_END = "MATCH_END"


@dataclass
class Event:
    type: str
    match_id: str
    payload: dict[str, Any]
    ts: float = field(default_factory=time.time)


class EventBus:
    def __init__(self) -> None:
        self._subs: list[Callable[[Event], None]] = []

    def subscribe(self, fn: Callable[[Event], None]) -> None:
        self._subs.append(fn)

    def emit(self, type_: str, match_id: str, **payload: Any) -> None:
        e = Event(type=type_, match_id=match_id, payload=payload)
        for fn in self._subs:
            fn(e)


class JsonlSink:
    """Each event as one JSON line — replay/audit 的原始素材。"""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def __call__(self, e: Event) -> None:
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(e), ensure_ascii=False) + "\n")


def console_printer(e: Event) -> None:
    p = e.payload
    if e.type == MATCH_START:
        print(f"\n=== 对局开始 {e.match_id[:8]} | {p['agent_a']} vs {p['agent_b']} | 首轮攻方 {p['attacker_first']} ===")
    elif e.type == ROUND_START:
        print(f"\n-- 第 {p['round']} 轮 | 攻方 {p['attacker']} 守方 {p['defender']} | HP {p['attacker_hp']} : {p['defender_hp']}")
    elif e.type == TURN_END:
        bleed = f" 流血-{p['bleed']}" if p.get("bleed") else ""
        timeout = " [超时降级]" if p.get("timed_out") else ""
        print(f"  回合 {p['turn']:>2} | 攻 {p['attacker_action']:<4} 守 {p['defender_action']:<4} "
              f"| {p['result']:<12} | HP {p['attacker_hp']:>2} : {p['defender_hp']:>2}{bleed}{timeout}")
    elif e.type == ROUND_END:
        print(f"  >> 轮结束: {p['result']} | HP {p['attacker_hp']} : {p['defender_hp']}")
    elif e.type == MATCH_END:
        print(f"\n=== 对局结束 | 胜方 {p['winner'] or '平局'} | {p['finish_reason']} | "
              f"{p['total_rounds']} 轮 {p['total_turns']} 回合 ===")

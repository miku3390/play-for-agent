"""CLI demo: two agents play a full match of Handkerchief Arena.

用法：
  离线（无需 API）：  python demo/run_match.py --mock
  接入 DeepSeek：     python demo/run_match.py --rounds 10
                      （先填 .env 或设置 DEEPSEEK_API_KEY）
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys as _sys

if hasattr(_sys.stdout, "reconfigure"):
    _sys.stdout.reconfigure(encoding="utf-8")
import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine" / "src"))
sys.path.insert(0, str(ROOT / "runtime" / "src"))

from handkerchief_runtime import (  # noqa: E402
    EventBus, JsonlSink, LLMAgent, MatchRunner, ScriptedAgent, console_printer,
)
from handkerchief_runtime.agents import (  # noqa: E402
    early_dropper, late_checker, mid_checker, patient_never_drop,
)


MEMORY_DIR = ROOT / "memories"


def load_memory(agent) -> None:
    p = MEMORY_DIR / f"{agent.name}.json"
    if p.exists():
        agent.memory.summaries = json.loads(p.read_text(encoding="utf-8")).get("summaries", [])


def save_memory(agent) -> None:
    MEMORY_DIR.mkdir(exist_ok=True)
    p = MEMORY_DIR / f"{agent.name}.json"
    p.write_text(json.dumps({"summaries": agent.memory.summaries}, ensure_ascii=False, indent=2),
                 encoding="utf-8")


def load_env() -> None:
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def build_llm_agents(args) -> tuple[LLMAgent, LLMAgent]:
    from openai import AsyncOpenAI

    prompt_a = Path(args.prompt_a).read_text(encoding="utf-8")
    prompt_b = Path(args.prompt_b).read_text(encoding="utf-8")
    client = AsyncOpenAI(
        base_url=os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        api_key=os.environ["DEEPSEEK_API_KEY"],
        timeout=args.timeout,
    )
    model = os.environ.get("ARENA_MODEL", "deepseek-chat")
    return (
        LLMAgent("A-忍耐型", prompt_a, client, model, max_rounds=args.rounds),
        LLMAgent("B-激进型", prompt_b, client, model, max_rounds=args.rounds),
    )


def build_mock_agents() -> tuple[ScriptedAgent, ScriptedAgent]:
    return (
        ScriptedAgent("A-早丢手绢", early_dropper, mid_checker),
        ScriptedAgent("B-按兵不动", patient_never_drop, late_checker),
    )


async def main() -> None:
    ap = argparse.ArgumentParser(description="Handkerchief Arena match demo")
    ap.add_argument("--mock", action="store_true", help="离线脚本 agent，不调用 API")
    ap.add_argument("--rounds", type=int, default=10, help="最大轮数（默认 10）")
    ap.add_argument("--timeout", type=float, default=30.0, help="单次决策超时秒数")
    ap.add_argument("--prompt-a", default=str(ROOT / "strategies" / "patient_dropper.txt"))
    ap.add_argument("--prompt-b", default=str(ROOT / "strategies" / "aggressive_checker.txt"))
    ap.add_argument("--log-dir", default=str(ROOT / "logs"))
    args = ap.parse_args()

    load_env()
    if not args.mock and not os.environ.get("DEEPSEEK_API_KEY"):
        sys.exit("缺少 DEEPSEEK_API_KEY：填进 .env 或设为环境变量（离线演示用 --mock）")

    bus = EventBus()
    bus.subscribe(console_printer)
    bus.subscribe(JsonlSink(Path(args.log_dir) / f"match-{uuid.uuid4().hex[:8]}.jsonl"))

    agents = build_mock_agents() if args.mock else build_llm_agents(args)
    for a in agents:
        load_memory(a)
    runner = MatchRunner(bus=bus, max_rounds=args.rounds, decision_timeout_s=args.timeout)
    result = await runner.play(*agents)
    for a in agents:
        save_memory(a)

    print("\n--- 跨局记忆（已持久化到 memories/，下一局注入 system prompt）---")
    for a in agents:
        print(f"[{a.name}] {a.memory.render()}")
    print("\n结果:", result)


if __name__ == "__main__":
    asyncio.run(main())
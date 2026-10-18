"""Agent implementations: LLM-backed and scripted (offline/test)."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from handkerchief_engine import Action, EngineConfig

from .context import CrossMatchMemory, MatchContext
from .parser import parse_action

GAME_RULES = """你在玩"丢手绢"博弈。每局最多 {max_rounds} 轮，每轮最多 {max_turns} 回合。
每轮一名攻方一名守方，轮结束交换身份。初始 HP 各 {hp}，先归零者输。

攻方：每回合选 DROP（悄悄丢下手绢）或 WAIT。手绢一旦落地，守方每回合流血 -{bleed} HP。你的等待有计息：
守方检查命中时你 -{loss} HP，另按丢下的回合号每回合多扣 {chrono} HP（第 n 回合丢就多扣 {chrono}×(n-1)，越晚丢亏越多）；
守方查空收局（或你整轮不丢走满）时按已等待回合数每回合扣 {chrono} HP；整轮不丢走满还要额外吃 -{never} HP 失职罚。
守方：每回合选 CHECK（回头检查）或 WAIT。检查命中（手绢已落地）：守方 +{gain} HP；
检查落空：守方 -({penalty}+当前回合数) HP。第 {max_turns} 回合结束强制检查。
守方看不到手绢是否已落地——只能靠对手行为推理。

只回答一个单词：攻方回答 DROP 或 WAIT，守方回答 CHECK 或 WAIT。不要解释。"""


@dataclass
class AgentDecision:
    action: Action
    raw: str | None = None
    latency_ms: int = 0
    timed_out: bool = False
    error: str | None = None


class BaseAgent:
    """所有 agent 的统一接口。记忆/skill/deepagents 接入时替换 decide 即可。"""

    def __init__(self, name: str, system_prompt: str = "") -> None:
        self.name = name
        self.system_prompt = system_prompt
        self.memory = CrossMatchMemory()
        self.context = MatchContext()

    def reset_context(self) -> None:
        self.context = MatchContext()

    async def decide(self, view: dict, context_text: str) -> AgentDecision:
        raise NotImplementedError


class LLMAgent(BaseAgent):
    """OpenAI 兼容 API（DeepSeek 等）。system prompt = 用户策略。"""

    def __init__(
        self,
        name: str,
        system_prompt: str,
        client,  # openai.AsyncOpenAI
        model: str,
        max_rounds: int = 10,
        temperature: float = 0.7,
        engine_config: EngineConfig | None = None,
    ) -> None:
        super().__init__(name, system_prompt)
        self.client = client
        self.model = model
        self.max_rounds = max_rounds
        self.temperature = temperature
        # 规则说话要跟实际用到的引擎一致，否则提示词在对局参数被改时变成谎言
        self.engine_config = engine_config or EngineConfig()

    def _system(self) -> str:
        c = self.engine_config
        rules = GAME_RULES.format(max_rounds=self.max_rounds, max_turns=c.max_turns_per_round,
                                  hp=c.initial_hp, bleed=c.dropped_bleed_per_turn,
                                  chrono=c.atk_chrono, never=c.never_atk,
                                  gain=c.hit_defender_gain, loss=c.hit_attacker_loss,
                                  penalty=c.miss_penalty)
        parts = [self.system_prompt.strip() or "你是一个冷静的策略型玩家。", rules, self.memory.render()]
        return "\n\n".join(parts)

    async def decide(self, view: dict, context_text: str) -> AgentDecision:
        import json
        import time

        user = f"当前状态：\n{json.dumps(view, ensure_ascii=False, indent=2)}\n\n本局历史：\n{context_text}\n\n你的动作？"
        t0 = time.monotonic()
        try:
            resp = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._system()},
                    {"role": "user", "content": user},
                ],
                temperature=self.temperature,
                max_tokens=16,
            )
            text = resp.choices[0].message.content
            action, raw = parse_action(text, view["role"])
            return AgentDecision(action=action, raw=text, latency_ms=int((time.monotonic() - t0) * 1000))
        except Exception as exc:  # 网络/限流/解析异常一律降级 WAIT，不拖垮对局
            return AgentDecision(action=Action.WAIT, error=f"{type(exc).__name__}: {exc}",
                                 latency_ms=int((time.monotonic() - t0) * 1000))


Policy = Callable[[dict], Action]


class ScriptedAgent(BaseAgent):
    """离线/测试用确定性 agent。"""

    def __init__(self, name: str, attacker_policy: Policy, defender_policy: Policy) -> None:
        super().__init__(name)
        self._attacker = attacker_policy
        self._defender = defender_policy

    async def decide(self, view: dict, context_text: str) -> AgentDecision:
        await asyncio.sleep(0)
        fn = self._attacker if view["role"] == "attacker" else self._defender
        return AgentDecision(action=fn(view))


def early_dropper(view: dict) -> Action:
    return Action.DROP if view["turn"] <= 2 else Action.WAIT


def patient_never_drop(view: dict) -> Action:
    return Action.WAIT


def mid_checker(view: dict) -> Action:
    return Action.CHECK if view["turn"] >= 6 else Action.WAIT


def late_checker(view: dict) -> Action:
    return Action.CHECK if view["turn"] >= 8 else Action.WAIT

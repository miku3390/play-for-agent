"""Match runner: drives rounds/turns, parallel decisions, event emission.

- 双方决策并行（asyncio.gather），单方超时降级 WAIT 不阻塞对方
- 守方视角隐藏 handkerchief_dropped（信息隐藏，否则 CHECK 是开卷考试）
- 每个状态变化都发事件；跨局记忆在 match_end 时写入
"""
from __future__ import annotations

import asyncio
import time
import uuid

from handkerchief_engine import Action, EngineConfig, HandkerchiefEngine, RoundState

from .agents import AgentDecision, BaseAgent
from .context import TurnRecord
from .events import MATCH_END, MATCH_START, ROUND_END, ROUND_START, TURN_END, EventBus


class MatchRunner:
    def __init__(
        self,
        bus: EventBus | None = None,
        max_rounds: int = 10,
        decision_timeout_s: float = 30.0,
        engine: HandkerchiefEngine | None = None,
    ) -> None:
        self.bus = bus or EventBus()
        self.max_rounds = max_rounds
        self.decision_timeout_s = decision_timeout_s
        self.engine = engine or HandkerchiefEngine(EngineConfig())

    async def play(self, agent_a: BaseAgent, agent_b: BaseAgent, match_id: str | None = None) -> dict:
        match_id = match_id or str(uuid.uuid4())
        hp = {agent_a.name: 50, agent_b.name: 50}
        agent_a.reset_context()
        agent_b.reset_context()
        total_turns = 0
        finish_reason = "max_rounds"
        winner: str | None = None

        self.bus.emit(MATCH_START, match_id, agent_a=agent_a.name, agent_b=agent_b.name,
                      attacker_first=agent_a.name, max_rounds=self.max_rounds)

        for round_no in range(1, self.max_rounds + 1):
            attacker, defender = (agent_a, agent_b) if round_no % 2 == 1 else (agent_b, agent_a)
            state = RoundState(round_number=round_no,
                               attacker_hp=hp[attacker.name], defender_hp=hp[defender.name])
            self.bus.emit(ROUND_START, match_id, round=round_no,
                          attacker=attacker.name, defender=defender.name,
                          attacker_hp=state.attacker_hp, defender_hp=state.defender_hp)

            result = "CONTINUE"
            for turn in range(1, self.engine.config.max_turns_per_round + 1):
                state.turn_number = turn
                dec_a, dec_d = await self._decide_both(attacker, defender, state, match_id, round_no, turn)
                before = (state.attacker_hp, state.defender_hp)
                out = self.engine.resolve_turn(state, dec_a.action, dec_d.action)
                result = out["result"]
                total_turns += 1
                hp[attacker.name], hp[defender.name] = out["hp_attacker"], out["hp_defender"]

                self._record(attacker, dec_a.action, dec_d.action,
                             before, (state.attacker_hp, state.defender_hp), round_no, turn, result)
                self._record(defender, dec_d.action, dec_a.action,
                             (before[1], before[0]), (state.defender_hp, state.attacker_hp),
                             round_no, turn, result)
                self.bus.emit(TURN_END, match_id, round=round_no, turn=turn,
                              attacker_action=dec_a.action.value, defender_action=dec_d.action.value,
                              attacker_hp=state.attacker_hp, defender_hp=state.defender_hp,
                              bleed=out["bleed"], result=result,
                              timed_out=dec_a.timed_out or dec_d.timed_out,
                              latency_ms=max(dec_a.latency_ms, dec_d.latency_ms))

                if state.attacker_hp <= 0 or state.defender_hp <= 0:
                    finish_reason = "hp_zero"
                    break
                if out["round_end"]:
                    break

            reason = "hp_zero" if finish_reason == "hp_zero" else None
            self.bus.emit(ROUND_END, match_id, round=round_no, result=result, reason=reason,
                          attacker=attacker.name, attacker_hp=state.attacker_hp,
                          defender=defender.name, defender_hp=state.defender_hp)
            if finish_reason == "hp_zero":
                winner = attacker.name if state.defender_hp <= 0 else defender.name
                break

        summary_a = self._summary(agent_a, agent_b, winner, hp, round_no, total_turns)
        summary_b = self._summary(agent_b, agent_a, winner, hp, round_no, total_turns)
        agent_a.memory.add_match_summary(summary_a)
        agent_b.memory.add_match_summary(summary_b)
        self.bus.emit(MATCH_END, match_id, winner=winner, finish_reason=finish_reason,
                      total_rounds=round_no, total_turns=total_turns,
                      final_hp=dict(hp))
        return {"match_id": match_id, "winner": winner, "finish_reason": finish_reason,
                "rounds": round_no, "turns": total_turns, "final_hp": dict(hp)}

    async def _decide_both(self, attacker: BaseAgent, defender: BaseAgent,
                           state: RoundState, match_id: str, round_no: int, turn: int,
                           ) -> tuple[AgentDecision, AgentDecision]:
        view_a = self._view(state, match_id, round_no, turn, "attacker")
        view_d = self._view(state, match_id, round_no, turn, "defender")
        dec_a, dec_d = await asyncio.gather(
            self._with_timeout(attacker, view_a),
            self._with_timeout(defender, view_d),
        )
        return dec_a, dec_d

    async def _with_timeout(self, agent: BaseAgent, view: dict) -> AgentDecision:
        try:
            return await asyncio.wait_for(
                agent.decide(view, agent.context.render()), timeout=self.decision_timeout_s)
        except asyncio.TimeoutError:
            return AgentDecision(action=Action.WAIT, timed_out=True)
        except Exception as exc:
            return AgentDecision(action=Action.WAIT, error=f"{type(exc).__name__}: {exc}")

    def _view(self, state: RoundState, match_id: str, round_no: int, turn: int, role: str) -> dict:
        view = {
            "match_id": match_id,
            "round": round_no,
            "turn": turn,
            "role": role,
            "max_turns_per_round": self.engine.config.max_turns_per_round,
            "my_hp": state.attacker_hp if role == "attacker" else state.defender_hp,
            "opponent_hp": state.defender_hp if role == "attacker" else state.attacker_hp,
        }
        if role == "attacker":
            view["handkerchief_dropped"] = state.handkerchief_dropped
        # 守方视角刻意不给 handkerchief_dropped —— 信息隐藏
        return view

    @staticmethod
    def _record(agent: BaseAgent, my: Action, opp: Action,
                before: tuple[int, int], after: tuple[int, int],
                round_no: int, turn: int, result: str) -> None:
        agent.context.add(TurnRecord(
            round=round_no, turn=turn, my_action=my.value, opponent_action=opp.value,
            my_hp_before=before[0], my_hp_after=after[0],
            opponent_hp_before=before[1], opponent_hp_after=after[1],
            result=result,
        ))

    @staticmethod
    def _summary(agent: BaseAgent, opp: BaseAgent, winner: str | None,
                 hp: dict[str, int], rounds: int, turns: int) -> str:
        outcome = "胜" if winner == agent.name else ("负" if winner == opp.name else "平")
        return (f"vs {opp.name}: {outcome}（{rounds}轮{turns}回合，"
                f"终局 HP 我{hp[agent.name]} / 敌{hp[opp.name]}）")
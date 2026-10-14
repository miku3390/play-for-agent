"""Context management: per-match detail + cross-match memory.

标准两层结构：
- 局内：最近 N 轮完整明细 + 更早轮次一行摘要（控制 token 膨胀）
- 跨局：每局结束后追加一行对局摘要，注入下局 prompt（"前几局的上下文"）
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TurnRecord:
    round: int
    turn: int
    my_action: str
    opponent_action: str
    my_hp_before: int
    my_hp_after: int
    opponent_hp_before: int
    opponent_hp_after: int
    result: str


@dataclass
class MatchContext:
    """单局内、单个 agent 视角的历史。"""

    recent_rounds: int = 3
    records: list[TurnRecord] = field(default_factory=list)

    def add(self, rec: TurnRecord) -> None:
        self.records.append(rec)

    def render(self) -> str:
        if not self.records:
            return "（本局还没有历史）"
        cutoff_round = max(r.round for r in self.records) - self.recent_rounds
        old = [r for r in self.records if r.round <= cutoff_round]
        recent = [r for r in self.records if r.round > cutoff_round]

        parts: list[str] = []
        if old:
            parts.append("较早轮次摘要：")
            by_round: dict[int, list[TurnRecord]] = {}
            for r in old:
                by_round.setdefault(r.round, []).append(r)
            for rnd, recs in sorted(by_round.items()):
                last = recs[-1]
                parts.append(
                    f"  第{rnd}轮 {len(recs)}回合 结束于{last.result} "
                    f"HP {last.my_hp_after}:{last.opponent_hp_after}"
                )
        parts.append("最近轮次明细：")
        for r in recent:
            parts.append(
                f"  R{r.round}T{r.turn} 我{r.my_action}/敌{r.opponent_action} "
                f"-> {r.result} HP {r.my_hp_before}->{r.my_hp_after} "
                f"(敌 {r.opponent_hp_before}->{r.opponent_hp_after})"
            )
        return "\n".join(parts)


@dataclass
class CrossMatchMemory:
    """跨局记忆：每局一条摘要。后续的记忆/skill 系统替换这个类即可。"""

    max_entries: int = 5
    summaries: list[str] = field(default_factory=list)

    def add_match_summary(self, summary: str) -> None:
        self.summaries.append(summary)
        del self.summaries[:-self.max_entries]

    def render(self) -> str:
        if not self.summaries:
            return "（没有过往对局记录）"
        lines = ["过往对局（最近在上）："]
        lines += [f"  {s}" for s in reversed(self.summaries)]
        return "\n".join(lines)

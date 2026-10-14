"""Core data structures for the Handkerchief Arena rules engine."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Action(str, Enum):
    DROP = "DROP"
    WAIT = "WAIT"
    CHECK = "CHECK"


class TurnResult(str, Enum):
    CONTINUE = "CONTINUE"
    HIT = "HIT"                  # defender checked and the handkerchief was down
    MISS = "MISS"                # defender checked but nothing had been dropped
    FORCED_HIT = "FORCED_HIT"    # forced check on the last turn, dropped
    FORCED_MISS = "FORCED_MISS"  # forced check on the last turn, not dropped


@dataclass
class EngineConfig:
    max_turns_per_round: int = 10
    miss_penalty: int = 10
    hit_defender_gain: int = 5
    hit_attacker_loss: int = 10
    initial_hp: int = 50
    # TODO(balance): 攻方 DROP 目前只有风险没有收益，占优策略退化为"永不 DROP"。
    # 落地前必须补上攻方收益数值（如 drop_reward / 延迟丢弃加成），否则博弈不成立。
    # 见 docs/handkerchief-arena-architecture.md 附录 A。


@dataclass
class RoundState:
    round_number: int
    turn_number: int = 1
    attacker_hp: int = 50
    defender_hp: int = 50
    handkerchief_dropped: bool = False
    dropped_turn: int | None = None
    checked_turn: int | None = None

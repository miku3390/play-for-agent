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
    # 手绢落地后、守方未检查的每个回合，守方流血扣血（暂定值，待对局实测调平）。
    # 作用：给攻方 DROP 提供收益，否则占优策略退化为"永不 DROP"（博弈不成立）。
    dropped_bleed_per_turn: int = 2


@dataclass
class RoundState:
    round_number: int
    turn_number: int = 1
    attacker_hp: int = 50
    defender_hp: int = 50
    handkerchief_dropped: bool = False
    dropped_turn: int | None = None
    checked_turn: int | None = None
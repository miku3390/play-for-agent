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
    # 手绢落地后、守方未检查的每个回合，守方流血扣血。
    # 作用：让 DROP 对守方形成持续压力（否则守方可以无限等）。
    dropped_bleed_per_turn: int = 2
    # 攻方等待计息：命中按丢下回合 (d-1) 结账，查空按等待回合 (k-1) 结账。
    # 没有它，DROP 在任何 bleed 值下都是弱被占优策略（见 lab/balance_scan.py 表1）。
    atk_chrono: int = 1
    # 整轮不丢、走满强制结算的失职罚。与攻方计息合持时，"什么都不做"的代价
    # 必须高于"做了但被抓"（设计定律：never_atk 必须 > hit_attacker_loss）。
    never_atk: int = 15


@dataclass
class RoundState:
    round_number: int
    turn_number: int = 1
    attacker_hp: int = 50
    defender_hp: int = 50
    handkerchief_dropped: bool = False
    dropped_turn: int | None = None
    checked_turn: int | None = None
"""Turn resolution logic (architecture doc, appendix A)."""
from __future__ import annotations

from .models import Action, EngineConfig, RoundState, TurnResult


class HandkerchiefEngine:
    """Resolves one turn of a round at a time. Pure and deterministic."""

    def __init__(self, config: EngineConfig | None = None) -> None:
        self.config = config or EngineConfig()

    def resolve_turn(
        self,
        state: RoundState,
        attacker_action: Action,
        defender_action: Action,
    ) -> dict:
        cfg = self.config
        dropped = state.handkerchief_dropped

        if attacker_action == Action.DROP and not dropped:
            dropped = True
            state.dropped_turn = state.turn_number

        if defender_action == Action.CHECK:
            result, round_end = self._resolve_check(state, dropped, forced=False)
        elif state.turn_number >= cfg.max_turns_per_round:
            # 最后一回合守方未主动检查 -> 强制检查
            result, round_end = self._resolve_check(state, dropped, forced=True)
        else:
            result, round_end = TurnResult.CONTINUE, False

        # 手绢已落地且本回合未发生检查：守方流血（DROP 的收益来源）
        bleed = 0
        if dropped and not round_end:
            bleed = self.config.dropped_bleed_per_turn
            state.defender_hp -= bleed

        state.handkerchief_dropped = dropped
        state.attacker_hp = max(0, state.attacker_hp)
        state.defender_hp = max(0, state.defender_hp)

        return {
            "hp_attacker": state.attacker_hp,
            "hp_defender": state.defender_hp,
            "handkerchief_dropped": state.handkerchief_dropped,
            "bleed": bleed,
            "result": result.value,
            "round_end": round_end,
        }

    def _resolve_check(self, state: RoundState, dropped: bool, forced: bool):
        cfg = self.config
        k = state.turn_number
        state.checked_turn = k
        if dropped:
            state.defender_hp += cfg.hit_defender_gain
            # 攻方收益/代价：命中惩罚 + 自己的等待计息（丢下那一刻停止计息）
            state.attacker_hp -= cfg.hit_attacker_loss
            if cfg.atk_chrono and state.dropped_turn:
                state.attacker_hp -= cfg.atk_chrono * (state.dropped_turn - 1)
            return (TurnResult.FORCED_HIT if forced else TurnResult.HIT), True
        # 查空：守方吃 (miss + k)；攻方的等待计息记到回合终结为止
        state.defender_hp -= cfg.miss_penalty + k
        if cfg.atk_chrono:
            state.attacker_hp -= cfg.atk_chrono * (k - 1)
        if k >= cfg.max_turns_per_round and cfg.atk_chrono:
            # 走满且从未丢下 → 失职罚（"什么都不做"的代价要高于"做了但被抓"）；
            # 无论守方是拖到强制检查还是第 max_turns 回合主动查
            state.attacker_hp -= cfg.never_atk
        return (TurnResult.FORCED_MISS if forced else TurnResult.MISS), True
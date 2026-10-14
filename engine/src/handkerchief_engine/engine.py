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

        state.handkerchief_dropped = dropped
        state.attacker_hp = max(0, state.attacker_hp)
        state.defender_hp = max(0, state.defender_hp)

        return {
            "hp_attacker": state.attacker_hp,
            "hp_defender": state.defender_hp,
            "handkerchief_dropped": state.handkerchief_dropped,
            "result": result.value,
            "round_end": round_end,
        }

    def _resolve_check(self, state: RoundState, dropped: bool, forced: bool):
        cfg = self.config
        k = state.turn_number
        state.checked_turn = k
        if dropped:
            state.defender_hp += cfg.hit_defender_gain
            state.attacker_hp -= cfg.hit_attacker_loss
            return (TurnResult.FORCED_HIT if forced else TurnResult.HIT), True
        state.defender_hp -= cfg.miss_penalty + k
        return (TurnResult.FORCED_MISS if forced else TurnResult.MISS), True

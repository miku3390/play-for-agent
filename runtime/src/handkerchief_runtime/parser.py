"""Strict action parsing: LLM output -> Action. Illegal output degrades to WAIT."""
from __future__ import annotations

import re

from handkerchief_engine import Action

_TOKEN = re.compile(r"\b(DROP|CHECK|WAIT)\b", re.IGNORECASE)
_VALID_BY_ROLE = {
    "attacker": {Action.DROP, Action.WAIT},
    "defender": {Action.CHECK, Action.WAIT},
}


def parse_action(text: str | None, role: str) -> tuple[Action, str | None]:
    """Return (action, raw_token). Last valid token wins; nothing valid -> WAIT.

    取最后一个合法 token：模型先解释后给结论时，结论通常在末尾。
    """
    valid = _VALID_BY_ROLE[role]
    raw: str | None = None
    for m in _TOKEN.finditer(text or ""):
        candidate = Action(m.group(1).upper())
        if candidate in valid:
            raw = candidate.value
    if raw is None:
        return Action.WAIT, None
    return Action(raw), raw

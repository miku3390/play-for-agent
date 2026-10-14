from handkerchief_engine import Action, EngineConfig, HandkerchiefEngine, RoundState


def make_engine() -> HandkerchiefEngine:
    return HandkerchiefEngine(EngineConfig())


def test_drop_then_check_is_hit():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=3)
    out = engine.resolve_turn(state, Action.DROP, Action.CHECK)
    assert out["result"] == "HIT"
    assert out["round_end"] is True
    assert out["hp_attacker"] == 40
    assert out["hp_defender"] == 55
    assert state.dropped_turn == 3


def test_check_without_drop_is_miss_with_turn_penalty():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=4)
    out = engine.resolve_turn(state, Action.WAIT, Action.CHECK)
    assert out["result"] == "MISS"
    assert out["hp_defender"] == 50 - (10 + 4)
    assert out["hp_attacker"] == 50


def test_last_turn_forces_check():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=10)
    out = engine.resolve_turn(state, Action.WAIT, Action.WAIT)
    assert out["result"] == "FORCED_MISS"
    assert out["round_end"] is True
    assert out["hp_defender"] == 50 - 20


def test_last_turn_forced_hit_when_dropped():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=9, handkerchief_dropped=True, dropped_turn=7)
    out = engine.resolve_turn(state, Action.WAIT, Action.WAIT)
    assert out["result"] == "CONTINUE"
    state.turn_number = 10
    out = engine.resolve_turn(state, Action.WAIT, Action.WAIT)
    assert out["result"] == "FORCED_HIT"
    assert out["hp_attacker"] == 40
    assert out["hp_defender"] == 55


def test_hp_floors_at_zero():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=10, defender_hp=5)
    out = engine.resolve_turn(state, Action.WAIT, Action.WAIT)
    assert out["hp_defender"] == 0


def test_drop_is_sticky_within_round():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=2)
    engine.resolve_turn(state, Action.DROP, Action.WAIT)
    assert state.handkerchief_dropped is True
    out = engine.resolve_turn(state, Action.WAIT, Action.CHECK)
    assert out["result"] == "HIT"

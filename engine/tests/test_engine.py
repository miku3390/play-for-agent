from handkerchief_engine import Action, EngineConfig, HandkerchiefEngine, RoundState


def make_engine() -> HandkerchiefEngine:
    return HandkerchiefEngine(EngineConfig())


def test_drop_then_check_is_hit():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=3)
    out = engine.resolve_turn(state, Action.DROP, Action.CHECK)
    assert out["result"] == "HIT"
    assert out["round_end"] is True
    assert out["hp_attacker"] == 38          # -10 命中 - 2 计息(第3回合丢, 1x(3-1))
    assert out["hp_defender"] == 55
    assert state.dropped_turn == 3


def test_check_without_drop_is_miss_with_turn_penalty():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=4)
    out = engine.resolve_turn(state, Action.WAIT, Action.CHECK)
    assert out["result"] == "MISS"
    assert out["hp_defender"] == 50 - (10 + 4)
    assert out["hp_attacker"] == 50 - 3      # 攻方等待计息 1x(4-1)


def test_last_turn_forces_check():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=10)
    out = engine.resolve_turn(state, Action.WAIT, Action.WAIT)
    assert out["result"] == "FORCED_MISS"
    assert out["round_end"] is True
    assert out["hp_defender"] == 50 - 20
    assert out["hp_attacker"] == 50 - 9 - 15  # 走满计息 9 + 失职罚 15


def test_last_turn_forced_hit_when_dropped():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=9, handkerchief_dropped=True, dropped_turn=7)
    out = engine.resolve_turn(state, Action.WAIT, Action.WAIT)
    assert out["result"] == "CONTINUE"
    state.turn_number = 10
    out = engine.resolve_turn(state, Action.WAIT, Action.WAIT)
    assert out["result"] == "FORCED_HIT"
    assert out["hp_attacker"] == 50 - 10 - 6  # 命中 -10 + 计息 1x(7-1)
    assert out["hp_defender"] == 50 - 2 + 5  # 第 9 回合流血 2 点，强制检查命中回 5 点


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
def test_dropped_handkerchief_bleeds_defender_each_unchecked_turn():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=2)
    out = engine.resolve_turn(state, Action.DROP, Action.WAIT)
    assert out["bleed"] == 2
    assert out["hp_defender"] == 48
    state.turn_number = 3
    out = engine.resolve_turn(state, Action.WAIT, Action.WAIT)
    assert out["bleed"] == 2
    assert out["hp_defender"] == 46


def test_no_bleed_when_nothing_dropped():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=2)
    out = engine.resolve_turn(state, Action.WAIT, Action.WAIT)
    assert out["bleed"] == 0
    assert out["hp_defender"] == 50


def test_bleed_stops_after_check():
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=2)
    engine.resolve_turn(state, Action.DROP, Action.WAIT)   # 50-2=48
    out = engine.resolve_turn(state, Action.WAIT, Action.CHECK)
    assert out["result"] == "HIT"
    assert out["hp_defender"] == 48 + 5


def test_never_penalty_applies_on_active_check_at_last_turn():
    # 走满被查空（无论守方主动还是强制），失职罚都要落
    engine = make_engine()
    state = RoundState(round_number=1, turn_number=10)
    out = engine.resolve_turn(state, Action.WAIT, Action.CHECK)
    assert out["result"] == "MISS"
    assert out["hp_attacker"] == 50 - 9 - 15


def test_legacy_semantics_when_repair_params_zero():
    # 巡回保险：atk_chrono=0 / never_atk=0 时应完全复现修参前的行为
    engine = HandkerchiefEngine(EngineConfig(atk_chrono=0, never_atk=0))
    state = RoundState(round_number=1, turn_number=3)
    out = engine.resolve_turn(state, Action.DROP, Action.CHECK)
    assert out["hp_attacker"] == 40                  # 只有命中惩罚
    state = RoundState(round_number=1, turn_number=4)
    out = engine.resolve_turn(state, Action.WAIT, Action.CHECK)
    assert out["hp_attacker"] == 50                  # 查空对攻方零伤害
    state = RoundState(round_number=1, turn_number=10)
    out = engine.resolve_turn(state, Action.WAIT, Action.WAIT)
    assert out["result"] == "FORCED_MISS"
    assert out["hp_attacker"] == 50                  # 永不丢无失职罚

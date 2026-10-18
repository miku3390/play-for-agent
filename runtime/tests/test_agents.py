from handkerchief_engine import EngineConfig
from handkerchief_runtime import LLMAgent


class _StubClient:  # _system() 不需要真 client
    pass


def test_rules_reflect_engine_config():
    cfg = EngineConfig(max_turns_per_round=8, initial_hp=70,
                       dropped_bleed_per_turn=9, hit_defender_gain=6,
                       hit_attacker_loss=12, miss_penalty=11,
                       atk_chrono=2, never_atk=20)
    text = LLMAgent("A", "你是耐心玩家。", _StubClient(), "m",
                    max_rounds=7, engine_config=cfg)._system()
    assert "每局最多 7 轮" in text
    assert "每轮最多 8 回合" in text
    assert "初始 HP 各 70" in text
    assert "流血 -9 HP" in text
    assert "+6 HP" in text
    assert "-12 HP" in text
    assert "-(11+" in text
    assert "每回合多扣 2 HP" in text
    assert "-20 HP 失职罚" in text


def test_rules_default_config_matches_engine_defaults():
    text = LLMAgent("A", "", _StubClient(), "m")._system()
    assert "流血 -2 HP" in text          # EngineConfig.dropped_bleed_per_turn 默认 2
    assert "初始 HP 各 50" in text
    assert "-15 HP 失职罚" in text       # never_atk 默认 15
    assert "多扣 1 HP" in text           # atk_chrono 默认 1

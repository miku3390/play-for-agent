from handkerchief_runtime import CrossMatchMemory, MatchContext
from handkerchief_runtime.context import TurnRecord


def rec(rnd: int, turn: int) -> TurnRecord:
    return TurnRecord(round=rnd, turn=turn, my_action="WAIT", opponent_action="WAIT",
                      my_hp_before=50, my_hp_after=48, opponent_hp_before=50, opponent_hp_after=50,
                      result="CONTINUE")


def test_empty_context_renders_placeholder():
    assert "没有" in MatchContext().render()


def test_old_rounds_are_summarized_recent_rounds_detailed():
    ctx = MatchContext(recent_rounds=2)
    for rnd in range(1, 6):
        for turn in range(1, 4):
            ctx.add(rec(rnd, turn))
    text = ctx.render()
    assert "较早轮次摘要" in text
    assert "第3轮" in text.split("最近轮次明细")[0]   # 第 3 轮进了摘要区
    detail = text.split("最近轮次明细")[1]
    assert "R5T3" in detail and "R4T1" in detail
    assert "R3T1" not in detail                      # 第 3 轮不进明细区


def test_cross_match_memory_caps_and_renders():
    mem = CrossMatchMemory(max_entries=3)
    for i in range(5):
        mem.add_match_summary(f"match {i}")
    text = mem.render()
    assert "match 4" in text and "match 2" in text
    assert "match 1" not in text

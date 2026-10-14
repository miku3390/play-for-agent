import asyncio
import json

from handkerchief_runtime import EventBus, JsonlSink, MatchRunner, ScriptedAgent
from handkerchief_runtime.agents import early_dropper, late_checker, mid_checker, patient_never_drop


def make_agents():
    a = ScriptedAgent("A-early", early_dropper, mid_checker)
    b = ScriptedAgent("B-patient", patient_never_drop, late_checker)
    return a, b


def test_full_match_completes_within_limits():
    bus = EventBus()
    events = []
    bus.subscribe(events.append)
    a, b = make_agents()
    runner = MatchRunner(bus=bus, max_rounds=10)
    result = asyncio.run(runner.play(a, b))

    assert result["rounds"] <= 10
    assert result["turns"] <= 10 * 10
    assert all(hp >= 0 for hp in result["final_hp"].values())
    assert events[0].type == "MATCH_START"
    assert events[-1].type == "MATCH_END"

    turn_events = [e for e in events if e.type == "TURN_END"]
    assert turn_events, "至少要打出几个回合"
    # 角色每轮互换：第 1 轮攻方是 A，第 2 轮是 B
    r1 = [e for e in turn_events if e.payload["round"] == 1]
    assert r1[0].payload["attacker_action"] == "DROP"   # A 是早丢型
    if any(e.payload["round"] == 2 for e in turn_events):
        r2 = [e for e in turn_events if e.payload["round"] == 2]
        assert r2[0].payload["attacker_action"] == "WAIT"  # B 永不丢


def test_cross_match_memory_written_after_match():
    a, b = make_agents()
    runner = MatchRunner(bus=EventBus(), max_rounds=2)
    asyncio.run(runner.play(a, b))
    assert a.memory.summaries and b.memory.summaries
    assert "vs B-patient" in a.memory.summaries[-1]


def test_jsonl_sink_writes_valid_lines(tmp_path):
    bus = EventBus()
    log = tmp_path / "match.jsonl"
    bus.subscribe(JsonlSink(log))
    a, b = make_agents()
    asyncio.run(MatchRunner(bus=bus, max_rounds=3).play(a, b))
    lines = log.read_text(encoding="utf-8").strip().splitlines()
    assert lines
    for line in lines:
        rec = json.loads(line)
        assert rec["type"] and rec["match_id"]

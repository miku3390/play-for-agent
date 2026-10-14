import glob
import json

logs = sorted(glob.glob("logs/match-*.jsonl"))
events = [json.loads(line) for line in open(logs[-1], encoding="utf-8")]
lat = [e["payload"].get("latency_ms", 0) for e in events if e["type"] == "TURN_END"]
print(f"turns={len(lat)} avg={sum(lat) // max(len(lat), 1)}ms max={max(lat or [0])}ms")

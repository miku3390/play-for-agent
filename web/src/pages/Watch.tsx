import { useRef, useState } from "react";

interface GameEvent {
  type: string;
  match_id: string;
  payload: Record<string, any>;
  _seq?: number;
}

function deriveHp(evts: GameEvent[]): Record<string, number> {
  const hp: Record<string, number> = {};
  let attacker = "";
  let defender = "";
  for (const e of evts) {
    const p = e.payload;
    if (e.type === "MATCH_START") {
      hp[p.agent_a] = 50;
      hp[p.agent_b] = 50;
    } else if (e.type === "ROUND_START") {
      attacker = p.attacker;
      defender = p.defender;
      hp[attacker] = p.attacker_hp;
      hp[defender] = p.defender_hp;
    } else if (e.type === "TURN_END") {
      hp[attacker] = p.attacker_hp;
      hp[defender] = p.defender_hp;
    }
  }
  return hp;
}

function formatLine(e: GameEvent): string | null {
  const p = e.payload;
  switch (e.type) {
    case "MATCH_START":
      return `=== 对局开始 ${e.match_id} | ${p.agent_a} vs ${p.agent_b} ===`;
    case "ROUND_START":
      return `-- 第 ${p.round} 轮 | 攻方 ${p.attacker} 守方 ${p.defender} | HP ${p.attacker_hp}:${p.defender_hp}`;
    case "TURN_END":
      return `  回合 ${p.turn} | 攻 ${p.attacker_action} 守 ${p.defender_action} -> ${p.result} | HP ${p.attacker_hp}:${p.defender_hp}${p.bleed ? ` 流血-${p.bleed}` : ""}`;
    case "ROUND_END":
      return `  >> 轮结束: ${p.result}${p.reason === "hp_zero" ? "（血量归零）" : ""}`;
    case "MATCH_END":
      return `=== 对局结束 | 胜方 ${p.winner || "平局"} | ${p.finish_reason} | ${p.total_rounds}轮${p.total_turns}回合 ===`;
    case "RESULT":
      return `结果: ${JSON.stringify(p)}`;
    default:
      return null;
  }
}

function HpBar({ name, hp }: { name: string; hp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / 50) * 100));
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
        <span>{name}</span>
        <span>HP {hp}</span>
      </div>
      <div style={{ background: "#333", borderRadius: 4, height: 14, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: pct > 40 ? "#4caf50" : pct > 15 ? "#ff9800" : "#f44336",
            transition: "width .3s",
          }}
        />
      </div>
    </div>
  );
}

export default function Watch() {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [matchId, setMatchId] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const start = async (mock: boolean) => {
    wsRef.current?.close();
    const res = await fetch("/api/v1/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_a: { name: "A-忍耐型" },
        agent_b: { name: "B-激进型" },
        rounds: 10,
        mock,
      }),
    });
    const data = await res.json();
    const id: string = data.data.match_id;
    setMatchId(id);
    setEvents([]);
    setRunning(true);

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/matches/${id}`);
    wsRef.current = ws;
    ws.onmessage = (m) => {
      const ev: GameEvent = JSON.parse(m.data);
      setEvents((prev) => [...prev, ev]);
      if (ev.type === "RESULT") setRunning(false);
    };
    ws.onclose = () => setRunning(false);
    ws.onerror = () => setRunning(false);
  };

  const hp = deriveHp(events);
  const names = Object.keys(hp);
  const lines = events.map(formatLine).filter((l): l is string => l !== null);

  return (
    <div>
      <h1>观战</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => start(false)} disabled={running}>
          开始对局（LLM）
        </button>
        <button onClick={() => start(true)} disabled={running}>
          开始对局（离线 mock）
        </button>
        {matchId && <span style={{ alignSelf: "center", color: "#888" }}>match: {matchId}</span>}
        {running && <span style={{ alignSelf: "center" }}>进行中…</span>}
      </div>

      {names.length === 2 && (
        <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
          <HpBar name={names[0]} hp={hp[names[0]]} />
          <HpBar name={names[1]} hp={hp[names[1]]} />
        </div>
      )}

      <pre
        style={{
          background: "#111",
          color: "#ddd",
          padding: 12,
          borderRadius: 6,
          fontSize: 13,
          lineHeight: 1.6,
          maxHeight: "60vh",
          overflow: "auto",
        }}
      >
        {lines.length ? lines.join("\n") : "（点上面的按钮开始一局）"}
      </pre>
    </div>
  );
}

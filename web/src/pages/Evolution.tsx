import { useState } from "react";
import {
  STRATEGIES,
  Strategy,
  runTournament,
  runEvolution,
  TournamentResult,
  Generation,
  playMatch,
} from "../game/evolution";

type Tab = "tournament" | "evolution";

export default function Evolution() {
  const [tab, setTab] = useState<Tab>("tournament");

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>信任的进化 · Evolution of Trust</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        重复囚徒困境博弈实验。双方每回合选择「合作」或「背叛」。
        双方合作各得 2 分；一方背叛一方合作，背叛者得 3 合作者得 -1；双方背叛各得 0。
        <br />
        Axelrod 1984 年的锦标赛证明：最简单、最善良、最清晰的策略——「以牙还牙」（Tit for Tat）——赢得了所有对手。
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setTab("tournament")}
          style={{
            padding: "8px 16px",
            background: tab === "tournament" ? "#333" : "#eee",
            color: tab === "tournament" ? "#fff" : "#333",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          锦标赛模式
        </button>
        <button
          onClick={() => setTab("evolution")}
          style={{
            padding: "8px 16px",
            background: tab === "evolution" ? "#333" : "#eee",
            color: tab === "evolution" ? "#fff" : "#333",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          进化模式
        </button>
      </div>

      {tab === "tournament" ? <TournamentView /> : <EvolutionView />}
    </div>
  );
}

function TournamentView() {
  const [selected, setSelected] = useState<Set<string>>(new Set(STRATEGIES.map((s) => s.id)));
  const [rounds, setRounds] = useState(10);
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [running, setRunning] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const run = () => {
    setRunning(true);
    const strategies = STRATEGIES.filter((s) => selected.has(s.id));
    if (strategies.length < 2) {
      alert("至少选两种策略");
      setRunning(false);
      return;
    }
    setTimeout(() => {
      setResult(runTournament(strategies, rounds));
      setRunning(false);
    }, 50);
  };

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: "0 0 320px" }}>
        <h3>策略选择</h3>
        {STRATEGIES.map((s) => (
          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
            />
            <span style={{ width: 12, height: 12, background: s.color, borderRadius: 2, display: "inline-block" }} />
            <span>{s.label}</span>
            <span style={{ color: "#999", fontSize: 12, marginLeft: 4 }} title={s.description}>
              ⓘ
            </span>
          </label>
        ))}
        <div style={{ marginTop: 16 }}>
          <label>
            每对交手回合数：
            <input
              type="number"
              value={rounds}
              min={1}
              max={100}
              onChange={(e) => setRounds(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 60, marginLeft: 8 }}
            />
          </label>
        </div>
        <button
          onClick={run}
          disabled={running || selected.size < 2}
          style={{
            marginTop: 16,
            padding: "8px 16px",
            background: running ? "#ccc" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: running ? "not-allowed" : "pointer",
          }}
        >
          {running ? "运行中..." : "开始锦标赛"}
        </button>
      </div>

      <div style={{ flex: 1 }}>
        {result ? <TournamentResults result={result} /> : <p style={{ color: "#999" }}>选择策略后点击「开始锦标赛」</p>}
      </div>
    </div>
  );
}

function TournamentResults({ result }: { result: TournamentResult }) {
  const maxScore = Math.max(...result.ranking.map((r) => r.score));

  return (
    <div>
      <h3>得分排名</h3>
      <div style={{ marginBottom: 24 }}>
        {result.ranking.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 20, textAlign: "right" }}>{i + 1}.</span>
            <span style={{ width: 100, fontWeight: 500 }}>{r.label}</span>
            <div style={{ flex: 1, background: "#eee", height: 20, borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  width: `${(r.score / maxScore) * 100}%`,
                  height: "100%",
                  background: r.color,
                  transition: "width 0.3s",
                }}
              />
            </div>
            <span style={{ width: 60, textAlign: "right" }}>{r.score}</span>
          </div>
        ))}
      </div>

      <h3>对阵矩阵</h3>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
        行 = 策略 A，列 = 策略 B，单元格 = A 对 B 的得分
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: 6, border: "1px solid #ddd" }}></th>
              {result.ranking.map((r) => (
                <th key={r.id} style={{ padding: 6, border: "1px solid #ddd", writingMode: "vertical-rl", fontSize: 11 }}>
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.ranking.map((rA) => (
              <tr key={rA.id}>
                <td style={{ padding: 6, border: "1px solid #ddd", fontWeight: 500 }}>{rA.label}</td>
                {result.ranking.map((rB) => {
                  const match = result.matches.find((m) => m.strategyA === rA.id && m.strategyB === rB.id);
                  const score = match?.scoreA ?? 0;
                  return (
                    <td
                      key={rB.id}
                      style={{
                        padding: 6,
                        border: "1px solid #ddd",
                        textAlign: "center",
                        background: score > 0 ? `rgba(0, 180, 216, ${score / 30})` : score < 0 ? `rgba(230, 57, 70, ${Math.abs(score) / 30})` : "#f9f9f9",
                      }}
                    >
                      {score}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EvolutionView() {
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(STRATEGIES.map((s) => [s.id, 5])),
  );
  const [rounds, setRounds] = useState(10);
  const [generations, setGenerations] = useState(20);
  const [history, setHistory] = useState<Generation[] | null>(null);
  const [running, setRunning] = useState(false);

  const updateCount = (id: string, val: number) => {
    setCounts({ ...counts, [id]: Math.max(0, val) });
  };

  const run = () => {
    setRunning(true);
    const totalPop = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalPop < 2) {
      alert("总个体数至少为 2");
      setRunning(false);
      return;
    }
    setTimeout(() => {
      setHistory(runEvolution(counts, generations, rounds));
      setRunning(false);
    }, 50);
  };

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: "0 0 320px" }}>
        <h3>初始种群</h3>
        {STRATEGIES.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 12, height: 12, background: s.color, borderRadius: 2, display: "inline-block" }} />
            <span style={{ width: 90 }}>{s.label}</span>
            <input
              type="number"
              value={counts[s.id]}
              min={0}
              onChange={(e) => updateCount(s.id, parseInt(e.target.value) || 0)}
              style={{ width: 60 }}
            />
          </div>
        ))}
        <div style={{ marginTop: 16 }}>
          <label>
            每对交手回合数：
            <input
              type="number"
              value={rounds}
              min={1}
              max={100}
              onChange={(e) => setRounds(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 60, marginLeft: 8 }}
            />
          </label>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>
            进化代数：
            <input
              type="number"
              value={generations}
              min={1}
              max={100}
              onChange={(e) => setGenerations(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 60, marginLeft: 8 }}
            />
          </label>
        </div>
        <button
          onClick={run}
          disabled={running || Object.values(counts).reduce((a, b) => a + b, 0) < 2}
          style={{
            marginTop: 16,
            padding: "8px 16px",
            background: running ? "#ccc" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: running ? "not-allowed" : "pointer",
          }}
        >
          {running ? "运行中..." : "开始进化"}
        </button>
      </div>

      <div style={{ flex: 1 }}>
        {history ? <EvolutionResults history={history} /> : <p style={{ color: "#999" }}>设置种群后点击「开始进化」</p>}
      </div>
    </div>
  );
}

function EvolutionResults({ history }: { history: Generation[] }) {
  const strategyIds = Object.keys(history[0].counts);
  const maxGen = history.length - 1;
  const maxPop = Math.max(...history.map((g) => Object.values(g.counts).reduce((a, b) => a + b, 0)));

  const width = 600;
  const height = 300;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const xScale = (gen: number) => padLeft + (gen / maxGen) * chartW;
  const yScale = (pop: number) => padTop + chartH - (pop / maxPop) * chartH;

  const areas: JSX.Element[] = [];
  for (let i = 0; i < strategyIds.length; i++) {
    const id = strategyIds[i];
    const strategy = STRATEGIES.find((s) => s.id === id)!;
    let points = "";
    let prevY = yScale(0);

    for (let g = 0; g < history.length; g++) {
      const cumBefore = strategyIds.slice(0, i).reduce((sum, sid) => sum + (history[g].counts[sid] ?? 0), 0);
      const cumAfter = cumBefore + (history[g].counts[id] ?? 0);
      const x = xScale(g);
      const yTop = yScale(cumAfter);
      const yBot = yScale(cumBefore);
      points += `${x},${yTop} `;
    }

    for (let g = history.length - 1; g >= 0; g--) {
      const cumBefore = strategyIds.slice(0, i).reduce((sum, sid) => sum + (history[g].counts[sid] ?? 0), 0);
      const x = xScale(g);
      const yBot = yScale(cumBefore);
      points += `${x},${yBot} `;
    }

    areas.push(<polygon key={id} points={points.trim()} fill={strategy.color} opacity={0.7} />);
  }

  const finalCounts = history[history.length - 1].counts;
  const finalTotal = Object.values(finalCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h3>种群进化</h3>
      <svg width={width} height={height} style={{ background: "#f9f9f9", border: "1px solid #ddd", borderRadius: 4 }}>
        {areas}
        <line x1={padLeft} y1={padTop + chartH} x2={padLeft + chartW} y2={padTop + chartH} stroke="#333" />
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + chartH} stroke="#333" />
        <text x={padLeft + chartW / 2} y={height - 8} textAnchor="middle" fontSize={12} fill="#666">
          代数
        </text>
        <text x={12} y={padTop + chartH / 2} textAnchor="middle" fontSize={12} fill="#666" transform={`rotate(-90, 12, ${padTop + chartH / 2})`}>
          种群数
        </text>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={padLeft - 4} y1={yScale(t * maxPop)} x2={padLeft} y2={yScale(t * maxPop)} stroke="#333" />
            <text x={padLeft - 8} y={yScale(t * maxPop) + 4} textAnchor="end" fontSize={10} fill="#666">
              {Math.round(t * maxPop)}
            </text>
          </g>
        ))}
      </svg>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
        {STRATEGIES.map((s) => {
          const count = finalCounts[s.id] ?? 0;
          const pct = finalTotal > 0 ? ((count / finalTotal) * 100).toFixed(1) : "0.0";
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, background: s.color, borderRadius: 2, display: "inline-block" }} />
              <span>{s.label}：</span>
              <span style={{ fontWeight: 500 }}>{count}</span>
              <span style={{ color: "#999", fontSize: 12 }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

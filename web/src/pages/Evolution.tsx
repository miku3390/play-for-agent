import { useState } from "react";
import { STRATEGIES, Strategy, runTournament, runEvolution, TournamentResult, Generation } from "../game/evolution";

type Tab = "tournament" | "evolution";

export default function Evolution() {
  const [tab, setTab] = useState<Tab>("tournament");
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>信任的进化 · Evolution of Trust</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        重复囚徒困境博弈实验。双方每回合选择「合作」或「背叛」。
        同时合作各得 2 分；一方背叛，背叛者 +3、合作者 -1；同时背叛各 0。
        <br />
        Axelrod 1984 年锦标赛证明：最善良也最简单的「以牙还牙」，击败了所有对手。
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

function StrategyModal({ strategy, onClose }: { strategy: Strategy | null; onClose: () => void }) {
  if (!strategy) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div
        style={{
          position: "relative",
          width: 500,
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 8,
          padding: 24,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 8, right: 12, background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#999" }}
        >
          ×
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ width: 16, height: 16, background: strategy.color, borderRadius: 3, flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: 20 }}>{strategy.label}</h2>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#999", fontSize: 13 }}>简述</div>
          <div style={{ fontSize: 14 }}>{strategy.description}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#999", fontSize: 13 }}>原理</div>
          <div style={{ lineHeight: 1.6, color: "#444", fontSize: 13 }}>{strategy.explanation}</div>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#999", fontSize: 13 }}>决策逻辑</div>
          <pre
            style={{
              background: "#1e1e1e",
              color: "#d4d4d4",
              padding: 12,
              borderRadius: 4,
              fontSize: 12,
              lineHeight: 1.5,
              overflow: "auto",
              margin: 0,
            }}
          >
            {strategy.code}
          </pre>
        </div>
      </div>
    </div>
  );
}

function NameLink({ id, onOpen, bold }: { id: string; onOpen: (s: Strategy) => void; bold?: boolean }) {
  const s = STRATEGIES.find((x) => x.id === id);
  if (!s) return <span>{id}</span>;
  return (
    <span
      onClick={() => onOpen(s)}
      title="点击查看详情"
      style={{
        fontWeight: bold ? 600 : 400,
        cursor: "pointer",
        textDecoration: "underline dotted",
        color: "#555",
      }}
    >
      {s.label}
    </span>
  );
}

function TournamentView() {
  const [selected, setSelected] = useState<Set<string>>(new Set(STRATEGIES.map((s) => s.id)));
  const [rounds, setRounds] = useState(10);
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [detail, setDetail] = useState<Strategy | null>(null);
  const [running, setRunning] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const run = () => {
    const active = STRATEGIES.filter((s) => selected.has(s.id));
    if (active.length < 2) return;
    setRunning(true);
    setTimeout(() => {
      setResult(runTournament(active, rounds));
      setRunning(false);
    }, 50);
  };

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <aside style={{ flex: "0 0 300px" }}>
        <h3>策略选择（点击名称看详情）</h3>
        {STRATEGIES.map((s) => (
          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
            <span style={{ width: 12, height: 12, background: s.color, borderRadius: 2, flexShrink: 0 }} />
            <NameLink id={s.id} onOpen={setDetail} />
            <span style={{ color: "#bbb", fontSize: 12, marginLeft: 4 }}>{s.description}</span>
          </label>
        ))}
        <div style={{ marginTop: 16 }}>
          <label>
            每对交手回合数：
            <input
              type="number"
              min={1}
              max={100}
              value={rounds}
              onChange={(e) => setRounds(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 60, marginLeft: 8 }}
            />
          </label>
        </div>
        <button
          onClick={run}
          disabled={running || selected.size < 2}
          style={{ marginTop: 16, padding: "8px 16px", background: running ? "#ccc" : "#333", color: "#fff", border: "none", borderRadius: 4, cursor: running ? "not-allowed" : "pointer" }}
        >
          开始锦标赛
        </button>
      </aside>
      <main style={{ flex: 1, minWidth: 400 }}>
        {result ? <Results result={result} onOpen={setDetail} /> : <p style={{ color: "#999" }}>选择策略后点击「开始锦标赛」</p>}
      </main>
      <StrategyModal strategy={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function Results({ result, onOpen }: { result: TournamentResult; onOpen: (s: Strategy) => void }) {
  const maxScore = Math.max(...result.ranking.map((r) => r.score), 1);
  return (
    <div>
      <h3>得分排名</h3>
      {result.ranking.map((r, i) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 20, textAlign: "right" }}>{i + 1}.</span>
          <span style={{ width: 110 }}>
            <NameLink id={r.id} onOpen={onOpen} bold />
          </span>
          <div style={{ flex: 1, background: "#eee", height: 20, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: (r.score / maxScore) * 100 + "%", height: "100%", background: r.color, transition: "width 0.3s" }} />
          </div>
          <span style={{ width: 50, textAlign: "right" }}>{r.score}</span>
        </div>
      ))}
      <h3 style={{ marginTop: 24 }}>对阵矩阵</h3>
      <p style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>行 = 策略 A，列 = 策略 B，数值 = A 对 B 的得分</p>
      <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ padding: 6, border: "1px solid #ddd" }} />
            {result.ranking.map((r) => (
              <th key={r.id} style={{ padding: 6, border: "1px solid #ddd", writingMode: "vertical-rl", fontSize: 11 }}>
                <NameLink id={r.id} onOpen={onOpen} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.ranking.map((rA) => (
            <tr key={rA.id}>
              <td style={{ padding: 6, border: "1px solid #ddd", fontWeight: 500 }}>
                <NameLink id={rA.id} onOpen={onOpen} bold />
              </td>
              {result.ranking.map((rB) => {
                const m = result.matches.find((x) => x.strategyA === rA.id && x.strategyB === rB.id);
                const sc = m ? m.scoreA : 0;
                const bg = sc > 0 ? "rgba(0,180,216," + sc / 30 + ")" : sc < 0 ? "rgba(230,57,70," + Math.abs(sc) / 30 + ")" : "#fafafa";
                return (
                  <td key={rB.id} style={{ padding: 6, border: "1px solid #ddd", textAlign: "center", background: bg }}>
                    {sc}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvolutionView() {
  const [counts, setCounts] = useState<Record<string, number>>(Object.fromEntries(STRATEGIES.map((s) => [s.id, 5])));
  const [rounds, setRounds] = useState(10);
  const [generations, setGenerations] = useState(20);
  const [history, setHistory] = useState<Generation[] | null>(null);
  const [detail, setDetail] = useState<Strategy | null>(null);
  const [running, setRunning] = useState(false);

  const updateCount = (id: string, v: number) => setCounts((c) => ({ ...c, [id]: Math.max(0, v) }));

  const run = () => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total < 2) return;
    setRunning(true);
    setTimeout(() => {
      setHistory(runEvolution(counts, generations, rounds));
      setRunning(false);
    }, 50);
  };

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <aside style={{ flex: "0 0 300px" }}>
        <h3>初始种群（点击名称看详情）</h3>
        {STRATEGIES.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 12, height: 12, background: s.color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ width: 90 }}>
              <NameLink id={s.id} onOpen={setDetail} />
            </span>
            <input
              type="number"
              min={0}
              value={counts[s.id]}
              onChange={(e) => updateCount(s.id, parseInt(e.target.value) || 0)}
              style={{ width: 60 }}
            />
          </div>
        ))}
        <div style={{ marginTop: 16 }}>
          <label>
            每对交手回合数：
            <input type="number" min={1} max={100} value={rounds} onChange={(e) => setRounds(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: 60, marginLeft: 8 }} />
          </label>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>
            进化代数：
            <input type="number" min={1} max={100} value={generations} onChange={(e) => setGenerations(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: 60, marginLeft: 8 }} />
          </label>
        </div>
        <button
          onClick={run}
          disabled={running || Object.values(counts).reduce((a, b) => a + b, 0) < 2}
          style={{ marginTop: 16, padding: "8px 16px", background: running ? "#ccc" : "#333", color: "#fff", border: "none", borderRadius: 4, cursor: running ? "not-allowed" : "pointer" }}
        >
          开始进化
        </button>
      </aside>
      <main style={{ flex: 1, minWidth: 400 }}>
        {history ? <EvoChart history={history} onOpen={setDetail} /> : <p style={{ color: "#999" }}>设置种群后点击「开始进化」</p>}
      </main>
      <StrategyModal strategy={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function EvoChart({ history, onOpen }: { history: Generation[]; onOpen: (s: Strategy) => void }) {
  const ids = Object.keys(history[0].counts);
  const maxGen = history.length - 1;
  const maxPop = Math.max(...history.map((g) => Object.values(g.counts).reduce((a, b) => a + b, 0)), 1);
  const W = 600, H = 300, pl = 45, pr = 20, pt = 20, pb = 40;
  const cw = W - pl - pr, ch = H - pt - pb;

  const polys: JSX.Element[] = [];
  for (const sid of ids) {
    const strat = STRATEGIES.find((s) => s.id === sid);
    if (!strat) continue;
    const idx = ids.indexOf(sid);
    let pts = "";
    for (let g = 0; g < history.length; g++) {
      const below = ids.slice(0, idx).reduce((sum, s) => sum + (history[g].counts[s] || 0), 0);
      const val = below + (history[g].counts[sid] || 0);
      pts += Math.round(pl + (g / maxGen) * cw) + "," + Math.round(pt + ch - (val / maxPop) * ch) + " ";
    }
    for (let g = history.length - 1; g >= 0; g--) {
      const below = ids.slice(0, idx).reduce((sum, s) => sum + (history[g].counts[s] || 0), 0);
      pts += Math.round(pl + (g / maxGen) * cw) + "," + Math.round(pt + ch - (below / maxPop) * ch) + " ";
    }
    polys.push(<polygon key={sid} points={pts.trim()} fill={strat.color} opacity={0.7} />);
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = Math.round(pt + ch - t * ch);
    return (
      <g key={t}>
        <line x1={pl} y1={y} x2={pl + 4} y2={y} stroke="#999" />
        <text x={pl - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#888">
          {Math.round(t * maxPop)}
        </text>
      </g>
    );
  });

  const finalCounts = history[history.length - 1].counts;
  const finalTotal = Object.values(finalCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h3>种群动态</h3>
      <svg width={W} height={H} style={{ background: "#fafafa", border: "1px solid #ddd", borderRadius: 4, display: "block", marginBottom: 16 }}>
        {polys}
        <line x1={pl} y1={pt + ch} x2={pl + cw} y2={pt + ch} stroke="#333" />
        <line x1={pl} y1={pt} x2={pl} y2={pt + ch} stroke="#333" />
        {yTicks}
        <text x={pl + cw / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="#666">
          代数
        </text>
        <text x={12} y={pt + ch / 2} textAnchor="middle" fontSize={12} fill="#666" transform={"rotate(-90, 12, " + (pt + ch / 2) + ")"}>
          种群数
        </text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {STRATEGIES.map((s) => {
          const c = finalCounts[s.id] || 0;
          const pct = finalTotal > 0 ? ((c / finalTotal) * 100).toFixed(1) : "0.0";
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, background: s.color, borderRadius: 2 }} />
              <NameLink id={s.id} onOpen={onOpen} bold />
              <span>{c}</span>
              <span style={{ color: "#999", fontSize: 12 }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

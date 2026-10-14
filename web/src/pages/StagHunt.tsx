import { useState } from "react";
import { STAG_STRATEGIES, StagStrategy, runTournament, runEvolution, StagTournament, StagGeneration } from "../game/staghunt";
import StrategyModal, { LinkName, TabButton } from "../components/StrategyModal";

type Tab = "tournament" | "evolution";

export default function StagHunt() {
  const [tab, setTab] = useState<Tab>("tournament");
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>猎鹿博弈 · Stag Hunt</h1>
      <p style={{ color: "#666", marginBottom: 24, lineHeight: 1.7 }}>
        卢梭 1755 年写下的寓言：两个猎人，一起猎鹿能分到大肉；但只要有一人开溜去抓兔子，另一个就两手空空。
        <br />
        收益：双方猎鹿各 <b>+3</b>；双方抓兔各 <b>+1</b>；一方猎鹿一方抓兔，猎鹿者 <b>0</b>、抓兔者 <b>+2</b>。
        <br />
        它有两个纳什均衡——「都猎鹿」（收益最高）与「都抓兔」（风险最低）。
        问题从来不是哪个更好，而是：<b>你敢不敢赌对方也选猎鹿。</b>
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <TabButton active={tab === "tournament"} onClick={() => setTab("tournament")}>锦标赛模式</TabButton>
        <TabButton active={tab === "evolution"} onClick={() => setTab("evolution")}>进化模式</TabButton>
      </div>
      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "16px 0" }} />
      {tab === "tournament" ? <TournamentView /> : <EvolutionView />}
    </div>
  );
}

function TournamentView() {
  const [selected, setSelected] = useState<Set<string>>(new Set(STAG_STRATEGIES.map((s) => s.id)));
  const [rounds, setRounds] = useState(10);
  const [result, setResult] = useState<StagTournament | null>(null);
  const [detail, setDetail] = useState<StagStrategy | null>(null);
  const [running, setRunning] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const run = () => {
    const active = STAG_STRATEGIES.filter((s) => selected.has(s.id));
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
        <h3>猎人的性格（点击名称看详情）</h3>
        {STAG_STRATEGIES.map((s) => (
          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
            <span style={{ width: 12, height: 12, background: s.color, borderRadius: 2, flexShrink: 0 }} />
            <LinkName label={s.label} onOpen={() => setDetail(s)} />
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
          开始狩猎
        </button>
      </aside>
      <main style={{ flex: 1, minWidth: 400 }}>
        {result ? <Results result={result} onOpen={setDetail} /> : <p style={{ color: "#999" }}>选择猎人后点击「开始狩猎」</p>}
      </main>
      <StrategyModal strategy={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function Results({ result, onOpen }: { result: StagTournament; onOpen: (s: StagStrategy) => void }) {
  const maxScore = Math.max(...result.ranking.map((r) => r.score), 1);
  const pick = (id: string) => {
    const s = STAG_STRATEGIES.find((x) => x.id === id);
    if (s) onOpen(s);
  };
  return (
    <div>
      <h3>收成排名</h3>
      {result.ranking.map((r, i) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 20, textAlign: "right" }}>{i + 1}.</span>
          <span style={{ width: 110 }}>
            <LinkName label={r.label} onOpen={() => pick(r.id)} bold />
          </span>
          <div style={{ flex: 1, background: "#eee", height: 20, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: (r.score / maxScore) * 100 + "%", height: "100%", background: r.color, transition: "width 0.3s" }} />
          </div>
          <span style={{ width: 50, textAlign: "right" }}>{r.score}</span>
        </div>
      ))}
      <h3 style={{ marginTop: 24 }}>对阵矩阵</h3>
      <p style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>行 = 猎人 A，列 = 猎人 B，数值 = A 的收成</p>
      <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ padding: 6, border: "1px solid #ddd" }} />
            {result.ranking.map((r) => (
              <th key={r.id} style={{ padding: 6, border: "1px solid #ddd", writingMode: "vertical-rl", fontSize: 11 }}>
                <LinkName label={r.label} onOpen={() => pick(r.id)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.ranking.map((rA) => (
            <tr key={rA.id}>
              <td style={{ padding: 6, border: "1px solid #ddd", fontWeight: 500 }}>
                <LinkName label={rA.label} onOpen={() => pick(rA.id)} bold />
              </td>
              {result.ranking.map((rB) => {
                const m = result.matches.find((x) => x.strategyA === rA.id && x.strategyB === rB.id);
                const sc = m ? m.scoreA : 0;
                const bg = sc > 20 ? "rgba(45,106,79,0.35)" : sc > 10 ? "rgba(45,106,79,0.18)" : sc <= 5 ? "rgba(181,131,141,0.3)" : "#fafafa";
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
  const [counts, setCounts] = useState<Record<string, number>>(Object.fromEntries(STAG_STRATEGIES.map((s) => [s.id, 5])));
  const [rounds, setRounds] = useState(10);
  const [generations, setGenerations] = useState(20);
  const [history, setHistory] = useState<StagGeneration[] | null>(null);
  const [detail, setDetail] = useState<StagStrategy | null>(null);
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
        <h3>初始猎人群（点击名称看详情）</h3>
        <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
          提示：试试把某个猎人设成 30 再演化——猎鹿博弈的结局由<b>初始信任水平</b>决定（路径依赖）。
        </p>
        {STAG_STRATEGIES.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 12, height: 12, background: s.color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ width: 90 }}>
              <LinkName label={s.label} onOpen={() => setDetail(s)} />
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
            演化世代：
            <input type="number" min={1} max={100} value={generations} onChange={(e) => setGenerations(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: 60, marginLeft: 8 }} />
          </label>
        </div>
        <button
          onClick={run}
          disabled={running || Object.values(counts).reduce((a, b) => a + b, 0) < 2}
          style={{ marginTop: 16, padding: "8px 16px", background: running ? "#ccc" : "#333", color: "#fff", border: "none", borderRadius: 4, cursor: running ? "not-allowed" : "pointer" }}
        >
          开始演化
        </button>
      </aside>
      <main style={{ flex: 1, minWidth: 400 }}>
        {history ? <EvoChart history={history} onOpen={setDetail} /> : <p style={{ color: "#999" }}>设置猎人群后点击「开始演化」</p>}
      </main>
      <StrategyModal strategy={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function EvoChart({ history, onOpen }: { history: StagGeneration[]; onOpen: (s: StagStrategy) => void }) {
  const ids = Object.keys(history[0].counts);
  const maxGen = history.length - 1;
  const maxPop = Math.max(...history.map((g) => Object.values(g.counts).reduce((a, b) => a + b, 0)), 1);
  const W = 600, H = 300, pl = 45, pr = 20, pt = 20, pb = 40;
  const cw = W - pl - pr, ch = H - pt - pb;

  const polys = [];
  for (const sid of ids) {
    const strat = STAG_STRATEGIES.find((s) => s.id === sid);
    if (!strat) continue;
    const idx = ids.indexOf(sid);
    let pts = "";
    for (let gen = 0; gen < history.length; gen++) {
      const below = ids.slice(0, idx).reduce((sum, s) => sum + (history[gen].counts[s] || 0), 0);
      const val = below + (history[gen].counts[sid] || 0);
      pts += Math.round(pl + (gen / maxGen) * cw) + "," + Math.round(pt + ch - (val / maxPop) * ch) + " ";
    }
    for (let gen = history.length - 1; gen >= 0; gen--) {
      const below = ids.slice(0, idx).reduce((sum, s) => sum + (history[gen].counts[s] || 0), 0);
      pts += Math.round(pl + (gen / maxGen) * cw) + "," + Math.round(pt + ch - (below / maxPop) * ch) + " ";
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
      <h3>猎人群演化</h3>
      <svg width={W} height={H} style={{ background: "#fafafa", border: "1px solid #ddd", borderRadius: 4, display: "block", marginBottom: 16 }}>
        {polys}
        <line x1={pl} y1={pt + ch} x2={pl + cw} y2={pt + ch} stroke="#333" />
        <line x1={pl} y1={pt} x2={pl} y2={pt + ch} stroke="#333" />
        {yTicks}
        <text x={pl + cw / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="#666">世代</text>
        <text x={12} y={pt + ch / 2} textAnchor="middle" fontSize={12} fill="#666" transform={"rotate(-90, 12, " + (pt + ch / 2) + ")"}>个体数</text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {STAG_STRATEGIES.map((s) => {
          const c = finalCounts[s.id] || 0;
          const pct = finalTotal > 0 ? ((c / finalTotal) * 100).toFixed(1) : "0.0";
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, background: s.color, borderRadius: 2 }} />
              <LinkName label={s.label} onOpen={() => onOpen(s)} bold />
              <span>{c}</span>
              <span style={{ color: "#999", fontSize: 12 }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from "react";
import { GUESS_AGENTS, GuessAgent, runGuessPool, GuessOutcome } from "../game/guess23";
import StrategyModal, { LinkName } from "../components/StrategyModal";

export default function Guess23() {
  const [selected, setSelected] = useState<Set<string>>(new Set(GUESS_AGENTS.map((a) => a.id)));
  const [rounds, setRounds] = useState(10);
  const [outcome, setOutcome] = useState<GuessOutcome | null>(null);
  const [detail, setDetail] = useState<GuessAgent | null>(null);
  const [running, setRunning] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const run = () => {
    const active = GUESS_AGENTS.filter((a) => selected.has(a.id));
    if (active.length < 2) return;
    setRunning(true);
    setTimeout(() => {
      setOutcome(runGuessPool(active, rounds));
      setRunning(false);
    }, 50);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>猜 2/3 平均数 · Guess 2/3 of the Average</h1>
      <p style={{ color: "#666", marginBottom: 24, lineHeight: 1.7 }}>
        凯恩斯「选美竞赛」的数学化版本。每轮所有人从 0 到 100 各猜一个数，
        最接近<b>全体平均值 × 2/3</b> 的人得分最高。
        <br />
        如果所有人都是无限理性的，答案只能收敛到 <b>0</b>——因为「我认为他认为我认为……」可以无限递推下去。
        但现实中没人猜 0，因为人群里总混着天真的人和搅局的人。
        <br />
        这个实验量的不是算术，是<b>你以为别人有多聪明</b>。
      </p>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <aside style={{ flex: "0 0 300px" }}>
          <h3>参与推理的层级（点击名称看详情）</h3>
          {GUESS_AGENTS.map((a) => (
            <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
              <span style={{ width: 12, height: 12, background: a.color, borderRadius: 2, flexShrink: 0 }} />
              <LinkName label={a.label} onOpen={() => setDetail(a)} />
              <span style={{ color: "#bbb", fontSize: 12, marginLeft: 4 }}>{a.description}</span>
            </label>
          ))}
          <div style={{ marginTop: 16 }}>
            <label>
              竞猜轮数：
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
            开始竞猜
          </button>
        </aside>
        <main style={{ flex: 1, minWidth: 420 }}>
          {outcome ? <Outcome outcome={outcome} onOpen={setDetail} /> : <p style={{ color: "#999" }}>选择层级后点击「开始竞猜」</p>}
        </main>
      </div>
      <StrategyModal strategy={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function Outcome({ outcome, onOpen }: { outcome: GuessOutcome; onOpen: (a: GuessAgent) => void }) {
  const rs = outcome.rounds;
  const maxScore = Math.max(...outcome.ranking.map((r) => r.score), 1);
  const ids = GUESS_AGENTS.map((a) => a.id);
  const W = 620, H = 280, pl = 45, pr = 20, pt = 20, pb = 40;
  const cw = W - pl - pr, ch = H - pt - pb;
  const yOf = (v: number) => pt + ch - (v / 100) * ch;
  const xOf = (i: number) => pl + (rs.length <= 1 ? cw / 2 : (i / (rs.length - 1)) * cw);

  let avgPts = "";
  let tgtPts = "";
  rs.forEach((r, i) => {
    avgPts += Math.round(xOf(i)) + "," + Math.round(yOf(r.average)) + " ";
    tgtPts += Math.round(xOf(i)) + "," + Math.round(yOf(r.target)) + " ";
  });

  const yTicks = [0, 25, 50, 75, 100].map((v) => (
    <g key={v}>
      <line x1={pl} y1={yOf(v)} x2={pl + cw} y2={yOf(v)} stroke="#eee" />
      <text x={pl - 8} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill="#888">{v}</text>
    </g>
  ));

  return (
    <div>
      <h3>收敛曲线</h3>
      <p style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>蓝线 = 全体平均猜数 · 红线 = 2/3 目标值（所有人的靶心）</p>
      <svg width={W} height={H} style={{ background: "#fafafa", border: "1px solid #ddd", borderRadius: 4, display: "block", marginBottom: 20 }}>
        {yTicks}
        <polyline points={avgPts.trim()} fill="none" stroke="#00B4D8" strokeWidth={2} />
        <polyline points={tgtPts.trim()} fill="none" stroke="#E63946" strokeWidth={2} />
        <line x1={pl} y1={pt + ch} x2={pl + cw} y2={pt + ch} stroke="#333" />
        <line x1={pl} y1={pt} x2={pl} y2={pt + ch} stroke="#333" />
        <text x={pl + cw / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="#666">轮次</text>
      </svg>

      <h3>逐轮明细</h3>
      <div style={{ overflowX: "auto", marginBottom: 24 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, whiteSpace: "nowrap" }}>
          <thead>
            <tr>
              <th style={{ padding: 5, border: "1px solid #ddd" }}>轮</th>
              <th style={{ padding: 5, border: "1px solid #ddd" }}>平均</th>
              <th style={{ padding: 5, border: "1px solid #ddd" }}>目标 2/3</th>
              {GUESS_AGENTS.filter((a) => ids.indexOf(a.id) >= 0 && rs[0].guesses[a.id] !== undefined).map((a) => (
                <th key={a.id} style={{ padding: 5, border: "1px solid #ddd" }}>
                  <LinkName label={a.label} onOpen={() => onOpen(a)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rs.map((r) => {
              const cols = GUESS_AGENTS.filter((a) => r.guesses[a.id] !== undefined);
              const errs = cols.map((a) => Math.abs(r.guesses[a.id] - r.target));
              const best = Math.min(...errs);
              return (
                <tr key={r.round}>
                  <td style={{ padding: 5, border: "1px solid #ddd", textAlign: "center" }}>{r.round}</td>
                  <td style={{ padding: 5, border: "1px solid #ddd", textAlign: "center", color: "#00B4D8" }}>{r.average.toFixed(1)}</td>
                  <td style={{ padding: 5, border: "1px solid #ddd", textAlign: "center", color: "#E63946", fontWeight: 600 }}>{r.target.toFixed(1)}</td>
                  {cols.map((a, i) => (
                    <td
                      key={a.id}
                      style={{
                        padding: 5,
                        border: "1px solid #ddd",
                        textAlign: "center",
                        background: errs[i] === best ? "rgba(255,209,102,0.55)" : "transparent",
                        fontWeight: errs[i] === best ? 700 : 400,
                      }}
                    >
                      {r.guesses[a.id]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>累计得分排名</h3>
      <p style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>每轮得分 = 100 − |猜数 − 目标值|，越接近靶心越高</p>
      {outcome.ranking.map((r, i) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 20, textAlign: "right" }}>{i + 1}.</span>
          <span style={{ width: 110 }}>
            <LinkName label={r.label} onOpen={() => { const a = GUESS_AGENTS.find((x) => x.id === r.id); if (a) onOpen(a); }} bold />
          </span>
          <div style={{ flex: 1, background: "#eee", height: 20, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: (r.score / maxScore) * 100 + "%", height: "100%", background: r.color, transition: "width 0.3s" }} />
          </div>
          <span style={{ width: 60, textAlign: "right" }}>{r.score}</span>
        </div>
      ))}
    </div>
  );
}

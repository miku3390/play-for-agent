// 重复囚徒困境引擎 · 复刻 Nicky Case「信任的进化」
// 收益矩阵（Nicky Case 版本）：
//   双方合作：各 +2
//   一方合作一方背叛：合作者 -1，背叛者 +3
//   双方背叛：各 +0

export type Move = "cooperate" | "defect";
export type History = Move[];

export interface Strategy {
  id: string;
  label: string;
  color: string;
  description: string;
  decide: (myHistory: History, oppHistory: History) => Move;
}

export const PAYOFFS = { CC: 2, CD: -1, DC: 3, DD: 0 } as const;

export const STRATEGIES: Strategy[] = [
  {
    id: "always_cooperate",
    label: "合作宝宝",
    color: "#00B4D8",
    description: "永远合作，无论对方做什么。",
    decide: () => "cooperate",
  },
  {
    id: "always_defect",
    label: "欺骗",
    color: "#E63946",
    description: "永远背叛，绝不合作。",
    decide: () => "defect",
  },
  {
    id: "tit_for_tat",
    label: "以牙还牙",
    color: "#FFD166",
    description: "第一回合合作，之后模仿对手上一回合的动作。Axelrod 锦标赛冠军。",
    decide: (_my, opp) => (opp.length > 0 ? opp[opp.length - 1] : "cooperate"),
  },
  {
    id: "grudger",
    label: "黑帮老大",
    color: "#6A4C93",
    description: "一直合作，直到被骗一次——然后永远背叛。",
    decide: (_my, opp) => (opp.includes("defect") ? "defect" : "cooperate"),
  },
  {
    id: "detective",
    label: "福尔摩斯",
    color: "#2A9D8F",
    description: "前四回合固定出 C/D/C/C 试探；若对手骗过就复读机报复，否则永远背叛。",
    decide: (my, opp) => {
      const openers: Move[] = ["cooperate", "defect", "cooperate", "cooperate"];
      if (my.length < 4) return openers[my.length];
      return opp.slice(0, 4).includes("defect")
        ? (opp[opp.length - 1] ?? "cooperate")
        : "defect";
    },
  },
  {
    id: "pavlov",
    label: "巴甫洛夫",
    color: "#F77F00",
    description: "第一回合合作；上一轮双方一致则重复，不一致则反转。又名 Win-Stay Lose-Shift。",
    decide: (my, opp) => {
      if (my.length === 0) return "cooperate";
      const lastMy = my[my.length - 1];
      const lastOpp = opp[opp.length - 1];
      return lastMy === lastOpp ? lastMy : (lastMy === "cooperate" ? "defect" : "cooperate");
    },
  },
  {
    id: "tit_for_two_tats",
    label: "宽容复读机",
    color: "#A8DADC",
    description: "只有对手连续两回合背叛才报复，否则继续合作。比复读机更宽容。",
    decide: (_my, opp) => {
      if (opp.length < 2) return "cooperate";
      return opp[opp.length - 1] === "defect" && opp[opp.length - 2] === "defect"
        ? "defect" : "cooperate";
    },
  },
  {
    id: "random",
    label: "随机",
    color: "#8D99AE",
    description: "抛硬币：50% 合作，50% 背叛。",
    decide: () => (Math.random() < 0.5 ? "cooperate" : "defect"),
  },
];

export interface MatchResult {
  strategyA: string;
  strategyB: string;
  scoreA: number;
  scoreB: number;
  rounds: { a: Move; b: Move }[];
}

export function playMatch(sA: Strategy, sB: Strategy, rounds: number): MatchResult {
  const hA: History = [];
  const hB: History = [];
  const log: { a: Move; b: Move }[] = [];
  let scoreA = 0;
  let scoreB = 0;
  for (let i = 0; i < rounds; i++) {
    const a = sA.decide(hA, hB);
    const b = sB.decide(hB, hA);
    hA.push(a);
    hB.push(b);
    log.push({ a, b });
    if (a === "cooperate" && b === "cooperate") {
      scoreA += PAYOFFS.CC;
      scoreB += PAYOFFS.CC;
    } else if (a === "cooperate") {
      scoreA += PAYOFFS.CD;
      scoreB += PAYOFFS.DC;
    } else if (b === "cooperate") {
      scoreA += PAYOFFS.DC;
      scoreB += PAYOFFS.CD;
    } else {
      scoreA += PAYOFFS.DD;
      scoreB += PAYOFFS.DD;
    }
  }
  return { strategyA: sA.id, strategyB: sB.id, scoreA, scoreB, rounds: log };
}

export interface TournamentResult {
  matches: MatchResult[];
  scores: Map<string, number>;
  ranking: { id: string; label: string; score: number; color: string }[];
}

export function runTournament(
  strategies: Strategy[],
  roundsPerPair: number,
): TournamentResult {
  const scores = new Map<string, number>();
  for (const s of strategies) scores.set(s.id, 0);
  const matches: MatchResult[] = [];
  for (let i = 0; i < strategies.length; i++) {
    for (let j = 0; j < strategies.length; j++) {
      const r = playMatch(strategies[i], strategies[j], roundsPerPair);
      scores.set(strategies[i].id, (scores.get(strategies[i].id) ?? 0) + r.scoreA);
      scores.set(strategies[j].id, (scores.get(strategies[j].id) ?? 0) + r.scoreB);
      matches.push(r);
    }
  }
  const ranking = strategies
    .map((s) => ({ id: s.id, label: s.label, score: scores.get(s.id) ?? 0, color: s.color }))
    .sort((a, b) => b.score - a.score);
  return { matches, scores, ranking };
}

export interface Generation {
  gen: number;
  counts: Record<string, number>;
}

export function runEvolution(
  initialCounts: Record<string, number>,
  generations: number,
  roundsPerPair: number,
  strategies: Strategy[] = STRATEGIES,
): Generation[] {
  const history: Generation[] = [{ gen: 0, counts: { ...initialCounts } }];
  let counts = { ...initialCounts };
  const totalPop = Object.values(counts).reduce((a, b) => a + b, 0);

  for (let g = 1; g <= generations; g++) {
    const active = strategies.filter((s) => (counts[s.id] ?? 0) > 0);
    if (active.length === 0) break;

    const totalScores: Record<string, number> = {};
    for (const s of active) totalScores[s.id] = 0;

    for (const sA of active) {
      for (const sB of active) {
        const r = playMatch(sA, sB, roundsPerPair);
        totalScores[sA.id] += r.scoreA * (counts[sB.id] ?? 0);
        totalScores[sB.id] += r.scoreB * (counts[sA.id] ?? 0);
      }
    }

    const newCounts: Record<string, number> = {};
    for (const s of strategies) newCounts[s.id] = 0;

    let fitnessSum = 0;
    for (const s of active) {
      const pop = counts[s.id] ?? 0;
      const fitness = pop > 0 ? totalScores[s.id] / pop : 0;
      fitnessSum += fitness * pop;
    }

    if (fitnessSum <= 0) break;

    for (const s of active) {
      const pop = counts[s.id] ?? 0;
      const fitness = totalScores[s.id] / pop;
      newCounts[s.id] = Math.round((fitness * pop / fitnessSum) * totalPop);
    }

    const newTotal = Object.values(newCounts).reduce((a, b) => a + b, 0);
    if (newTotal > 0 && newTotal !== totalPop) {
      const largest = Object.entries(newCounts).sort((a, b) => b[1] - a[1])[0][0];
      newCounts[largest] += totalPop - newTotal;
    }

    counts = newCounts;
    history.push({ gen: g, counts: { ...counts } });
  }

  return history;
}
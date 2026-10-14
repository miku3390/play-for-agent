export type StagMove = "stag" | "hare";
export type StagHistory = StagMove[];

export interface StagStrategy {
  id: string;
  label: string;
  color: string;
  description: string;
  explanation: string;
  code: string;
  decide: (myHistory: StagHistory, oppHistory: StagHistory) => StagMove;
}

// Stag 猎鹿（高收益高风险），Hare 抓兔（保底低收益）
export const STAG_PAYOFFS = { SS: 3, SH: 0, HS: 2, HH: 1 } as const;

export const STAG_STRATEGIES: StagStrategy[] = [
  {
    id: "always_stag",
    label: "猎鹿狂",
    color: "#2D6A4F",
    description: "永远猎鹿，赌对方合作",
    explanation: "理想主义者的大肉梦。两人同心猎鹿就是大丰收（+3），但只要对方抓兔保底，猎鹿狂就两手空空。在人人互相猜忌的环境里，它活不过三集；在充满信任的环境里，它是最富有的。",
    code: "# 猎鹿狂\n# 核心逻辑：永远猎鹿，赌对方合作\n\nwhile game_not_over:\n    action = STAG    # 一起猎鹿才有的吃\n    yield action",
    decide: () => "stag",
  },
  {
    id: "always_hare",
    label: "兔子佬",
    color: "#B5838D",
    description: "永远抓兔，绝不冒险",
    explanation: "风险厌恶的极致。抓兔子稳拿 +1，从不看别人脸色。这是「风险占优」的一方——当你不确定对方会不会守约时，抓兔是理性人的保守选择。也是演化中低风险环境下的常胜将军。",
    code: "# 兔子佬\n# 核心逻辑：永远抓兔，绝不冒险\n\nwhile game_not_over:\n    action = HARE    # 兔子虽小，但跑不了\n    yield action",
    decide: () => "hare",
  },
  {
    id: "tit_for_tat",
    label: "以牙还牙",
    color: "#FFD166",
    description: "先猎鹿，之后模仿对手上一手",
    explanation: "先伸出信任，对方若抓兔，下一手就抓兔报复。守约者会得到一场鹿肉宴，叛逃者只会得到兔子。和囚徒困境里的同名策略一样：善良但记仇，宽容但清晰。",
    code: "# 以牙还牙（猎鹿版）\n# 核心逻辑：先猎鹿表示信任，之后复制对手上一手\n\nif my_history.length == 0:\n    action = STAG           # 我信你\nelse:\n    action = opp_history[-1] # 你怎么对我，我怎么对你\nyield action",
    decide: (_my, opp) => (opp.length > 0 ? opp[opp.length - 1] : "stag"),
  },
  {
    id: "grudger",
    label: "黑帮老大",
    color: "#6A4C93",
    description: "先猎鹿，被骗一次永远抓兔",
    explanation: "不原谅主义者。只要对方在自己猎鹿时抓过兔，就认定对方是叛徒，余生只抓兔。信任一旦断裂不再修复。这在有噪声的环境里会走向全输——一次误判，猎鹿宴永久散伙。",
    code: "# 黑帮老大（猎鹿版）\n# 核心逻辑：先猎鹿，被骗一次永远抓兔\n\nbetrayed = False\nif not betrayed:\n    action = STAG\nelse:\n    action = HARE\nif my_last == STAG and opp_last == HARE:\n    betrayed = True      # 记一辈子\nyield action",
    decide: (_my, opp) => (opp.includes("hare") ? "hare" : "stag"),
  },
  {
    id: "scout",
    label: "侦察兵",
    color: "#2A9D8F",
    description: "前两轮抓兔观察，对方可靠才猎鹿",
    explanation: "谨慎的信任投资者。先抓兔保底，观察对方前两轮是否都守约猎鹿——是，就转而猎鹿共谋大肉；不是，就永远抓兔。用两轮小肉买一个「对方是否可信」的信号，是试探型策略。",
    code: "# 侦察兵\n# 核心逻辑：先抓兔观察两轮，确认可靠再猎鹿\n\nif my_length < 2:\n    action = HARE                  # 先保底\nelif opp[0] == STAG and opp[1] == STAG:\n    action = STAG                  # 验证通过，交信任\nelse:\n    action = HARE                  # 不可信，继续抓兔\nyield action",
    decide: (my, opp) => {
      if (my.length < 2) return "hare";
      return (opp[0] === "stag" && opp[1] === "stag") ? "stag" : "hare";
    },
  },
  {
    id: "pavlov",
    label: "巴甫洛夫",
    color: "#F77F00",
    description: "出手一致则重复，不一致则换（Win-Stay Lose-Shift）",
    explanation: "条件反射式策略。上一手两人选择一致（协调成功）就重复，不一致（错位）就换成另一手。在猎鹿博弈里它会不断试错，直到与对方对齐为止——但碰上故意搅局的对手会来回摇摆。",
    code: "# 巴甫洛夫（猎鹿版）\n# 核心逻辑：一致就保持，不一致就换\n\nif my_length == 0:\n    action = STAG\nelse:\n    if my[-1] == opp[-1]:    # 协调成功，保持\n        action = my[-1]\n    else:                    # 错位，换手\n        action = STAG if my[-1] == HARE else HARE\nyield action",
    decide: (my, opp) => {
      if (my.length === 0) return "stag";
      const lm = my[my.length - 1], lo = opp[opp.length - 1];
      return lm === lo ? lm : (lm === "stag" ? "hare" : "stag");
    },
  },
  {
    id: "tit_for_two_tats",
    label: "宽恕者",
    color: "#A8DADC",
    description: "对手连续两次抓兔才降级抓兔",
    explanation: "给一次改过机会的版本。对方偶尔抓兔（可能只是试探或失误）就继续猎鹿，连续两次抓兔才判定为叛徒。在带噪声的环境里比「以牙还牙」更能维持长期合作，代价是面对蓄意背叛者会多挨一刀。",
    code: "# 宽恕者（猎鹿版）\n# 核心逻辑：原谅一次，两次才降级\n\nif opp.length < 2:\n    action = STAG\nelse:\n    if opp[-1] == HARE and opp[-2] == HARE:\n        action = HARE        # 连续两次，不玩了\n    else:\n        action = STAG        # 再信你一回\nyield action",
    decide: (_my, opp) => {
      if (opp.length < 2) return "stag";
      return (opp[opp.length - 1] === "hare" && opp[opp.length - 2] === "hare") ? "hare" : "stag";
    },
  },
  {
    id: "random",
    label: "随机",
    color: "#8D99AE",
    description: "抛硬币决定猎鹿还是抓兔",
    explanation: "没有策略的策略。一半时间赌大肉，一半时间抓保底。在猎鹿博弈里它没有在囚徒困境里那么蠢——因为抓兔本身就是纳什均衡之一，随机的保守部分偶尔也能蹭到分数。",
    code: "# 随机（猎鹿版）\n# 核心逻辑：抛硬币\n\nimport random\n\nwhile game_not_over:\n    action = STAG if random() < 0.5 else HARE\n    yield action",
    decide: () => (Math.random() < 0.5 ? "stag" : "hare"),
  },
];

export interface StagMatch { strategyA: string; strategyB: string; scoreA: number; scoreB: number; rounds: { a: StagMove; b: StagMove }[]; }
export function playMatch(sA: StagStrategy, sB: StagStrategy, rounds: number): StagMatch {
  const hA: StagHistory = [], hB: StagHistory = []; const log: { a: StagMove; b: StagMove }[] = []; let scoreA = 0, scoreB = 0;
  for (let i = 0; i < rounds; i++) {
    const a = sA.decide(hA, hB), b = sB.decide(hB, hA); hA.push(a); hB.push(b); log.push({ a, b });
    if (a === "stag" && b === "stag") { scoreA += STAG_PAYOFFS.SS; scoreB += STAG_PAYOFFS.SS; }
    else if (a === "stag") { scoreA += STAG_PAYOFFS.SH; scoreB += STAG_PAYOFFS.HS; }
    else if (b === "stag") { scoreA += STAG_PAYOFFS.HS; scoreB += STAG_PAYOFFS.SH; }
    else { scoreA += STAG_PAYOFFS.HH; scoreB += STAG_PAYOFFS.HH; }
  }
  return { strategyA: sA.id, strategyB: sB.id, scoreA, scoreB, rounds: log };
}

export interface StagTournament { matches: StagMatch[]; scores: Map<string, number>; ranking: { id: string; label: string; score: number; color: string }[]; }
export function runTournament(strategies: StagStrategy[], roundsPerPair: number): StagTournament {
  const scores = new Map<string, number>(); for (const s of strategies) scores.set(s.id, 0);
  const matches: StagMatch[] = [];
  for (let i = 0; i < strategies.length; i++) for (let j = 0; j < strategies.length; j++) {
    const r = playMatch(strategies[i], strategies[j], roundsPerPair);
    scores.set(strategies[i].id, (scores.get(strategies[i].id) ?? 0) + r.scoreA);
    scores.set(strategies[j].id, (scores.get(strategies[j].id) ?? 0) + r.scoreB);
    matches.push(r);
  }
  return { matches, scores, ranking: strategies.map(s => ({ id: s.id, label: s.label, score: scores.get(s.id) ?? 0, color: s.color })).sort((a, b) => b.score - a.score) };
}

export interface StagGeneration { gen: number; counts: Record<string, number>; }
export function runEvolution(initialCounts: Record<string, number>, generations: number, roundsPerPair: number, strategies: StagStrategy[] = STAG_STRATEGIES): StagGeneration[] {
  const history: StagGeneration[] = [{ gen: 0, counts: { ...initialCounts } }];
  let counts = { ...initialCounts };
  const totalPop = Object.values(counts).reduce((a, b) => a + b, 0);

  for (let g = 1; g <= generations; g++) {
    const active = strategies.filter((s) => (counts[s.id] ?? 0) > 0);
    if (active.length === 0) break;

    // 适应度 = 一个个体面对全种群的平均每场得分
    const fitness: Record<string, number> = {};
    for (const s of active) fitness[s.id] = 0;

    for (let i = 0; i < active.length; i++) {
      for (let j = i; j < active.length; j++) {
        const A = active[i], B = active[j];
        const r = playMatch(A, B, roundsPerPair);
        if (i === j) {
          fitness[A.id] += r.scoreA * (counts[A.id] ?? 0);
        } else {
          fitness[A.id] += r.scoreA * (counts[B.id] ?? 0);
          fitness[B.id] += r.scoreB * (counts[A.id] ?? 0);
        }
      }
    }
    for (const s of active) fitness[s.id] /= totalPop;

    // 平均适应度（按种群占比加权）
    let avg = 0;
    for (const s of active) avg += fitness[s.id] * ((counts[s.id] ?? 0) / totalPop);
    if (avg <= 0) break;

    // 繁殖量 ∝ 自身种群数 × 适应度
    const nc: Record<string, number> = {};
    for (const s of strategies) nc[s.id] = 0;
    for (const s of active) {
      nc[s.id] = Math.round((counts[s.id] ?? 0) * (fitness[s.id] / avg));
    }
    const nt = Object.values(nc).reduce((a, b) => a + b, 0);
    if (nt > 0 && nt !== totalPop) {
      const largest = Object.entries(nc).sort((a, b) => b[1] - a[1])[0][0];
      nc[largest] += totalPop - nt;
    }
    counts = nc;
    history.push({ gen: g, counts: { ...counts } });
  }
  return history;
}

// 猜 2/3 平均数（Keynes 选美博弈 / Guess 2/3 of the Average）
// 每轮所有玩家从 0~100 猜一个数，最接近「全体平均值 × 2/3」的人赢。
// 纳什均衡是 0：如果人人都足够理性，会无限递推下去。但现实中没人猜 0——因为别人没那么理性。

export interface GuessAgent {
  id: string;
  label: string;
  color: string;
  description: string;
  explanation: string;
  code: string;
  // 根据历史（每轮所有人的猜数、平均值、目标值）决定本轮猜几
  decide: (history: GuessRoundSummary[]) => number;
}

export interface GuessRoundSummary {
  round: number;
  guesses: Record<string, number>;
  average: number;
  target: number; // 2/3 × average
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export const GUESS_AGENTS: GuessAgent[] = [
  {
    id: "guess_50",
    label: "天真 50",
    color: "#00B4D8",
    description: "猜 50，完全没算 2/3 这层",
    explanation: "零阶推理：假设别人在 0~100 随机猜，平均值是 50——但连「应该猜 50 的 2/3」这一步都没走到。它以为大家在随机猜，却不记得自己也该除以 3 再乘 2。",
    code: "# 天真 50\n# 核心逻辑：以为别人随机猜，平均 50\n\ndef decide():\n    return 50        # 忘了还要 ×2/3\n",
    decide: () => 50,
  },
  {
    id: "level1",
    label: "一阶 33",
    color: "#2A9D8F",
    description: "猜 33：认为别人猜 50，取 50 的 2/3",
    explanation: "一阶推理者：想了一层。所有人都猜 50，平均就是 50，那 2/3 是 33.3。但问题在于——如果大家都这么想，别人就不会猜 50 了。",
    code: "# 一阶推理\n# 核心逻辑：别人猜 50，平均 50，我猜 2/3\n\ndef decide():\n    return 50 * 2 / 3   # ≈ 33\n",
    decide: () => 33,
  },
  {
    id: "level2",
    label: "二阶 22",
    color: "#F77F00",
    description: "猜 22：认为别人都是一阶，取 33 的 2/3",
    explanation: "二阶推理者：想了两层。别人是一阶（猜 33），平均约 33，那 2/3 是 22。每多想一层，答案就乘一次 2/3，从 50 一路滑向 0。",
    code: "# 二阶推理\n# 核心逻辑：别人都已是一阶(33)，再取 2/3\n\ndef decide():\n    return 33 * 2 / 3   # ≈ 22\n",
    decide: () => 22,
  },
  {
    id: "level3",
    label: "三阶 15",
    color: "#6A4C93",
    description: "猜 15：认为别人都是二阶，取 22 的 2/3",
    explanation: "三阶推理者。22 的三分之二约 15。到这个层级，已经进入了「我知道你知道我知道」的套娃，绝大多数真人停在这里。",
    code: "# 三阶推理\n# 核心逻辑：别人已是二阶(22)，再取 2/3\n\ndef decide():\n    return 22 * 2 / 3   # ≈ 15\n",
    decide: () => 15,
  },
  {
    id: "level4",
    label: "四阶 10",
    color: "#B5838D",
    description: "猜 10：认为别人都是三阶，取 15 的 2/3",
    explanation: "四阶推理者。15 的三分之二约 10。再往下数几层就逼近 0 了——但每多猜一层，都赌「别人的智商也比你以为的高一层」。",
    code: "# 四阶推理\n# 核心逻辑：别人已是三阶(15)，再取 2/3\n\ndef decide():\n    return 15 * 2 / 3   # ≈ 10\n",
    decide: () => 10,
  },
  {
    id: "zero",
    label: "无限递推 0",
    color: "#E63946",
    description: "猜 0：纳什均衡，假设所有人无限理性",
    explanation: "理论赢家、现实输家。如果人人都无限理性、都知道彼此无限理性，那唯一的共同答案就是 0。但只要你猜 0，而人群里混着几个天真 50 和搅局者，平均值就被拉高，猜 0 的你反而差了十万八千里。",
    code: "# 无限递推\n# 核心逻辑：人人无限理性 → 只有 0 服众\n\ndef decide():\n    return 0        # 纳什均衡\n",
    decide: () => 0,
  },
  {
    id: "follower",
    label: "追踪者",
    color: "#FFD166",
    description: "猜上一轮公布的 2/3 目标值",
    explanation: "适应型：不靠先验推理，靠看上一轮结果。上一轮官方公布的 2/3 目标是多少，这轮就猜多少——赌「众人行为存在惯性」。在人群水平稳定时会很准，在群体快速朝 0 收敛时会被甩在后面。",
    code: "# 追踪者\n# 核心逻辑：人群有惯性，跟上轮的 2/3\n\ndef decide(history):\n    if not history:\n        return 33          # 第一轮猜一阶值\n    return history[-1].target   # 跟上一轮官方 2/3\n",
    decide: (h) => (h.length === 0 ? 33 : clamp(h[h.length - 1].target)),
  },
  {
    id: "contrarian",
    label: "搅局者 100",
    color: "#8D99AE",
    description: "猜 100，故意拉高平均值害死猜低的人",
    explanation: "不是来赢的，是来恶心人的。猜 100 把平均值狠狠拉高，让所有往下猜的人——尤其猜 0 的无限理性派——全部脱靶。单轮它自己不赢，但只要它存在，整个群体的平均值就再也回不到 0。",
    code: "# 搅局者\n# 核心逻辑：我不在乎赢，我在乎所有人一起输\n\ndef decide():\n    return 100      # 拉高平均数\n",
    decide: () => 100,
  },
];

export interface GuessOutcome {
  rounds: GuessRoundSummary[];
  scores: Record<string, number>;
  ranking: { id: string; label: string; score: number; color: string }[];
}

export function runGuessPool(agents: GuessAgent[], rounds: number): GuessOutcome {
  const history: GuessRoundSummary[] = [];
  const scores: Record<string, number> = {};
  for (const a of agents) scores[a.id] = 0;

  for (let r = 0; r < rounds; r++) {
    const guesses: Record<string, number> = {};
    for (const a of agents) guesses[a.id] = clamp(a.decide(history));
    const vals = Object.values(guesses);
    const average = vals.reduce((a, b) => a + b, 0) / vals.length;
    const target = (average * 2) / 3;
    const summary: GuessRoundSummary = { round: r + 1, guesses, average, target };
    history.push(summary);
    // 每轮得分 = 100 - |guess - target|，越接近越高
    for (const a of agents) scores[a.id] += Math.max(0, 100 - Math.abs(guesses[a.id] - target));
  }

  const ranking = agents.map(a => ({ id: a.id, label: a.label, score: Math.round(scores[a.id]), color: a.color })).sort((x, y) => y.score - x.score);
  return { rounds: history, scores, ranking };
}
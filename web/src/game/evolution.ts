export type Move = "cooperate" | "defect";
export type History = Move[];

export interface Strategy {
  id: string;
  label: string;
  color: string;
  description: string;      // 简述：列表页一行展示
  explanation: string;       // 原理：详情页展开看
  code: string;              // 代码逻辑：可编辑、可读
  decide: (myHistory: History, oppHistory: History) => Move;
}

export const PAYOFFS = { CC: 2, CD: -1, DC: 3, DD: 0 } as const;

export const STRATEGIES: Strategy[] = [
{
  id: "always_cooperate",
  label: "合作宝宝",
  color: "#00B4D8",
  description: "永远合作，无论对方做什么",
  explanation: "最善良的纯策略——从不背叛，从不忘仇。如果周围都是善良的人，它活得最好；但如果遇到骗子和骗子们，它会成为所有对手的提款机。",
  code: `# 合作宝宝
# 核心逻辑：无条件合作

while game_not_over:
    action = COOPERATE   # 永远不出手伤人
    yield action`,
  decide: () => "cooperate",
},
{
  id: "always_defect",
  label: "欺骗",
  color: "#E63946",
  description: "永远背叛，绝不合作",
  explanation: "最自私的策略。每一回合都最大化自己的利益——但如果所有人都这么想，每人每次都只得到 0 分，而不是互相合作的各得 2 分。个体理性导致集体非理性的经典例子。",
  code: `# 欺骗
# 核心逻辑：无条件背叛

while game_not_over:
    action = DEFECT      # 每次都是背刺
    yield action`,
  decide: () => "defect",
},
{
  id: "tit_for_tat",
  label: "以牙还牙",
  color: "#FFD166",
  description: "首回合合作，之后模仿对手上一回合动作",
  explanation: "Axelrod 1984 年锦标赛冠军。简单却强大：善良（不先背叛）、记仇（被报复）、宽容（悔过就原谅）、清晰（对手能摸清模式）。以净胜分夺冠。",
  code: `# 以牙还牙 (Tit for Tat)
# 核心逻辑：你对我好，我就对你好；你伤我一次，我也伤你一次。

if my_history.length == 0:
    action = COOPERATE       # 第一回合伸出援手
else:
    action = opp_history[-1]  # 复制对手上一步
yield action`,
  decide: (_my, opp) => (opp.length > 0 ? opp[opp.length - 1] : "cooperate"),
},
{
  id: "grudger",
  label: "黑帮老大",
  color: "#6A4C93",
  description: "一直合作，被骗一次后永远背叛",
  explanation: "比以牙还牙极端得多——一旦被骗就不再原谅。对骗子是最佳受害者，但对群体来说会造成不可逆的信任断裂。一条毒蛇能让村庄永不相安。",
  code: `# 黑帮老大 (Grudger / Unforgiving)
# 核心逻辑：只要你不骗我，我就是好人；骗过一次就是一辈子敌人。

cheated = False
if not cheated:
    action = COOPERATE
else:
    action = DEFECT
if opponent_last_action == DEFECT:
    cheated = True
yield action`,
  decide: (_my, opp) => (opp.includes("defect") ? "defect" : "cooperate"),
},
{
  id: "detective",
  label: "福尔摩斯",
  color: "#2A9D8F",
  description: "前四回合试探后根据结果选择复读机或欺骗",
  explanation: "唯一的主动型骗子。先用 C/D/C/C 试探对手：上钩了就永久利用，识破了就切回以牙还牙自保。二阶段精英主义博弈。",
  code: `# 福尔摩斯 (Detective)
# 核心逻辑：先试探，再决定当狐狸还是羊。

opener_pattern = [COOPERATE, DEFECT, COOPERATE, COOPERATE]
if my_length < 4:
    action = opener_pattern[my_length]   # 抛出诱饵
else:
    if opp[:4] matches expected:
        action = always_DEFECT            # 抓到傻子继续收割
    else:
        action = tit_for_tat(opp)         # 碰到大人规矩做人
yield action`,
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
  description: "上一轮双方一致则重复，不一致则反转（Win-Stay Lose-Shift）",
  explanation: "来自行为心理学的条件反射：赢了原地不动，输了换个打法。面对随机犯错的人时比 TFT 强（不会陷入报复循环），但故意欺骗者面前不够敏锐。",
  code: `# 巴甫洛夫 (Pavlov / Win-Stay Lose-Shift)
# 核心逻辑：赢了就不变，输了就改。

if my_length == 0:
    action = COOPERATE
else:
    last_my = my[-1]; last_opp = opp[-1]
    if last_my == last_opp:  # 赢局保持
        action = last_my
    else:                    # 输局反转
        action = COOPERATE if last_my == DEFECT else DEFECT
yield action`,
  decide: (my, opp) => {
      if (my.length === 0) return "cooperate";
      const lm = my[my.length - 1], lo = opp[opp.length - 1];
      return lm === lo ? lm : (lm === "cooperate" ? "defect" : "cooperate");
    },
},
{
  id: "tit_for_two_tats",
  label: "宽容复读机",
  color: "#A8DADC",
  description: "只有对手连续两次背叛才报复",
  explanation: "TFT 的温和版。连骗两次才反击，在对手偶尔犯错时不会被卷入无意义报复螺旋。代价是对故意欺骗者非常脆弱——骗子假装失误就能持续利用它。",
  code: `# 宽容复读机 (Tit for Two Tats)
# 核心逻辑：原谅一次，但不会原谅第二次。

if opp.length < 2:
    action = COOPERATE           # 给机会
else:
    if opp[-1] == DEFECT and opp[-2] == DEFECT:
        action = DEFECT          # 这次真生气了
    else:
        action = COOPERATE       # 还能忍
yield action`,
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
  description: "抛硬币：50% 合作，50% 背叛",
  explanation: "完全没有策略。在 Axelrod 锦标赛中用来检验其他策略是否真的聪明。进化模式中通常优于欺骗、劣于 TFT——至少一半时间会给别人合作机会。",
  code: `# 随机 (Random)
# 核心逻辑：我没有策略，我有硬币。

import random

while game_not_over:
    action = COOPERATE if random() < 0.5 else DEFECT
    yield action

# 没有记忆，没有学习，没有目的。
# 你甚至不能预测下一秒它会做什么。`,
  decide: () => (Math.random() < 0.5 ? "cooperate" : "defect"),
},
];

export interface MatchResult { strategyA: string; strategyB: string; scoreA: number; scoreB: number; rounds: { a: Move; b: Move }[]; }
export function playMatch(sA: Strategy, sB: Strategy, rounds: number): MatchResult {
  const hA: History = [], hB: History = []; const log: { a: Move; b: Move }[] = []; let scoreA = 0, scoreB = 0;
  for (let i = 0; i < rounds; i++) {
    const a = sA.decide(hA, hB), b = sB.decide(hB, hA); hA.push(a); hB.push(b); log.push({ a, b });
    if (a==="cooperate"&&b==="cooperate"){scoreA+=PAYOFFS.CC;scoreB+=PAYOFFS.CC;}
    else if (a==="cooperate"){scoreA+=PAYOFFS.CD;scoreB+=PAYOFFS.DC;}
    else if (b==="cooperate"){scoreA+=PAYOFFS.DC;scoreB+=PAYOFFS.CD;}
    else{scoreA+=PAYOFFS.DD;scoreB+=PAYOFFS.DD;}
  } return {strategyA:sA.id,strategyB:sB.id,scoreA,scoreB,rounds:log};
}
export interface TournamentResult { matches: MatchResult[]; scores: Map<string,number>; ranking:{id:string;label:string;score:number;color:string}[]; }
export function runTournament(strategies:Strategy[],roundsPerPair:number):TournamentResult{
  const scores=new Map<string,number>();for(const s of strategies)scores.set(s.id,0);const matches:MatchResult[]=[];
  for(let i=0;i<strategies.length;i++)for(let j=0;j<strategies.length;j++){
    const r=playMatch(strategies[i],strategies[j],roundsPerPair);scores.set(strategies[i].id,(scores.get(strategies[i].id)??0)+r.scoreA);scores.set(strategies[j].id,(scores.get(strategies[j].id)??0)+r.scoreB);matches.push(r);}
  return{matches,scores,ranking:strategies.map(s=>({id:s.id,label:s.label,score:scores.get(s.id)??0,color:s.color})).sort((a,b)=>b.score-a.score)};
}

export interface Generation { gen: number; counts: Record<string, number>; }
export function runEvolution(initialCounts: Record<string, number>, generations: number, roundsPerPair: number, strategies: Strategy[] = STRATEGIES): Generation[] {
  const history: Generation[] = [{ gen: 0, counts: { ...initialCounts } }];
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

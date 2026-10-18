#!/usr/bin/env python3
"""丢手绢 · 平衡扫描器 (M0) —— bleed 规则版 v0.2

建模对象是仓库现行规则（engine/src/handkerchief_engine），在此基础上补两条候选修复参数
（atk_chrono 攻方等待计息 / never_atk 失职罚）。原始规则 + 双向时钟的完整推导见
docs/handkerchief-arena-design-v0.1.md（v0.1 文档 §1.5–1.6）。扫描器的任务：

1. 证明现状（攻方不计息、失职罚 0）下 DROP 是弱被占优策略——bleed 救不回来
2. 扫出能让核心动作（DROP）回到均衡的参数组合
3. 验证定律：失职罚必须严格大于命中惩罚
4. 给出推荐基准（--config 查看均衡形态）

规则语义（round-level 归约，攻方坏账在丢下那一刻停止计息）：

- 命中（d <= k）：攻 -hit_loss - atk_chrono*(d-1)；守 +hit_gain - bleed*(k-d)
- 纯查空（k < d 或永不丢）：攻 -atk_chrono*(k-1)（永不丢按走满计 max_turns-1，
  再加失职罚 never_atk）；守 -(miss+k)
- 手绢落地后、检查前的每个回合，守方流血 -bleed（检查/强制检查当回合不流）

    玩家画像 profile = (攻方意图 d, 守方意图 k)，按角色独立抽样近似。
    求解器沿用虚构博弈（fictitious play），对称博弈下两个玩家收敛到同一对边缘分布 (mu, nu)。

用法:
    python lab/balance_scan.py            全部扫描（现状自查 + 修复扫描 + 阈值 + 推荐）
    python lab/balance_scan.py --config   只看推荐基准配置
    python lab/balance_scan.py --verify   收益公式 vs 规则引擎逐回合实测对照
"""
from __future__ import annotations

import argparse
import math
import random
import sys
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Sequence

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

NEVER = 11                       # 攻方整轮不丢下
D_OPTS: list[int] = list(range(1, 11)) + [NEVER]
K_OPTS: list[int] = list(range(1, 11))
H_MAX_A = math.log2(len(D_OPTS))
H_MAX_K = math.log2(len(K_OPTS))

# 健康度阈值（沿用文档 2.6 的口径）
HEALTH = {"entropy": 2.0, "first_win": (0.45, 0.55), "never": 0.05, "runaway": 0.05}


@dataclass(frozen=True)
class Config:
    """与 EngineConfig 同语义的子集 + 两条候选修复参数（攻方侧时钟与失职罚）。

    atk_chrono / never_atk 当前引擎里并不存在（EngineConfig 只守方计息），
    本扫描器的职责就是证明：缺了它们，DROP 在任何 bleed 下都是弱被占优策略。
    """
    initial_hp: int = 50
    max_turns: int = 10
    bleed: int = 2              # 守方落地后流血/回合（引擎已有，保持不动）
    atk_chrono: int = 1         # 攻方计息/等待回合（扫描推荐，见 EngineConfig）
    never_atk: int = 15         # 整轮不丢的失职罚（必须稍大于命中惩罚）
    miss: int = 10
    hit_gain: int = 5
    hit_loss: int = 10


def payoff(c: Config, d: int, k: int) -> tuple[int, int]:
    """一轮的 (攻方收益, 守方收益)，与 engine.resolve_turn 逐步实测结果一致（--verify）。

    攻方计息在"丢下"那一刻停止；失职罚只在走满且从未丢下时结算。
    检查就在当轮终结：k < d 的纯查空在检查当刻终结，丢下从未发生，守方无流血。
    """
    if d != NEVER and d <= k:
        return (-c.hit_loss - c.atk_chrono * (d - 1), c.hit_gain - c.bleed * (k - d))
    a = -c.atk_chrono * (k - 1)              # 回合终结时攻方的等待计息
    if k == c.max_turns:                     # 走满 · 失职（无论守方主动查还是强制）
        a = -c.atk_chrono * (c.max_turns - 1) - c.never_atk
    return (a, -(c.miss + k))


# ---------- 边缘分布下的期望值（d/k 取值各 11/10 个，直接内积足够快） ----------

def attack_value(c: Config, d: int, nu: Sequence[float]) -> float:
    """我用 d 打，对手守方意图分布为 nu 时，攻方一轮期望收益。与 payoff 攻方侧同构。"""
    total = 0.0
    for k in K_OPTS:
        p = nu[k - 1]
        if p <= 0.0:
            continue
        if d != NEVER and d <= k:
            total += p * (-c.hit_loss - c.atk_chrono * (d - 1))
        else:
            base = -c.atk_chrono * (k - 1)
            if k == c.max_turns:
                base = -c.atk_chrono * (c.max_turns - 1) - c.never_atk
            total += p * base
    return total


def defend_value(c: Config, k: int, mu: Sequence[float]) -> float:
    """我用 k 查，对手攻方意图分布为 mu 时，守方一轮期望收益。与 payoff 守方侧同构。"""
    total = 0.0
    for i, d in enumerate(D_OPTS):
        p = mu[i]
        if p <= 0.0:
            continue
        if d != NEVER and d <= k:
            total += p * (c.hit_gain - c.bleed * (k - d))
        else:
            # 命中之外的唯一走向：回合在检查时终结，丢下从未发生（k < d 或永不丢）
            total += p * (-(c.miss + k))
    return total


def solve_mixed(c: Config, iters: int = 30000, seed: int = 7):
    """虚构博弈求近似混合均衡。返回 (mu, nu, ev_atk, ev_def)。

    对称博弈：两个玩家用同一套更新规则，收敛到同一对边缘分布。
    """
    rng = random.Random(seed)
    ma_nums = [0] * len(D_OPTS)
    nu_nums = [0] * len(K_OPTS)
    ma_nums[0] = nu_nums[0] = 1

    def dist(nums: list[int]) -> list[float]:
        t = sum(nums)
        return [x / t for x in nums]

    prev = None
    for it in range(iters):
        mu = dist(ma_nums)
        nu = dist(nu_nums)
        va = [attack_value(c, d, nu) for d in D_OPTS]
        best = max(va)
        d_star = rng.choice([i for i, v in enumerate(va) if abs(v - best) < 1e-9])
        vd = [defend_value(c, k, mu) for k in K_OPTS]
        best = max(vd)
        k_star = rng.choice([i for i, v in enumerate(vd) if abs(v - best) < 1e-9])
        ma_nums[d_star] += 1
        nu_nums[k_star] += 1

        if it and it % 2000 == 0:
            cur = (tuple(round(x / sum(ma_nums), 4) for x in ma_nums),
                   tuple(round(x / sum(nu_nums), 4) for x in nu_nums))
            if cur == prev:
                break
            prev = cur

    mu = dist(ma_nums)
    nu = dist(nu_nums)
    ev_atk = sum(mu[i] * attack_value(c, d, nu) for i, d in enumerate(D_OPTS))
    ev_def = sum(nu[k - 1] * defend_value(c, k, mu) for k in K_OPTS)
    return mu, nu, ev_atk, ev_def


def entropy(p: Sequence[float]) -> float:
    return -sum(x * math.log2(x) for x in p if x > 1e-9)


def simulate(c: Config, mu: Sequence[float], nu: Sequence[float],
             sims: int = 3000, seed: int = 99) -> dict:
    """整局仿真：50 HP，逐轮交替攻守。返回先手胜率、平均轮数与死因分布。

    引擎单回合只会伤一侧（命中伤攻 / 流血&自伤伤守 / 查空自伤守），双亡不可达。
    """
    rng = random.Random(seed)
    d_idx = range(len(D_OPTS))
    k_idx = range(len(K_OPTS))
    first_win = second_win = timeout = 0
    atk_dead = def_dead = 0
    rounds_sum = 0
    for _ in range(sims):
        hp = [c.initial_hp, c.initial_hp]
        f, s = 0, 1
        r = 0
        for r in range(1, 401):
            d = D_OPTS[rng.choices(d_idx, weights=mu)[0]]
            k = K_OPTS[rng.choices(k_idx, weights=nu)[0]]
            a, dd = payoff(c, d, k)
            hp[f] += a
            hp[s] += dd
            if hp[0] <= 0 or hp[1] <= 0:
                winner = 0 if hp[1] <= 0 else 1
                if winner == 0:
                    first_win += 1
                else:
                    second_win += 1
                if hp[f] <= 0:
                    atk_dead += 1    # 攻方被 -hit_loss 打死（自己冲得太凶）
                else:
                    def_dead += 1    # 守方死于流血 / 自伤 / 误判
                rounds_sum += r
                break
            f, s = s, f
        else:
            timeout += 1
            rounds_sum += 400
    return {
        "avg_rounds": rounds_sum / sims,
        "first_win": first_win / sims,
        "second_win": second_win / sims,
        "timeout": timeout / sims,
        "atk_dead": atk_dead / sims,
        "def_dead": def_dead / sims,
    }


def health(c: Config, mu, nu, sim: dict) -> str:
    bad = []
    if entropy(mu) < HEALTH["entropy"] or entropy(nu) < HEALTH["entropy"]:
        bad.append("熵低")
    if not HEALTH["first_win"][0] <= sim["first_win"] <= HEALTH["first_win"][1]:
        bad.append("先手失衡")
    if mu[D_OPTS.index(NEVER)] > HEALTH["never"]:
        bad.append("不丢率高")
    if sim["timeout"] > HEALTH["runaway"]:
        bad.append("对局失控")
    return "健康" if not bad else "退化: " + ",".join(bad)


# ---------------- 扫描与展示 ----------------

def _row(c: Config, label: str) -> None:
    mu, nu, _, _ = solve_mixed(c)
    sim = simulate(c, mu, nu)
    print(f"  {label:<12}{entropy(mu):>6.2f}{entropy(nu):>6.2f}"
          f"{mu[D_OPTS.index(NEVER)]*100:>6.0f}%{sim['first_win']*100:>8.0f}%"
          f"{sim['avg_rounds']:>8.1f}{sim['timeout']*100:>6.0f}%"
          f"{sim['atk_dead']*100:>6.0f}%   {health(c, mu, nu, sim)}")


def _head() -> None:
    print(f"  {'配置':<12}{'熵d':>6}{'熵k':>6}{'不丢%':>7}{'先手胜%':>9}{'平均轮':>8}{'失控%':>7}{'攻灭%':>7}   判定")


def scan_current() -> None:
    """现状自查：引擎修参前的规则集（攻方不计息不失职），证明 DROP 弱被占优的洞仍然开着。"""
    print("\n[表1] 现状自查：守方流血值扫描，攻方不计息不失职（= 引擎修参前规则）")
    _head()
    for b in (0, 1, 2, 3, 4, 5, 6):
        _row(replace(Config(), bleed=b, atk_chrono=0, never_atk=0), f"bleed={b}")


def scan_repair() -> None:
    """修复扫描：攻方侧时钟 × 失职罚，找健康组合。"""
    print(f"\n[表2] 修复扫描：失职罚 never_atk=15，攻方时钟 atk_chrono 0/1/2 × 守方流血 bleed 0..4")
    _head()
    for chrono in (0, 1, 2):
        for b in (0, 1, 2, 3, 4):
            _row(replace(Config(), bleed=b, atk_chrono=chrono, never_atk=15), f"c{chrono}/b{b}")


def scan_never(chrono: int, bleed: int) -> None:
    print(f"\n[表3] 失职罚阈值：atk_chrono={chrono}, bleed={bleed}（阈值定律验证：必须 > 命中惩罚）")
    print(f"  {'never':>7}{'熵d':>6}{'熵k':>6}{'不丢%':>7}{'>4':>5}   判定")
    for na in (0, 5, 8, 10, 11, 12, 15, 20, 30):
        c = replace(Config(), bleed=bleed, atk_chrono=chrono, never_atk=na)
        mu, nu, _, _ = solve_mixed(c)
        never_pct = mu[D_OPTS.index(NEVER)]
        flag = "退化" if entropy(mu) < 2.0 or entropy(nu) < 2.0 else "健康"
        print(f"  {na:>7}{entropy(mu):>6.2f}{entropy(nu):>6.2f}{never_pct*100:>6.0f}%"
              f"{'<--' if never_pct > 0.05 else '':>5}   {flag}")


def show_config() -> None:
    c = Config()
    mu, nu, ev_atk, ev_def = solve_mixed(c, iters=60000)
    sim = simulate(c, mu, nu)
    print(f"\n[推荐基准] bleed={c.bleed} atk_chrono={c.atk_chrono} never_atk={c.never_atk} "
          f"miss={c.miss} gain={c.hit_gain} loss={c.hit_loss} T={c.max_turns} HP={c.initial_hp}")
    print("\n  攻方意图分布（第几回合丢）:")
    for d, p in zip(D_OPTS, mu):
        if p > 0.005:
            name = "永不丢" if d == NEVER else f"第{d:>2}回合丢"
            print(f"    {name}  {p*100:>5.1f}%  {'#' * round(p * 50)}")
    print("\n  守方意图分布（第几回合查）:")
    for k, p in zip(K_OPTS, nu):
        if p > 0.005:
            print(f"    第{k:>2}回合查  {p*100:>5.1f}%  {'#' * round(p * 50)}")
    print(f"\n  一轮期望: 攻方 {ev_atk:.2f} / 守方 {ev_def:.2f}")
    print(f"  策略熵:   {entropy(mu):.2f} / {entropy(nu):.2f} bit  (上界 {H_MAX_A:.2f} / {H_MAX_K:.2f})")
    avg_r = sim["avg_rounds"]
    print(f"  对局仿真: 平均 {avg_r:.1f} 轮 | 先手胜 {sim['first_win']*100:.0f}% | "
          f"后手胜 {sim['second_win']*100:.0f}% | 攻方自灭 {sim['atk_dead']*100:.0f}% | "
          f"失控 {sim['timeout']*100:.0f}%")
    print(f"  健康度:   {health(c, mu, nu, sim)}")


# ---------------- 公式对齐校验 ----------------

def verify() -> int:
    """把 payoff 公式与规则引擎逐回合实测对照（旧语义与修复语义各验一遍）。"""
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / "engine" / "src"))
    try:
        from handkerchief_engine import Action, EngineConfig, HandkerchiefEngine, RoundState
    except ImportError:
        print("（跳过校验：handkerchief_engine 不在路径上）")
        return 0

    cases = [(3, 5), (3, 3), (3, 10), (1, 7), (4, 2), (NEVER, 4), (NEVER, 10), (10, 10)]
    ec = EngineConfig()
    legacy = Config(bleed=ec.dropped_bleed_per_turn, miss=ec.miss_penalty,
                    hit_gain=ec.hit_defender_gain, hit_loss=ec.hit_attacker_loss,
                    max_turns=ec.max_turns_per_round, initial_hp=ec.initial_hp,
                    atk_chrono=0, never_atk=0)
    repaired = Config(bleed=ec.dropped_bleed_per_turn, miss=ec.miss_penalty,
                      hit_gain=ec.hit_defender_gain, hit_loss=ec.hit_attacker_loss,
                      max_turns=ec.max_turns_per_round, initial_hp=ec.initial_hp,
                      atk_chrono=ec.atk_chrono, never_atk=ec.never_atk)
    bad = 0
    for name, c in (("旧语义(atk_chrono=0)", legacy), ("修复语义(atk_chrono=1)", repaired)):
        econ = EngineConfig(dropped_bleed_per_turn=c.bleed, atk_chrono=c.atk_chrono,
                            never_atk=c.never_atk)
        print(f"\n[校验] {name}")
        for d, k in cases:
            state = RoundState(round_number=1)
            hp_a, hp_d = state.attacker_hp, state.defender_hp
            for t in range(1, ec.max_turns_per_round + 1):
                state.turn_number = t
                atk = Action.DROP if (d != NEVER and t == d) else Action.WAIT
                dec = Action.CHECK if t == k else Action.WAIT
                out = HandkerchiefEngine(econ).resolve_turn(state, atk, dec)
                if out["round_end"]:
                    break
            got = (state.attacker_hp - hp_a, state.defender_hp - hp_d)
            want = payoff(c, d, k)
            ok = got == want
            bad += 0 if ok else 1
            print(f"  d={str(d) if d != NEVER else '永不':>3} k={k:>2}  实测{got}  公式{want}  {'OK' if ok else 'MISMATCH'}")
    print(f"\n  {'全部吻合 ✓' if bad == 0 else f'{bad} 条不一致 ✗'}")
    return bad


def main() -> None:
    ap = argparse.ArgumentParser(description="丢手绢平衡扫描器（bleed 规则版）")
    ap.add_argument("--config", action="store_true", help="只看推荐基准配置")
    ap.add_argument("--verify", action="store_true", help="公式 vs 引擎实测")
    args = ap.parse_args()
    if args.verify:
        raise SystemExit(1 if verify() else 0)
    if args.config:
        show_config()
        return
    scan_current()
    scan_repair()
    scan_never(chrono=1, bleed=Config().bleed)
    show_config()


if __name__ == "__main__":
    main()

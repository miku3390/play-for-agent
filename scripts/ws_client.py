"""WS 观战客户端：连上 /ws/matches/{id}，打印事件流直到 RESULT。"""
import asyncio
import json
import sys

import websockets


async def main(url: str) -> None:
    async with websockets.connect(url) as ws:
        n = 0
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=240))
            n += 1
            t = msg.get("type")
            p = msg.get("payload") or {}
            if t == "MATCH_START":
                print(f"=== 对局开始 {msg['match_id']} | {p['agent_a']} vs {p['agent_b']}")
            elif t == "ROUND_START":
                print(f"-- 第 {p['round']} 轮 | 攻 {p['attacker']} 守 {p['defender']} | HP {p['attacker_hp']}:{p['defender_hp']}")
            elif t == "TURN_END":
                bleed = f" 流血-{p['bleed']}" if p.get("bleed") else ""
                print(f"  回合 {p['turn']:>2} | 攻 {p['attacker_action']:<4} 守 {p['defender_action']:<4} "
                      f"-> {p['result']:<11} | HP {p['attacker_hp']:>2}:{p['defender_hp']:>2}{bleed}")
            elif t == "ROUND_END":
                reason = "（血量归零）" if p.get("reason") == "hp_zero" else ""
                print(f"  >> 轮结束 {p['result']}{reason}")
            elif t == "MATCH_END":
                print(f"=== 对局结束 | 胜方 {p['winner'] or '平局'} | {p['finish_reason']} | {p['total_rounds']}轮{p['total_turns']}回合")
            elif t == "RESULT":
                print(f"RESULT {json.dumps(p, ensure_ascii=False)}")
                print(f"events={n}")
                return


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))

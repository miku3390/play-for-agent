# Handkerchief Arena · 丢手绢竞技场

面向 AI 代理的在线对战平台：两个 AI 玩家在"丢手绢"博弈中策略对抗。
设计文档见 [docs/handkerchief-arena-architecture.md](docs/handkerchief-arena-architecture.md)。

## 仓库布局

| 目录 | 说明 |
|------|------|
| `engine/` | 规则引擎（Python 包，纯逻辑、确定性） |
| `runtime/` | Agent 运行时：LLM 网关、上下文管理、事件总线、对局驱动器 |
| `demo/` | 命令行对局演示 |
| `strategies/` | 示例策略提示词 |
| `services/` | 后端微服务（FastAPI）：user / agent / matching / match + shared |
| `web/` | 前端门户与观战页（React + Vite + TS） |
| `infra/` | docker-compose 依赖环境与 Dockerfile |
| `docs/` | 架构与数据库设计 |

## 快速开始

```bash
# 依赖环境（PostgreSQL / Redis / MinIO）
docker compose -f infra/docker-compose.yml up -d

# 规则引擎 + 运行时测试
pip install -e "engine[dev]" -e "runtime[dev]"
pytest engine/tests runtime/tests

# 后端服务（match service，端口 8100 避开常见占用）
pip install -r services/requirements.txt
python -m uvicorn app.main:app --app-dir services/match --port 8100

# 前端（仓库用 pnpm，pnpm-lock.yaml 为准）
corepack enable && cd web && pnpm install && pnpm run dev
```

## 跑一局 AI 对战

```bash
# 离线演示（脚本 agent，不需要 API key）
python demo/run_match.py --mock

# 接入 DeepSeek：复制 .env.example 为 .env 并填入 key
pip install -e engine -e runtime
python demo/run_match.py --rounds 10
```

- system prompt 即策略，见 `strategies/` 下示例
- 双方决策并行调用，超时/非法输出降级 WAIT
- 守方视角隐藏手绢状态（信息隐藏），靠历史行为推理
- 事件流：控制台实时打印 + `logs/*.jsonl` 全量落盘（回放素材）
- 跨局记忆：每局结束写一条摘要，下局注入 prompt

## 已知待办

- 规则数值：守方流血 `dropped_bleed_per_turn=2` 单独存在修不了「永不 DROP」退化，已配攻方等待计息 `atk_chrono=1` + 失职罚 `never_atk=15`（扫描依据与推荐基准见 `lab/balance_scan.py`）。`atk_chrono=0, never_atk=0` 可复现修参前行为。
- Alembic 迁移、ELO 结算、沙箱执行器随里程碑推进。
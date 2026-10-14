# 丢手绢竞技场（Handkerchief Arena）· 项目说明

> 文档版本 v1.0 · 2026-10-10 · 对应 commit `2da3537`

---

## 1. 项目概述

Handkerchief Arena 是一个面向 AI 代理的在线对战平台，支持两个 AI 玩家在「丢手绢」博弈中进行策略对抗。
平台接受代码策略、大语言模型（LLM）策略和混合策略三种形态，支持实时观战、回放复盘、排行榜等功能。

设计目标：

| 目标 | 说明 |
|------|------|
| 可扩展 | 支持多种 AI 形态（代码、LLM 提示词、混合） |
| 高并发 | 数百局对战同时，匹配延迟 < 1 秒 |
| 可观测 | 每局对战全量事件流，支持回放与审计 |
| 安全性 | 用户代码沙箱隔离，网络禁用，资源受限 |
| 公平性 | 统一规则引擎，随机种子公开，结果可复现 |

---

## 2. 游戏核心规则

每局最多 10 轮，每轮最多 10 回合。每轮一名攻方、一名守方，轮结束交换身份。初始 HP 各 50，先归零者输。

**攻方动作**：
- `DROP` — 丢下手绢。手绢一旦落地，守方每回合流血 -2 HP。
- `WAIT` — 不丢，等待。

**守方动作**：
- `CHECK` — 回头检查。命中（手绢已落地）：守方 +5 HP，攻方 -10 HP；落空：守方 -(10 + 当前回合数) HP。
- `WAIT` — 不检查。

**轮结束**：第 10 回合强制检查；或守方主动 CHECK。

**信息隐藏**：守方看不到手绢是否已落地，只能靠攻方行为和历史推理。

> **设计注**：流血机制（`dropped_bleed_per_turn=2`）是对「永不 DROP」退化博弈的修正。数值暂定，待实测调平。

---

## 3. 系统架构

```
┌─────────────────────────────────────────────────┐
│                 前端 (web/)                     │
│  React + Vite + TS · 观战页 WebSocket 实时渲染   │
└───────────────────────┬─────────────────────────┘
                        │ HTTP / WS
┌───────────────────────▼─────────────────────────┐
│          Match Service (services/match/)        │
│  REST 起局 + WebSocket 事件流                    │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│            Runtime (runtime/)                   │
│  LLM Agent · 上下文管理 · 事件总线 · 对局驱动    │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│            Engine (engine/)                     │
│  规则引擎（纯逻辑、确定性、种子可复现）            │
└───────────────────────┬─────────────────────────┘
                        │
              DeepSeek API (OpenAI 兼容)
```

### 3.1 规则引擎（engine/）

纯 Python 包，无外部依赖，无状态，确定性。

- `HandkerchiefEngine` — 单回合结算（`resolve_turn`）。
- `MatchRunner`（runtime/ 中） — 轮/回合/角色轮换驱动，双方决策并行。
- 配置项：`max_turns_per_round`、`miss_penalty`、`hit_defender_gain`、`hit_attacker_loss`、`dropped_bleed_per_turn`。

### 3.2 Agent 运行时（runtime/）

- **LLMAgent** — OpenAI 兼容客户端（base_url 可换任意厂商），system prompt 即策略，user message 是当前状态 JSON + 局内历史。
- **ScriptedAgent** — 离线/测试用确定性 agent。
- **上下文管理**：
  - 局内（`MatchContext`）：最近 3 轮明细 + 更早轮次一行摘要，防 token 膨胀。
  - 跨局（`CrossMatchMemory`）：每局一条摘要，持久化到 `memories/*.json`，下局注入 prompt。
- **动作解析**（`parse_action`）：正则提取末尾合法 token，非法输出降级 WAIT。
- **事件总线**（`EventBus`）：`MATCH_START / ROUND_START / TURN_END / ROUND_END / MATCH_END`。
  - 订阅者：控制台打印、`JsonlSink`（`logs/*.jsonl`）、Match Service 的 WS 推送。

### 3.3 后端服务（services/）

| 服务 | 目录 | 职责 |
|------|------|------|
| User Service | `services/user/` | 用户注册/登录/权限（桩） |
| Agent Service | `services/agent/` | 策略 CRUD/版本/校验（桩） |
| Matching Service | `services/matching/` | 匹配队列/房间（桩） |
| **Match Service** | `services/match/` | **已实装**：起局、WS 事件流、状态查询 |
| Shared | `services/shared/` | 配置（`pydantic-settings`）、数据库工厂 |

### 3.4 前端（web/）

React 18 + Vite 5 + TypeScript 5。

| 路由 | 页面 | 状态 |
|------|------|------|
| `/` | 首页 | 占位 |
| `/agents` | 策略管理 | 占位 |
| `/matches` | 对局列表 | 占位 |
| `/watch` | **观战页** | **已实装**：HP 条 + 逐回合实时流 |

Vite 代理：`/api` 和 `/ws` 转发到 `localhost:8100`（Match Service）。

### 3.5 基础设施（infra/）

- `docker-compose.yml`：PostgreSQL 16、Redis 7、MinIO（对象存储）。
- `Dockerfile.service`：参数化 Dockerfile，`ARG SERVICE` 指定服务目录。

---

## 4. 技术栈

| 层 | 技术 |
|----|------|
| 规则引擎 | Python 3.11+，dataclass，enum，asyncio |
| 后端服务 | FastAPI 0.143+，uvicorn[standard]，pydantic v2 |
| LLM 客户端 | openai SDK ≥1.40（AsyncOpenAI，base_url 可换） |
| 前端 | React 18，Vite 5，TypeScript 5，react-router-dom 6 |
| 数据库（待接入） | PostgreSQL 16，asyncpg，SQLAlchemy 2.0+ |
| 缓存/队列（待接入） | Redis 7 |
| 对象存储（待接入） | MinIO |
| CI | GitHub Actions（engine 测试 + services 编译 + web 构建） |

---

## 5. 目录结构

```
play-for-agent/
├── docs/                            # 设计文档（架构、数据库）
│   ├── handkerchief-arena-architecture.md
│   └── handkerchief-arena-architecture.docx
├── engine/                          # 规则引擎
│   ├── pyproject.toml
│   ├── src/handkerchief_engine/
│   └── tests/
├── runtime/                         # Agent 运行时
│   ├── pyproject.toml
│   ├── src/handkerchief_runtime/
│   │   ├── agents.py                # LLMAgent + ScriptedAgent
│   │   ├── context.py               # MatchContext + CrossMatchMemory
│   │   ├── env.py                   # .env 加载器
│   │   ├── events.py                # EventBus + JsonlSink + console_printer
│   │   ├── parser.py                # 动作解析
│   │   └── runner.py                # MatchRunner（轮/回合/角色驱动）
│   └── tests/
├── services/
│   ├── match/app/main.py            # Match Service（REST + WS）
│   ├── user/app/main.py             # User Service（桩）
│   ├── agent/app/main.py            # Agent Service（桩）
│   ├── matching/app/main.py         # Matching Service（桩）
│   ├── shared/                      # 共享配置/数据库工厂
│   ├── requirements.txt
│   └── Dockerfile.service
├── web/                             # 前端
│   ├── src/
│   │   ├── App.tsx                  # 路由
│   │   ├── pages/Watch.tsx          # 观战页（HP 条 + 事件流）
│   │   └── ...
│   ├── vite.config.ts               # 代理 /api + /ws → :8100
│   └── package.json
├── strategies/                      # 示例策略提示词
│   ├── patient_dropper.txt
│   └── aggressive_checker.txt
├── demo/run_match.py                # CLI 演示
├── infra/
│   ├── docker-compose.yml
│   └── Dockerfile.service
├── scripts/
│   └── latency.py                   # 延迟统计脚本
├── .github/workflows/ci.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 6. 快速启动

### 6.1 离线 Demo（无需 API key）

```bash
cd D:\Desktop\CODEX-d4
pip install -e engine runtime
python demo/run_match.py --mock --rounds 10
```

输出：逐回合控制台打印 + `logs/match-*.jsonl` 全量事件流 + `memories/*.json` 跨局记忆。

### 6.2 接入 DeepSeek

```bash
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
python demo/run_match.py --rounds 10
```

### 6.3 服务模式 + 观战页

```bash
# 终端 1：Match Service
pip install -r services/requirements.txt
python -m uvicorn app.main:app --app-dir services/match --port 8100

# 终端 2：前端 dev server
cd web && npm install && npm run dev
# 打开 http://localhost:5174/watch（5173 若被占用则自动退到 5174）
```

页面上两个按钮：「开始对局（LLM）」和「开始对局（离线 mock）」。点完看血条一格一格掉。

---

## 7. API 接口

### 7.1 REST

#### POST `/api/v1/matches` — 起一局

```json
{
  "agent_a": { "name": "A-忍耐型", "system_prompt": null },
  "agent_b": { "name": "B-激进型", "system_prompt": "你是一个……（完整人格配置）" },
  "rounds": 10,
  "mock": false
}
```

响应：

```json
{ "code": 200, "message": "ok", "data": { "match_id": "a1b2c3d4", "status": "running" } }
```

`system_prompt` 缺省时，服务从 `strategies/*.txt` 读取占位文件。`mock:true` 走离线脚本 agent，不调 LLM。

#### GET `/api/v1/matches/{id}` — 查状态

```json
{ "code": 200, "data": { "match_id": "a1b2c3d4", "status": "finished", "events": 38, "result": { ... } } }
```

#### GET `/health`

```json
{ "status": "ok", "service": "match" }
```

### 7.2 WebSocket

#### `/ws/matches/{match_id}` — 实时事件流

连接后先补发历史回放（`_seq` 去重），再 live 推送。对局结束发 `RESULT` 事件。

事件类型：

| type | payload 字段 |
|------|-------------|
| `MATCH_START` | `agent_a`, `agent_b`, `attacker_first` |
| `ROUND_START` | `round`, `attacker`, `defender`, `attacker_hp`, `defender_hp` |
| `TURN_END` | `round`, `turn`, `attacker_action`, `defender_action`, `result`, `attacker_hp`, `defender_hp`, `bleed` |
| `ROUND_END` | `round`, `result`, `reason`（`hp_zero` 或 null） |
| `MATCH_END` | `winner`, `finish_reason`, `total_rounds`, `total_turns`, `final_hp` |
| `RESULT` | 完整 match result |

---

## 8. 策略与人格配置

当前 `strategies/*.txt` 是占位文件，内含游戏机制相关的行动指令（如「作为攻方你倾向于第几回合丢」）。
**设计原则**：策略提示词应是完整人格配置（「你是谁、你怎么看待欺骗和耐心」），让模型从人格推出打法，而非直接指定动作。

Match Service 的 `system_prompt` 字段已支持传入完整人格配置。待设计完成后直接塞入 body 即可生效。

---

## 9. 当前状态与待办

### 已完成

- [x] 规则引擎（附录 A 回合结算 + 流血机制修正）
- [x] LLM Agent 运行时（DeepSeek 接入、上下文管理、事件流、对局驱动）
- [x] 跨局记忆持久化（`memories/*.json`）
- [x] Match Service（REST 起局 + WebSocket 实时事件流）
- [x] 前端观战页（HP 条 + 逐回合实时渲染）
- [x] CI（engine 测试 + services 编译 + web 构建）

### 待办

- [ ] 人格提示词设计（替换 `strategies/*.txt` 占位文件）
- [ ] User Service 实装（注册/登录/JWT）
- [ ] Agent Service 实装（策略 CRUD/版本/校验）
- [ ] Matching Service 实装（ELO 匹配队列）
- [ ] 对局状态持久化（Redis + PostgreSQL）
- [ ] ELO 排行榜与结算服务
- [ ] 沙箱执行器（代码策略隔离运行）
- [ ] 回放服务（基于 `logs/*.jsonl` 生成可视化）
- [ ] 锦标赛系统

---

## 10. 开发与贡献

### 本地测试

```bash
# 引擎 + 运行时测试
pip install -e "engine[dev]" -e "runtime[dev]"
PYTHONPATH="engine/src:runtime/src" pytest engine/tests runtime/tests -q

# 前端类型检查 + 构建
cd web && pnpm run build

# 服务编译检查
python -m compileall services
```

### 延迟统计

```bash
python scripts/latency.py
# 输出：turns=22 avg=807ms max=1125ms
```

### 提交规范

- `feat:` 新功能
- `fix:` 修复
- `refactor:` 重构
- `docs:` 文档
- `chore:` 杂项

---

*本文档与代码同步更新。最新状态见 `git log`。*

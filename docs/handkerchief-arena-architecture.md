# 《丢手绢竞技场》（Handkerchief Arena）平台架构与数据库设计

## 版本信息

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 编写日期 | 2026-10-09 |
| 作者 | Codex Assistant |
| 状态 | 初稿 |

---

## 目录

1. [项目概述](#1-项目概述)
2. [术语表](#2-术语表)
3. [总体架构](#3-总体架构)
4. [服务层设计](#4-服务层设计)
5. [数据库设计](#5-数据库设计)
6. [API 接口规范](#6-api-接口规范)
7. [核心业务流程](#7-核心业务流程)
8. [安全与风控](#8-安全与风控)
9. [部署与运维](#9-部署与运维)
10. [开发计划与里程碑](#10-开发计划与里程碑)

---

## 1. 项目概述

### 1.1 项目背景

《丢手绢竞技场》（Handkerchief Arena）是一个面向 AI 代理的在线对战平台，支持两个 AI 玩家在"丢手绢"游戏中进行策略对抗。平台提供策略提交、自动匹配、实时对战、回放复盘、排行榜等功能。

### 1.2 设计目标

| 目标 | 说明 |
|------|------|
| **可扩展** | 支持多种 AI 形态（代码策略、LLM 提示词、混合策略）。 |
| **高并发** | 支持数百局对战同时进行，匹配延迟 < 1 秒。 |
| **可观测** | 完整记录每局对战的决策与状态，支持回放与审计。 |
| **安全性** | 用户提交的 AI 代码在隔离沙箱中运行，禁止危险操作。 |
| **公平性** | 统一规则引擎，随机种子公开，结果可复现。 |

### 1.3 核心数据规模预估

| 指标 | 预估 |
|------|------|
| 日活跃用户（DAU） | 1,000 ~ 10,000 |
| 同时在线对战 | 500 ~ 2,000 |
| 每日对局数 | 50,000 ~ 200,000 |
| 单局数据量 | 5 ~ 20 KB |
| 数据 retention | 最近 90 天热数据，长期归档 |

---

## 2. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 对局 | Match | 两个 AI 玩家之间的一完整场游戏，直到一方 HP ≤ 0。 |
| 轮 | Round | 每局游戏中的攻防阶段，包含 10 个回合。 |
| 回合 | Turn | 轮内的单次决策，双方同时选择动作。 |
| 攻方 | Attacker / Dropper | 负责决定是否"丢下手绢"的玩家。 |
| 守方 | Defender / Checker | 负责决定是否"检查"的玩家。 |
| 策略 | Strategy / Agent | 用户提交的 AI 决策逻辑。 |
| 智能体 | Agent | 绑定到具体策略的可参赛实体。 |
| 房间 | Room | 一次对战在系统中的逻辑容器。 |
| 沙箱 | Sandbox | 隔离执行用户代码的运行环境。 |

---

## 3. 总体架构

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           客户端层 (Client Layer)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Web 门户   │  │  观战页面    │  │  管理后台    │  │  Open API   │ │
│  │   (React)   │  │   (React)   │  │   (React)   │  │  (REST/WS)  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
└─────────┼────────────────┼────────────────┼────────────────┼────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │   API Gateway     │
                          │  (Kong / Nginx)   │
                          └─────────┬─────────┘
                                    │
┌───────────────────────────────────┼───────────────────────────────────┐
│                         服务层 (Service Layer)                        │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   用户服务    │  │   策略服务    │  │   匹配服务    │  │  对战服务  │ │
│  │  User Svc    │  │  Agent Svc   │  │ Matching Svc │  │ Match Svc  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │                │       │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐  ┌─────┴─────┐ │
│  │   排行榜服务  │  │   回放服务    │  │   通知服务    │  │  结算服务  │ │
│  │ Ranking Svc  │  │  Replay Svc  │  │ Notify Svc   │  │ Settle Svc │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                     消息总线 (Message Bus)                      │  │
│  │              Apache Kafka / RabbitMQ / Redis Stream             │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼───────────────────────────────────┐
│                         执行层 (Execution Layer)                      │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   代码沙箱池     │    │   LLM 网关      │    │   规则引擎      │  │
│  │ (Docker/gVisor) │    │ (OpenAI/Claude) │    │  (Python Core)  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼───────────────────────────────────┐
│                         数据层 (Data Layer)                           │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  PostgreSQL  │  │    Redis     │  │   MinIO/S3   │  │ ClickHouse│ │
│  │  (主数据库)   │  │  (缓存/会话)  │  │  (对象存储)   │  │ (日志分析) │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 架构原则

1. **无状态服务**：对战服务、匹配服务、用户服务均设计为无状态，便于水平扩展。
2. **事件驱动**：对战状态变更通过消息总线异步通知相关服务（排行榜、回放、通知）。
3. **读写分离**：核心状态写入 PostgreSQL，排行榜、日志分析使用 ClickHouse 或 Redis。
4. **沙箱隔离**：用户代码在独立容器中执行，与主服务网络隔离。

---

## 4. 服务层设计

### 4.1 用户服务（User Service）

**职责**：用户注册、登录、个人信息、权限管理。

**核心接口**：
- `POST /api/v1/users/register`
- `POST /api/v1/users/login`
- `GET /api/v1/users/me`
- `PUT /api/v1/users/me`

### 4.2 策略服务（Agent Service）

**职责**：AI 策略的 CRUD、版本管理、编译/校验、上线/下线。

**支持的策略形态**：

| 形态 | 说明 | 执行方式 |
|------|------|---------|
| `CODE_PYTHON` | Python 代码策略 | 沙箱执行 |
| `CODE_JAVASCRIPT` | JavaScript 代码策略 | 沙箱执行 |
| `LLM_PROMPT` | 基于大语言模型的提示词策略 | 统一 LLM 网关调用 |
| `HYBRID` | 代码 + LLM 混合策略 | 分阶段执行 |

**核心接口**：
- `POST /api/v1/agents`：创建策略
- `PUT /api/v1/agents/{id}`：更新策略
- `POST /api/v1/agents/{id}/validate`：校验策略
- `POST /api/v1/agents/{id}/activate`：激活策略参赛
- `GET /api/v1/agents/{id}/versions`：查看版本历史

### 4.3 匹配服务（Matching Service）

**职责**：为等待中的 Agent 寻找对手，支持多种匹配模式。

**匹配模式**：

| 模式 | 说明 |
|------|------|
| `RANKED` | 天梯匹配，基于 ELO 分数匹配实力相近的对手。 |
| `CASUAL` | 休闲匹配，随机或就近匹配。 |
| `FRIENDLY` | 好友对战，通过房间号邀请。 |
| `TOURNAMENT` | 锦标赛匹配，由赛事服务调度。 |

**核心接口**：
- `POST /api/v1/matching/join`：加入匹配队列
- `POST /api/v1/matching/cancel`：取消匹配
- `POST /api/v1/matching/rooms`：创建好友房间

### 4.4 对战服务（Match Service）

**职责**：
- 创建对战房间
- 驱动回合进行
- 调用执行层获取双方动作
- 调用规则引擎结算
- 管理对战生命周期
- 通过 WebSocket 推送实时状态

**核心接口**：
- `POST /api/v1/matches`：创建对战
- `GET /api/v1/matches/{id}`：查询对战状态
- `WS /ws/matches/{id}`：实时观战

### 4.5 结算服务（Settlement Service）

**职责**：
- 根据规则引擎输出更新玩家血量
- 判断胜负
- 计算 ELO 变化
- 触发放榜和奖励

### 4.6 排行榜服务（Ranking Service）

**职责**：
- 维护全局排行榜
- 按模式、时间段、策略类型分类排行
- 提供玩家/Agent 统计信息

### 4.7 回放服务（Replay Service）

**职责**：
- 根据对战日志生成结构化回放数据
- 支持前端渲染时间轴、血量曲线、关键事件
- 提供回放文件下载

### 4.8 通知服务（Notification Service）

**职责**：
- 对战开始/结束通知
- 排名变化通知
- 系统公告

---

## 5. 数据库设计

### 5.1 ER 图（文本描述）

```
users ||--o{ agents : owns
users ||--o{ matches_player_a : plays
users ||--o{ matches_player_b : plays
agents ||--o{ agent_versions : has
agents ||--o{ match_participants : participates
matches ||--|{ rounds : contains
matches ||--|{ turns : contains
matches ||--|| match_results : has
matches ||--o{ replay_files : generates
leaderboard ||--|| agents : ranks
```

### 5.2 表结构设计

#### 5.2.1 用户表（users）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 用户唯一标识 |
| username | VARCHAR(32) | UNIQUE, NOT NULL | 用户名 |
| email | VARCHAR(255) | UNIQUE | 邮箱 |
| password_hash | VARCHAR(255) | NOT NULL | 密码哈希 |
| avatar_url | VARCHAR(500) | | 头像 URL |
| role | VARCHAR(20) | DEFAULT 'player' | 角色：player / admin |
| status | VARCHAR(20) | DEFAULT 'active' | active / banned / inactive |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |

#### 5.2.2 策略表（agents）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 策略唯一标识 |
| user_id | UUID | FK -> users.id | 所属用户 |
| name | VARCHAR(64) | NOT NULL | 策略名称 |
| description | TEXT | | 策略描述 |
| type | VARCHAR(32) | NOT NULL | CODE_PYTHON / CODE_JAVASCRIPT / LLM_PROMPT / HYBRID |
| active_version_id | UUID | FK -> agent_versions.id | 当前激活版本 |
| status | VARCHAR(20) | DEFAULT 'draft' | draft / active / retired / banned |
| elo_score | INT | DEFAULT 1500 | 当前 ELO 分数 |
| matches_played | INT | DEFAULT 0 | 参赛场次 |
| matches_won | INT | DEFAULT 0 | 获胜场次 |
| matches_lost | INT | DEFAULT 0 | 失败场次 |
| matches_drawn | INT | DEFAULT 0 | 平局场次 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |

#### 5.2.3 策略版本表（agent_versions）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 版本唯一标识 |
| agent_id | UUID | FK -> agents.id | 所属策略 |
| version_number | INT | NOT NULL | 版本号，自增 |
| source_code | TEXT | | 代码内容（代码策略） |
| prompt_text | TEXT | | 提示词内容（LLM 策略） |
| llm_model | VARCHAR(64) | | 指定 LLM 模型 |
| checksum | VARCHAR(64) | NOT NULL | 内容校验和 |
| status | VARCHAR(20) | DEFAULT 'pending' | pending / valid / invalid |
| validation_log | TEXT | | 校验日志 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

#### 5.2.4 对局表（matches）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 对局唯一标识 |
| room_id | VARCHAR(64) | UNIQUE | 房间号 |
| mode | VARCHAR(32) | NOT NULL | ranked / casual / friendly / tournament |
| status | VARCHAR(32) | DEFAULT 'waiting' | waiting / ongoing / finished / aborted |
| player_a_id | UUID | FK -> agents.id | 玩家 A 策略 |
| player_b_id | UUID | FK -> agents.id | 玩家 B 策略 |
| attacker_first | UUID | | 首轮攻方策略 ID |
| current_role_attacker | UUID | | 当前轮攻方策略 ID |
| current_round | INT | DEFAULT 1 | 当前轮次 |
| current_turn | INT | DEFAULT 1 | 当前回合 |
| player_a_hp | INT | DEFAULT 50 | 玩家 A 当前血量 |
| player_b_hp | INT | DEFAULT 50 | 玩家 B 当前血量 |
| handkerchief_dropped | BOOLEAN | DEFAULT FALSE | 当前轮手绢是否已丢下 |
| dropped_turn | INT | | 手绢丢下的回合数 |
| winner_id | UUID | | 获胜方策略 ID |
| finish_reason | VARCHAR(32) | | hp_zero / max_rounds / timeout / abort |
| started_at | TIMESTAMP | | 开始时间 |
| finished_at | TIMESTAMP | | 结束时间 |
| random_seed | VARCHAR(64) | | 随机种子（用于复现） |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

#### 5.2.5 轮次表（rounds）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 轮次唯一标识 |
| match_id | UUID | FK -> matches.id | 所属对局 |
| round_number | INT | NOT NULL | 轮次编号 |
| attacker_id | UUID | FK -> agents.id | 本轮攻方 |
| defender_id | UUID | FK -> agents.id | 本轮守方 |
| start_hp_attacker | INT | NOT NULL | 攻方起始血量 |
| start_hp_defender | INT | NOT NULL | 守方起始血量 |
| end_hp_attacker | INT | | 攻方结束血量 |
| end_hp_defender | INT | | 守方结束血量 |
| dropped_turn | INT | | 手绢丢下的回合 |
| checked_turn | INT | | 守方检查的回合 |
| result | VARCHAR(32) | | hit / miss / timeout / forced_check |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

#### 5.2.6 回合表（turns）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 回合唯一标识 |
| match_id | UUID | FK -> matches.id | 所属对局 |
| round_number | INT | NOT NULL | 所属轮次 |
| turn_number | INT | NOT NULL | 回合编号（1-10） |
| attacker_action | VARCHAR(16) | | DROP / WAIT |
| defender_action | VARCHAR(16) | | CHECK / WAIT |
| attacker_hp_before | INT | NOT NULL | 攻方动作前血量 |
| defender_hp_before | INT | NOT NULL | 守方动作前血量 |
| attacker_hp_after | INT | NOT NULL | 攻方动作后血量 |
| defender_hp_after | INT | NOT NULL | 守方动作后血量 |
| handkerchief_dropped_before | BOOLEAN | | 动作前手绢状态 |
| handkerchief_dropped_after | BOOLEAN | | 动作后手绢状态 |
| action_latency_ms | INT | | 双方决策耗时（毫秒） |
| raw_response_a | JSONB | | 玩家 A 原始响应 |
| raw_response_b | JSONB | | 玩家 B 原始响应 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

#### 5.2.7 对局结果表（match_results）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 结果唯一标识 |
| match_id | UUID | FK -> matches.id, UNIQUE | 所属对局 |
| winner_id | UUID | FK -> agents.id | 获胜策略 |
| loser_id | UUID | FK -> agents.id | 失败策略 |
| is_draw | BOOLEAN | DEFAULT FALSE | 是否平局 |
| player_a_elo_before | INT | | A 赛前 ELO |
| player_b_elo_before | INT | | B 赛前 ELO |
| player_a_elo_after | INT | | A 赛后 ELO |
| player_b_elo_after | INT | | B 赛后 ELO |
| total_rounds | INT | | 总轮数 |
| total_turns | INT | | 总回合数 |
| replay_url | VARCHAR(500) | | 回放文件 URL |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

#### 5.2.8 排行榜表（leaderboard）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 记录唯一标识 |
| agent_id | UUID | FK -> agents.id | 策略 ID |
| mode | VARCHAR(32) | NOT NULL | 模式 |
| period | VARCHAR(32) | NOT NULL | 周期：daily / weekly / monthly / all_time |
| elo_score | INT | NOT NULL | ELO 分数 |
| rank | INT | NOT NULL | 排名 |
| wins | INT | DEFAULT 0 | 胜场 |
| losses | INT | DEFAULT 0 | 负场 |
| draws | INT | DEFAULT 0 | 平局 |
| win_rate | DECIMAL(5,4) | | 胜率 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |

### 5.3 索引设计

| 表 | 索引字段 | 类型 | 说明 |
|----|---------|------|------|
| users | username | UNIQUE | 用户名唯一 |
| users | email | UNIQUE | 邮箱唯一 |
| agents | (user_id, status) | B-tree | 按用户查询策略 |
| agents | elo_score | B-tree | 排行榜排序 |
| matches | (status, mode) | B-tree | 查询进行中的对局 |
| matches | player_a_id | B-tree | 查询玩家 A 的对局 |
| matches | player_b_id | B-tree | 查询玩家 B 的对局 |
| rounds | (match_id, round_number) | B-tree | 按对局查轮次 |
| turns | (match_id, round_number, turn_number) | B-tree | 按对局查回合 |
| match_results | winner_id | B-tree | 按获胜者查询 |
| leaderboard | (mode, period, rank) | B-tree | 排行榜查询 |

### 5.4 分区与归档策略

- `turns` 表数据量最大，建议按 `created_at` 月度分区。
- `matches`、`rounds` 同样按时间分区。
- 超过 90 天的冷数据迁移至对象存储（Parquet 格式），用于审计和复盘。

---

## 6. API 接口规范

### 6.1 REST API 通用约定

- 基础路径：`/api/v1`
- 认证方式：Bearer Token（JWT）
- 响应格式：

```json
{
  "code": 200,
  "message": "ok",
  "data": { }
}
```

### 6.2 用户接口

#### 注册
```http
POST /api/v1/users/register
Content-Type: application/json

{
  "username": "alice",
  "email": "alice@example.com",
  "password": "secure_password"
}
```

#### 登录
```http
POST /api/v1/users/login
Content-Type: application/json

{
  "username": "alice",
  "password": "secure_password"
}
```

### 6.3 策略接口

#### 创建策略
```http
POST /api/v1/agents
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "PatientDropper",
  "description": "耐心等待， late drop",
  "type": "CODE_PYTHON",
  "source_code": "def decide(state): ..."
}
```

#### 激活策略
```http
POST /api/v1/agents/{agent_id}/activate
Authorization: Bearer <token>
```

### 6.4 匹配接口

#### 加入匹配队列
```http
POST /api/v1/matching/join
Authorization: Bearer <token>
Content-Type: application/json

{
  "agent_id": "uuid",
  "mode": "ranked"
}
```

#### 取消匹配
```http
POST /api/v1/matching/cancel
Authorization: Bearer <token>
```

### 6.5 对局接口

#### 查询对局
```http
GET /api/v1/matches/{match_id}
Authorization: Bearer <token>
```

#### 查询对局历史
```http
GET /api/v1/matches?agent_id={agent_id}&limit=20&offset=0
Authorization: Bearer <token>
```

### 6.6 WebSocket 接口

#### 实时观战
```
WS /ws/matches/{match_id}?token=<jwt>
```

消息示例：

```json
{
  "type": "TURN_END",
  "payload": {
    "match_id": "uuid",
    "round": 3,
    "turn": 5,
    "attacker_action": "DROP",
    "defender_action": "WAIT",
    "player_a_hp": 38,
    "player_b_hp": 42
  }
}
```

---

## 7. 核心业务流程

### 7.1 对战生命周期

```
[匹配成功]
    │
    ▼
[创建 Match 记录] ──▶ 分配 room_id、随机种子、首轮攻方
    │
    ▼
[创建 Round 记录]
    │
    ▼
[循环每回合]
    │
    ├──▶ 向双方 Agent 发送 state
    │
    ├──▶ 收集动作（超时则默认 WAIT）
    │
    ├──▶ 调用规则引擎结算
    │
    ├──▶ 更新 Match / Round / Turn 记录
    │
    ├──▶ WebSocket 广播状态
    │
    └──▶ 若 CHECK 或第 10 回合，结束本轮，交换攻守
    │
    ▼
[检查胜负]
    │
    ├──▶ HP ≤ 0：结束对局，计算 ELO，生成回放
    │
    └──▶ 否则：进入下一轮
```

### 7.2 匹配流程

```
[用户提交 agent_id + mode]
    │
    ▼
[写入 Redis 匹配队列（按 mode + elo 分段）]
    │
    ▼
[匹配服务轮询队列]
    │
    ├──▶ 找到 ELO 差距在阈值内的对手
    │
    ├──▶ 创建对战房间
    │
    └──▶ 通知双方对战开始
```

### 7.3 Agent 决策调用流程

```
[对战服务]
    │
    ├──▶ 代码策略 ──▶ 调用沙箱执行器 ──▶ 返回 DROP/WAIT 或 CHECK/WAIT
    │
    └──▶ LLM 策略 ──▶ 调用 LLM 网关 ──▶ 解析并返回动作
```

### 7.4 结算流程

```
[规则引擎输出]
    │
    ▼
[更新 Match 血量]
    │
    ▼
[判断 HP ≤ 0 或达到最大轮数]
    │
    ▼
[调用 ELO 计算]
    │
    ▼
[写入 match_results]
    │
    ▼
[异步更新 leaderboard + 生成 replay]
```

---

## 8. 安全与风控

### 8.1 沙箱安全

| 限制项 | 说明 |
|--------|------|
| 运行时间 | 单次决策 ≤ 2 秒 |
| CPU | 限制为 0.5 核 |
| 内存 | 限制为 128 MB |
| 网络 | 完全禁止 |
| 文件系统 | 只读，禁止写入 |
| 系统调用 | 使用 seccomp 过滤危险调用 |
| 执行环境 | Docker / gVisor / Firecracker |

### 8.2 LLM 安全

- 提示词注入防护：对用户提交的 prompt 做模板校验，禁止特殊越狱指令。
- Token 限制：单次调用限制输入 + 输出 token 数。
- 输出解析：严格限制输出为 `DROP`/`WAIT`/`CHECK` 之一，否则视为 `WAIT`。

### 8.3 反作弊

- 随机种子公开，结果可复现。
- 记录每步动作和原始响应，便于审计。
- 检测异常模式：如固定序列动作、超快响应等。
- 用户策略版本冻结，对局期间不可修改。

---

## 9. 部署与运维

### 9.1 部署架构

```
┌─────────────────────────────────────────────┐
│                 CDN / WAF                    │
└─────────────────────────────────────────────┘
                    │
┌───────────────────┼───────────────────┐
│              Load Balancer              │
└───────────────────┼───────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   [API Server] [API Server] [API Server]
        │           │           │
        └───────────┼───────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   [Match Svc] [Match Svc] [Match Svc]
        │           │           │
        └───────────┼───────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   [Worker]     [Worker]    [Worker]
   (Sandbox)   (Sandbox)   (Sandbox)
        │           │           │
        └───────────┴───────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   PostgreSQL   Redis      MinIO/S3
```

### 9.2 监控与日志

| 组件 | 工具 | 监控项 |
|------|------|--------|
| 服务健康 | Prometheus + Grafana | QPS、延迟、错误率 |
| 日志 | ELK / Loki | 接口日志、对局日志 |
| 链路追踪 | Jaeger | 请求链路 |
| 告警 | PagerDuty / 钉钉 | 异常告警 |

### 9.3 备份策略

- PostgreSQL：每日全量备份 + WAL 增量备份。
- Redis：AOF 持久化 + 定期 RDB 快照。
- 对象存储：跨区冗余备份。

---

## 10. 开发计划与里程碑

### Phase 1：MVP（4-6 周）

| 周 | 任务 |
|----|------|
| 1 | 完成规则引擎与对战核心逻辑 |
| 2 | 完成用户、策略、匹配服务 |
| 3 | 完成对战服务与 WebSocket 实时推送 |
| 4 | 完成代码沙箱执行器 |
| 5 | 完成前端 Web 门户与观战页 |
| 6 | 集成测试、性能压测、Bug 修复 |

### Phase 2：LLM 与排行榜（3-4 周）

| 周 | 任务 |
|----|------|
| 7 | 接入 LLM 网关，支持提示词策略 |
| 8 | 实现 ELO 排行榜与统计 |
| 9 | 实现回放服务与可视化 |
| 10 | 安全加固与风控上线 |

### Phase 3：锦标赛与生态（4-6 周）

| 周 | 任务 |
|----|------|
| 11-12 | 锦标赛系统 |
| 13-14 | Open API 与第三方接入 |
| 15-16 | 社区功能、文档、运营工具 |

---

## 附录 A：规则引擎核心伪代码

```python
class HandkerchiefEngine:
    def __init__(self):
        self.max_turns_per_round = 10
        self.miss_penalty = 10
        self.hit_defender_gain = 5
        self.hit_attacker_loss = 10

    def resolve_turn(self, state, attacker_action, defender_action):
        hp_a, hp_d = state.attacker_hp, state.defender_hp
        dropped = state.handkerchief_dropped

        if attacker_action == "DROP":
            dropped = True

        if defender_action == "CHECK":
            k = state.turn_number  # 已等待回合数
            if dropped:
                # 守方命中
                hp_d += self.hit_defender_gain
                hp_a -= self.hit_attacker_loss
                result = "HIT"
            else:
                # 守方误判
                hp_d -= (self.miss_penalty + k)
                result = "MISS"
            round_end = True
        else:
            result = "CONTINUE"
            round_end = False

        # 第 10 回合强制检查
        if state.turn_number >= self.max_turns_per_round and not round_end:
            k = state.turn_number
            if dropped:
                hp_d += self.hit_defender_gain
                hp_a -= self.hit_attacker_loss
                result = "FORCED_HIT"
            else:
                hp_d -= (self.miss_penalty + k)
                result = "FORCED_MISS"
            round_end = True

        return {
            "hp_attacker": max(0, hp_a),
            "hp_defender": max(0, hp_d),
            "handkerchief_dropped": dropped,
            "result": result,
            "round_end": round_end
        }
```

---

## 附录 B：Agent 输入 State 结构

```json
{
  "match_id": "uuid",
  "round": 3,
  "turn": 5,
  "role": "attacker",
  "my_hp": 45,
  "opponent_hp": 38,
  "max_turns_per_round": 10,
  "handkerchief_dropped": false,
  "history": [
    {
      "round": 1,
      "turn": 7,
      "my_action": "DROP",
      "opponent_action": "CHECK",
      "my_hp_before": 50,
      "my_hp_after": 40,
      "opponent_hp_before": 50,
      "opponent_hp_after": 55
    }
  ]
}
```

---

*文档结束*

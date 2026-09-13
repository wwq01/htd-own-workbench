# V2-1 本地 Agent 通道 · 技术方案

> 状态：**已交付 2026-09-13**（后端 5 层 + JobRunner + Skills 注册表 + 4 个参考技能 + 前端 Agent 收件箱页面）
> 形态：Node/Express 托管的本地 Agent，**不调用任何外部大模型**，全部在用户本机对本地数据做确定性处理。

## 1. 定位与边界

路线图对 V2-1 的占位只有一行：`本地 Agent 通道（agent-inbox + Skills + JobRunner，后端零骨架）— 未启动`。
本项目是「个人工作生活一体化 + 知识沉淀平台」，本地优先、数据自主是核心底线。因此 V2-1 的 Agent 定位为：

- **本地确定性 Agent**：接收自然语言/结构化指令，匹配一个「技能（Skill）」，在本机对本地 SQLite 数据执行确定性逻辑，产出结构化结果。
- **不联网、不调外部 LLM**：避免把私人数据送出本机，也避免引入不可控的外部依赖。技能是「可审计的纯函数 + 本地数据读取」。
- **收件箱（agent-inbox）**：所有任务持久化，可回溯、可重跑，状态机可见。

这与「第二大脑」的演进方向一致：先把"本地自动化流水线"跑通，未来接 LLM 时只需新增一类 Skill，架构不动。

## 2. 架构

```
前端 AgentPage（收件箱 UI）
      │  /api/v1/agent/*
      ▼
agent.router.js → agent.controller.js → agent.service.js
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                                ▼
                       job-runner.js                    skills/index.js（注册表）
                  （状态机：pending→running→                  │
                   succeeded/failed）               4 个参考技能（纯函数+本地读）
                              │                                │
                              ▼                                ▼
                       agent.repository.js ◄── prisma ──► vault_items / todos / ...（本地库）
```

- **分层**：沿用项目 5 层范式（schema[zod] → repository[BaseRepository] → service → controller → router）。
- **JobRunner**：`runTask(taskId)` 负责完整状态机。MVP 为进程内同步执行（技能均为轻量本地逻辑），结构上预留异步队列扩展点。
- **Skills 注册表**：`registerSkill(skill)` / `getSkill(key)` / `listSkills()` / `matchSkill(prompt)` / `resolveSkill(skillKey, prompt)`。新增能力 = 新建一个 `*.skill.js` 并在 `skills/index.js` 注册，**零侵入**已有代码。

## 3. 数据模型

`AgentTask`（表 `agent_tasks`，沿用项目"DateTime 落 BIGINT"的列约定，由 `build-template-db.mjs` 自动生成）：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String(PK) | cuid |
| title | String | 任务标题（用户填或自动从指令生成） |
| prompt | String | 指令原文 |
| skillKey | String | 指定技能；`auto`=按关键字匹配 |
| status | String | pending / running / succeeded / failed / cancelled |
| result | String? | JSON：`{ skill, output }` |
| error | String? | 失败原因 |
| startedAt / finishedAt / createdAt / updatedAt / deletedAt | DateTime? | 时间线（BIGINT 存储） |

## 4. API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/agent/tasks` | 列表（支持 `?status=&limit=`） |
| POST | `/agent/tasks` | 提交（`{title?, prompt, skillKey?, autoRun?}`；默认自动执行） |
| GET | `/agent/tasks/:id` | 任务详情（result 已反序列化为对象） |
| POST | `/agent/tasks/:id/run` | 重新执行 |
| DELETE | `/agent/tasks/:id` | 软删除 |
| GET | `/agent/skills` | 可用技能清单（前端下拉用） |

所有写入类接口仍受 S4 的 originGuard + accessGuard 约束。

## 5. 参考技能（MVP 4 个，均为本地确定性逻辑）

1. **vault-digest（沉淀库概览）**：统计 Vault 条目数与最近更新标题。关键字：vault/沉淀/笔记/知识库/总结。
2. **todo-extract（指令转待办）**：从指令文本提取行动项（以 `-`/`*`/数字编号或动作动词开头的行）。关键字：todo/待办/任务/提取。
3. **db-health（数据库健康巡检）**：统计各模块数据量并确认本地库可读。关键字：健康/health/数据库/巡检。
4. **generic（通用分析，默认兜底）**：对指令做词数/字符数/建议标签的本地分析，并声明"本地确定性 Agent，不联网"。

## 6. 验收标准

- 后端测试全绿（创建即跑、状态机、技能选择、列表过滤、软删、重跑、未知技能报错、skills 清单）。
- `npm run lint` 全绿；前端 `npm run build` + 运行时模板编译校验通过。
- 活跃库经"先备份再 CREATE TABLE IF NOT EXISTS"最小侵入补表，`/agent/*` 在生产形态可用。

## 7. 后续可扩展（非本次范围）

- 异步队列 + SSE/轮询实时回传执行进度。
- 接本地 LLM（如 ollama）的 Skill 类别，复用同一注册表。
- 技能市场：用户自定义技能（配置化注册）。

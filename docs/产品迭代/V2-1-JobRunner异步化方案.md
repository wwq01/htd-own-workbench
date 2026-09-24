# V2-1 JobRunner 异步化方案

> 日期：2026-09-25
> 状态：**已实现并交付**（2026-09-25，门禁全绿）
> 前置：V2-1 本地 Agent 通道已交付（agent-inbox + Skills 注册表 8 项 + 进程内同步 JobRunner）
> 目标：把「进程内同步执行」升级为「队列调度执行」，补齐并发控制、超时、取消、可观测与崩溃恢复

---

## 1. 背景与要解决的问题

当前 `job-runner.js` 为**进程内同步执行**：`POST /agent/tasks` 创建后立刻 `await skill.run()`，HTTP 请求阻塞到技能跑完。

MVP 阶段技能全是轻量本地 SQL 聚合（毫秒级），同步可接受。但它有五个**结构性缺口**，会随技能变重而暴露：

| # | 问题 | 后果 |
|---|------|------|
| 1 | 无并发上限 | 用户连点提交 → N 个技能并发打 SQLite，单写者模型下有锁竞争风险 |
| 2 | 无超时 | 一个死循环/慢技能会永久挂住 HTTP 请求与后续任务 |
| 3 | 无法取消 | 提交错了只能等它跑完 |
| 4 | 无可观测性 | 看不出队列多长、几个在跑、是否积压 |
| 5 | 崩溃留僵尸 | 进程在 `running` 态被杀 → 该任务永远停在 running，重启后无人回收 |

---

## 2. 目标与非目标

**目标**
- 执行改由**队列调度**（真正的异步执行器），带并发上限与单任务超时。
- 支持**取消**（至少取消尚未开始的排队任务）。
- 暴露**队列状态**（queued / running / 并发上限）。
- 启动时**回收僵尸 running 任务**。

**非目标（明确不做）**
- ❌ 引入 Redis / BullMQ 等外部依赖（违反「离线优先、零依赖」底线）。
- ❌ 多进程 / 分布式任务队列（单机单人工具，无此需求）。
- ❌ 中断**已在执行中**的技能（技能是同步函数，无法安全中断；只能在排队阶段取消，见 §6 限制）。
- ❌ 任务重试/延迟调度/优先级（当前无需求，结构上预留）。

---

## 3. 技术选型对比

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| A. BullMQ + Redis | 功能最全（重试/延迟/优先级/持久化） | **引入外部服务依赖**，违反离线优先底线；单人工具杀鸡用牛刀 | ❌ 排除 |
| B. `setTimeout` fire-and-forget | 改动最小 | 无并发控制、无背压、无超时、不可观测、不可取消 | ❌ 排除 |
| C. **自建进程内内存队列 + 落库状态机** | **零依赖**、离线优先、可控（并发/超时/取消/观测）、状态落库可恢复 | 重启丢失内存队列（靠 §5.5 启动恢复兜底）；不支持多进程 | ✅ **选用** |
| D. 基于文件的持久化队列 | 重启不丢队列 | 需处理文件锁/损坏；SQLite 单写者约束下得不偿失 | ❌ 排除 |

**结论：选 C。** 队列只负责「调度与背压」，任务状态仍以 `agent_tasks` 表为准（单一事实来源），因此内存队列丢失不会造成状态不一致——最多留下 `pending/running` 僵尸，由启动恢复统一回收。

---

## 4. 架构设计

```
POST /agent/tasks (wait=true 默认)
        │
   agentService.create
        │
   job-runner.submitTask(id)  ──►  job-queue.enqueue(fn)
        │                                  │ 并发上限(默认2)
        │                                  │ 单任务超时(默认30s)
        │                                  ▼
        │                          executeTask(id)  ← 原 runTask 的执行体
        │                                  │
        └──── await（wait=true） ◄─────────┘
                     │
              res.success(task)
```

**分层职责**
- `job-queue.js`：**通用**内存队列，与 Agent 业务无关——只管「排队、并发、超时、取消、统计」。可测试、可复用。
- `job-runner.js`：把「调度」与「执行」拆开——`executeTask()` 是纯执行体（原逻辑），`submitTask()` 入队，`runTask()` = 入队 + 等待。
- `agent.service.js`：编排（创建 → 提交 → 是否等待），对外暴露 `cancel()` / `queueStats()`。

---

## 5. 详细设计

### 5.1 job-queue.js（新增，零依赖）

```js
createQueue({ concurrency = 2, timeoutMs = 30000 })
→ { enqueue(id, fn), cancel(id), stats(), }
```

- `enqueue(id, fn)` 返回 `Promise`：任务被调度执行后 resolve/reject；**排队期间不占用调用栈**。
- 并发上限：`running >= concurrency` 时在队列等待；有空位才出队执行。
- 超时：`Promise.race([fn(), timeout])`，超时则 reject 并让出并发位。
- `cancel(id)`：
  - 若仍在排队 → 移出队列，Promise reject（标记为取消），任务置 `cancelled`。
  - 若已在执行 → **返回 false**（无法中断，见 §6）。
- `stats()` → `{ queued, running, concurrency, timeoutMs }`。
- id 唯一性：同一 id 重复入队视为重复提交，直接拒绝（防重跑风暴）。

### 5.2 job-runner.js（改造）

- `executeTask(taskId)`：原 `runTask` 的执行体（`pending→running→succeeded/failed`），**不再直接被 service 调用**。
- `submitTask(taskId)`：入队，返回 promise（不等待）。
- `runTask(taskId)`：`submitTask` + `await`（保持既有同步语义，现有 20 个测试零改动）。

### 5.3 状态机（沿用既有 5 态）

```
pending ──► running ──► succeeded
                │
                ├──────► failed
                └──────► cancelled   （仅排队阶段可到达）
```

取消落库为 `cancelled` 态（schema 枚举已支持，无需改表）。

### 5.4 API 变更（全部向后兼容）

| Method | Path | 变更 | 说明 |
|--------|------|------|------|
| POST | `/agent/tasks` | 新增可选 `wait` | 默认 `true`（等执行完，兼容现有）；`wait:false` 立即返回 `pending`，实现真异步提交 |
| POST | `/agent/tasks/:id/cancel` | **新增** | 取消排队中的任务；已执行的返回明确错误 |
| GET | `/agent/queue` | **新增** | 队列状态 `{queued, running, concurrency, timeoutMs}` |
| 其余 5 个端点 | —— | 不变 | —— |

### 5.5 僵尸回收（启动恢复）

- `recoverStaleTasks()`：把库中所有 `status='running'` 的任务置为 `failed`，`error='进程重启中断执行'`。
- 调用点：`server.js` 启动后（try/catch 包裹，失败不影响启动）。
- 理由：内存队列随进程消亡，`running` 只可能是上一次进程留下的僵尸。

### 5.6 错误码

新增 `AGENT_TASK_CANCELLED`（取消成功语义；注意不是错误码，取消成功是正常响应）。
取消「已在执行」时抛 `AGENT_TASK_CANCELLED` 之外的明确业务错误（复用 `AGENT_RUN_FAILED`? 不合适）→ 新增 `AGENT_TASK_CANCEL_NOT_ALLOWED`。

---

## 6. 已知限制（明确写入，不掩饰）

1. **只能取消排队中的任务**。技能是同步函数，一旦开始执行无法安全中断——取消已 running 任务会返回明确错误，而非静默假装成功。
2. **内存队列不持久化**。进程重启后队列丢失，靠 §5.5 把僵尸 `running` 回收为 `failed`；`pending` 任务不会被自动重跑（需用户手动重跑）。
3. **并发上限默认 2** 是为了保护 SQLite 单写者，不是性能调优结果；技能若变重可调。
4. **超时是软超时**：超时后 Promise reject 并落 `failed`，但同步技能函数本身仍在跑完才释放线程（JS 单线程无法强制终止同步函数）。因此超时主要防「HTTP 永久挂起」，不防 CPU 占用。

---

## 7. 验收标准

| # | 场景 | 期望 |
|---|------|------|
| AC-1 | 并发上限：连续提交 5 个任务（并发=2） | 同时执行 ≤2，其余排队；`GET /queue` 可见 queued>0 |
| AC-2 | 超时：技能执行超过 timeoutMs | 任务落 `failed`，HTTP 不永久挂起 |
| AC-3 | 取消排队任务 | 任务落 `cancelled`，不入执行 |
| AC-4 | 取消已执行任务 | 返回明确错误（不静默） |
| AC-5 | `wait:false` 提交 | 立即返回 `pending` |
| AC-6 | 队列状态 | `GET /agent/queue` 返回 `{queued,running,concurrency,timeoutMs}` |
| AC-7 | 僵尸回收 | 构造 `running` 任务 → `recoverStaleTasks()` → 变 `failed` |
| AC-8 | **回归** | 既有 20 个 agent 单测 + 6 个 HTTP 集成测试全绿（API 语义未变） |

---

## 8. 实施步骤

1. 新增 `job-queue.js`（通用队列，零依赖）+ 单测（并发/超时/取消/去重）。
2. 改造 `job-runner.js` 拆分为 `executeTask` / `submitTask` / `runTask`。
3. `agent.service.js` 增 `cancel()` / `queueStats()` / `wait` 支持。
4. `agent.schema.js` 增 `wait`、`errorCodes` 增新码。
5. `agent.controller.js` + `agent.router.js` 增 `cancel` / `queue` 端点。
6. `server.js` 启动调用 `recoverStaleTasks()`。
7. 补单测 + HTTP 集成测试；前端 `AgentPage` 加取消按钮与队列状态。
8. 门禁全绿（后端/前端/lint/build）+ 提交 + 推送。

---

## 9. 实施结果与偏差说明

方案 8 步全部落地，验收 AC-1~AC-8 全部通过。实施过程中**额外发现并修复了 2 个既有缺陷**（与异步化无关，是 V2-1 首轮交付遗留）：

| # | 缺陷 | 影响 | 修复 |
|---|------|------|------|
| 1 | `ErrorCodes` 枚举**缺少** `AGENT_TASK_NOT_FOUND` 等 4 项，只有 `ErrorMessages` 引用了它们 | `ErrorCodes.AGENT_TASK_NOT_FOUND` 为 `undefined`，Agent 模块错误码全部失效，且 4 条消息在 map 里挤在 `undefined` 键上互相覆盖 | 枚举补齐 4 项 + 新增 `AGENT_TASK_CANCEL_NOT_ALLOWED`，并补对应中文消息 |
| 2 | `AgentPage` 在 `pages.css` 中**零样式**（`.agent-*` 无匹配） | 收件箱页面是裸 HTML，两栏布局/卡片/列表全部未样式化 | 补齐 `.agent-*` 样式（两栏 grid、列表/详情、结果区、队列状态条、窄屏堆叠） |

**新增资产**
- `job-queue.js`：通用进程内队列（并发上限 / 超时 / 取消 / 去重 / 可观测），零依赖，纯逻辑，与业务无关。
- `job-runner.js`：拆分为 `executeTask`（执行体）/ `submitTask`（入队不等）/ `runTask`（入队+等待），新增 `cancelTask` / `recoverStaleTasks` / `queueStats` / `configureQueue` / `resetQueue`。
- 新端点：`POST /agent/tasks/:id/cancel`、`GET /agent/queue`；`POST /agent/tasks` 支持 `wait` 参数。
- 测试：`job-queue.test.js`（10 例，纯逻辑）+ `job-runner.test.js`（7 例，DB）。
- 前端：队列状态条 + 取消按钮（仅 pending 可点，避免让用户点了才报错）。

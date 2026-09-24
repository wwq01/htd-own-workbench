# V2-1 首页三栏卡片 meta 化方案

> 日期：2026-09-25
> 前置：V2-1 本地 Agent 通道已交付；JobRunner 异步化已交付；`registry.js` 已成为模块注册单一数据源
> 目标：**消除首页卡片的手动注册**，让「新增一张首页卡片」只需改一处声明

---

## 1. 背景与痛点

### 1.1 现状

首页是「工作 / 生活 / 知识」三栏 + 底部图表/入口的结构，当前实现是**完全硬编码**：

- `HomePage.js` 模板里手写 **11 张卡片**的 DOM 结构（约 200 行模板）
- `setup()` 里手写 **11 个导航函数** `goTodo() / goProject() / goMeeting() / goSecret() / goStudy() / goReview() / goVault() / goHabit() / goTimeBlock() / goFinance() / goAgent()`
- 每张卡片的数据取值路径、空态文案、跳转目标全部散落在模板里

### 1.2 具体痛点（约束 #7 已记录）

新增/调整一张首页卡片，要在模板里找到对应位置、复制一遍 DOM 结构、再补一个 `goXxx()` 函数、再把它加进 `return {}`，**4 处改动、且无任何机制保证一致**。

具体风险：

1. **导航漂移**：`goXxx()` 里手写的路径字符串（`'/time-block'`）与 `registry.js` 的 `path` 是**两份独立事实**。改路由时若只改 registry，首页按钮就跳到 404——且不会有任何测试失败。
2. **结构复制粘贴**：11 张卡片里 5 张是「数值 + 提示」、3 张是「行列表」，结构高度重复却各写一份，改样式要改 11 处。
3. **无法静态校验**：卡片与模块的对应关系只存在于模板字符串中，门禁脚本无从断言。

本轮第 2 条「新增 Agent 入口」时已经踩到：为了加一张卡，改了 3 处（导航函数 / return / 模板），且入口的路径是手写的。

---

## 2. 目标与非目标

### 目标

| 编号 | 目标 |
|---|---|
| G1 | 首页卡片由单一声明表驱动，模板用 `v-for` 渲染，新增卡片不再改模板 |
| G2 | 卡片的跳转目标引用 `MODULE_META.key`（而非手写路径字符串），路由改动自动同步 |
| G3 | 门禁能静态校验：卡片的 module key 存在、column 合法、type 合法、数据路径合法 |
| G4 | **渲染结果视觉等价**——现有 DOM class、层级、文案、交互逻辑全部保持不变 |

### 非目标（明确不做）

- ❌ **不改后端** `/system/home-summary` 的数据结构（改动面太大，收益不匹配）
- ❌ **不改 CSS**（`home-card*` 系列 class 契约锁死，仅模板消费方式变化）
- ❌ **不做「可拖拽/用户自定义首页」**（属于 V3 个性化范畴，本轮不引入运行时配置持久化）
- ❌ **不把图表区块 meta 化**（4 张图表各自绑定不同组件与数据变换，meta 化收益低于复杂度）

---

## 3. 技术选型

### 方案 A：全量配置化（卡片 JSON + 通用渲染引擎）

把每张卡片声明成纯 JSON（含字段映射、格式化函数），写一个通用渲染引擎。

- ✅ 最彻底，无 JS 逻辑残留
- ❌ 现状卡片有 6 种渲染形态，其中「财务卡」有涨跌色+箭头+收/支明细、「待打卡」有行内按钮与 disabled 逻辑。纯 JSON 表达这些需要引入模板字符串语法与表达式求值，**等于造一门 DSL**，复杂度爆炸

### 方案 B：引入组件库形态（每张卡片一个 SFC 组件）

每张卡片抽成独立组件，首页只 `v-for` + 动态 `<component :is>`。

- ✅ 符合 S2-6 组件化方向
- ❌ 首页卡片是**高度定制化的一次性 UI**（不复用），抽 11 个组件只会把复杂度从 1 个文件搬到 12 个文件；且本轮 S2-6 地基组件不含 Card 变体

### 方案 C：声明表 + 类型分支渲染（**选定**）

- 独立文件 `frontend/js/home-cards.js` 声明 `HOME_COLUMNS` / `HOME_CARDS` / `HOME_FEATURE_CARDS`
- 卡片声明里 `type` 决定渲染形态，模板用 `v-for` + `v-if` 分支渲染 6 种形态
- 声明中允许**少量纯函数**用于行文案格式化（`itemSub`），避免造 DSL
- 跳转目标一律写 `module: 'todo'`（MODULE_META 的 key），运行时查表得 path

**选定理由**：
1. 复杂度可控——只把「重复 11 次的结构」收敛为 6 个分支，不引入 DSL、不拆 12 个文件
2. 可被静态校验——`verify-registry.js` 已用 `eval` 加载前端全局脚本（node 环境），同样的手法可加载 `home-cards.js` 做断言
3. 增量可回退——若某张卡片未来需要高度定制，只需把它从表里移除、在模板里手写一处，不影响其他卡片

---

## 4. 数据契约

### 4.1 后端 `/system/home-summary` 返回结构（本轮不改）

```
{
  generatedAt,
  work: {
    todayProgress: { completed, total, percent },
    tomorrowCount: number,
    activeProjects: [{ id, name, phase, phaseColor, progress }],
    recentMeetings: [{ id, title, heldAt }],
    expiringSecrets: number,
  },
  life: {
    todayHabits: [{ id, name, current, target, kind }],
    maxStreak: number,
    todayTomatoes: { completed, target },
    financeMonth: { income, expense, net, direction: 'up'|'down' },
  },
  knowledge: {
    vaultWeek: { total, draft, precipitated },
    studying: [{ id, title }],
    recommendations: [{ sourceId, title, ... }],
  },
}
```

卡片声明的 `source` 字段即**相对上述结构的点分路径**（如 `work.todayProgress`）。

### 4.2 卡片类型（`type`）

| type | 渲染形态 | 现有卡片 | 数据形状 |
|---|---|---|---|
| `progress` | 进度条 + 百分比 + 「已完成 X / 共 Y」 | 今日任务进度 | `{percent, completed, total}` |
| `stat` | 大数值 + 提示文案 | 明日待安排、连续打卡最长、凭据即将到期 | 标量 / 见下 |
| `count` | 数值 + 静态后缀文案 | 本周沉淀（hint 由同对象多字段拼出） | 对象 + `hintTpl` |
| `ratio` | 数值 + `/ 目标 N` + 提示 | 今日番茄钟 | `{completed, target}` |
| `finance` | 涨跌箭头 + 金额 + 收支明细 | 本月财务净流入 | `{income, expense, net, direction}` |
| `list` | 行列表（可带圆点、副标题、查看全部、行级跳转） | 进行中项目、最近会议纪要、充电学习中 | 数组 |
| `action` | 行列表 + 行内按钮 | 今日待打卡(+1)、推荐待写沉淀(生成) | 数组 |

### 4.3 声明字段

```js
{
  key: 'todo-progress',        // 唯一标识
  column: 'work',              // work | life | knowledge
  title: '今日任务进度',
  type: 'progress',
  module: 'todo',              // 跳转目标（MODULE_META.key）；null = 整卡不可点
  source: 'work.todayProgress',
  viewAll: false,              // 是否显示「查看全部 / 去复盘」右上按钮
  viewAllText: '查看全部',
  empty: '暂无进行中的项目',      // list/action 空态文案
  accent: true,                // 数值是否用强调色
  hint: '条任务已排入明日',       // 静态后缀文案
  // list/action 专用
  itemKey: 'id',
  itemTitle: 'name',
  itemSub: (p) => `${p.phase} · 进度 ${p.progress}%`,  // 纯函数，可选
  itemDot: 'phaseColor',       // 可选：行首圆点取色字段
  detail: true,                // 行点击是否带 ?id= 定位
  action: null,                // 'checkIn' | 'generate'
}
```

---

## 5. 门禁设计（防漂移的关键）

在 `verify-registry.js` 中新增一段（复用其 `eval` 加载手法）：

1. `home-cards.js` 能被 `eval` 加载并挂载 `window.htdHomeCards`
2. 每张卡片的 `column` ∈ `HOME_COLUMNS`
3. 每张卡片的 `type` ∈ 7 种合法类型
4. 每张卡片的 `module`（非 null 时）**必须存在于 `MODULE_META`** ← 消除手写路径漂移的核心断言
5. 卡片 `key` 无重复
6. `source` 路径属于后端契约白名单 `HOME_DATA_PATHS`
7. `entry.js` 引入 `home-cards.js`，且**先于 `HomePage.js`**

---

## 6. 实施步骤

1. 新建 `frontend/js/home-cards.js`（声明表 + `buildHomeCards()` 派生）
2. `entry.js` 在 `registry.js` 之后、`HomePage.js` 之前引入
3. 重写 `HomePage.js` 模板为 meta 驱动（保留图表区块与全部 CSS class）
4. `verify-registry.js` 新增 7 项断言
5. 前端单测：卡片声明合法性 + `getByPath` 安全取值
6. 模板 `@vue/compiler-dom` 编译校验（约定 #13）+ `vite build`
7. 全量门禁 + 提交 + 推送

---

## 7. 验收标准

- [x] 首页渲染结果与改造前**视觉等价**（三栏、11 卡、图表区、Agent 入口均在，22 个模板编译通过）
- [x] `HomePage.js` 中**不再存在**手写路径字符串（门禁断言 `navigate('/xxx')` 字面量为 0）
- [x] 新增一张卡片只需改 `home-cards.js` 一处，模板零改动
- [x] 后端 587 passed/1 skipped、前端 68 passed、lint 87 项（registry 41 + tauri 46）、`vite build` 通过
- [x] 「今日待打卡 +1」与「推荐生成」的交互行为不变

---

## 7.1 实施后补充

**meta 化的收益已兑现**：原本 11 张卡片 + 11 个 `goXxx()` 的模板（约 200 行硬编码结构），
现收敛为 12 张卡片声明 + 6 个渲染分支；`HomePage.js` 中 `home.work.` / `home.life.` /
`home.knowledge.` 的直接数据引用归零（由测试断言锁死，防回退）。

**关键设计支点**：`home-cards.js` 被刻意写成「加载时不依赖任何浏览器 API」的全局脚本，
因此 `verify-registry.js` 可以用 `eval` 在 node 里直接加载它做静态断言。
若当初把声明写在 `HomePage.js` 内部，就无法被门禁校验——这是抽成独立文件的核心理由。

---

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 模板重写破坏视觉 | 全程复用现有 `home-card*` class；改完用 `@vue/compiler-dom` 编译 + build 校验；关键 class 出现次数做成单测断言 |
| 纯函数在 node `eval` 下不可执行 | 门禁**只做存在性/合法性校验，不调用**格式化函数；函数仅在浏览器渲染时执行 |
| `getByPath` 取不到值导致渲染空白 | 安全取值返回 `undefined`，各 type 分支对空值有兜底（空态文案 / 0） |
| 过度抽象导致后续难改 | 非目标里已明确不做图表区 meta 化；卡片可随时从表移除改回手写 |

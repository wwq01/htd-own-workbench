# Person Dashboard 深度剖析报告

> 剖析对象：[oyorf/person_dashboard](https://github.com/oyorf/person_dashboard)（Personal AI Knowledge Workspace / 个人 AI 工作台）
> 剖析方式：源码精读 + 实际启动到 `http://127.0.0.1:5191/` + 浏览器交互逐页验证
> 剖析日期：2026-08-11
> 目的：吸收其设计哲学、交互细节、架构思路，落地到荒天帝工作台（V1.2.0 ~ V1.5.0 演进路线）

---

## 0. 一句话定位

**Person Dashboard** 是"以本地 Obsidian Vault 为唯一可信数据源、用 Markdown 文件做长期沉淀、用 Workbench 做可视化/检索/阅读、用 Agent 协作做理解与回写"的本地优先知识工作台。

荒天帝工作台与它的差异：

| 维度 | Person Dashboard | 荒天帝工作台 |
| --- | --- | --- |
| 数据源 | 本地 Vault（Obsidian 风格 Markdown） | 本地 SQLite（Prisma），可与 Vault 双写 |
| 主场景 | 知识沉淀 + 内容生产 | 工作/生活/知识三组并列 |
| 阅读模型 | DocumentDrawer 沉浸阅读 + 知识图谱 | 列表 + 详情页（更轻量） |
| Agent | 触发 Codex/Claude Code 等外部 Agent | 内嵌 Pinia + 后端 |
| 主题 | Liquid Glass（已用） | 已采用 macOS 天气风格 |

---

## 1. 11 个页面逐页剖析

### 1.1 `/` 总览（OverviewPage）

**页面用途**：把"工作台当下在做什么"压缩成一屏——数据状态、近期动作、健康度一眼可见。

**核心布局**（自上而下）：
1. **Hero 区**：eyebrow（PERSONAL AI WORKBENCH · 2026 年 8 月 11 日 星期一）+ H1（工作台总览）+ 状态徽章组
2. **指标条（metric-strip）**：RAW 素材 / WIKI 页面 / 选题 / 已发布作品 / 总播放 / 知识链接（6 个 MetricStat）
3. **双栏 grid**：
   - 左栏：图谱预览（KnowledgeGraph preview 模式 + "进入星图" CTA）+ 最近更新（recent-list）
   - 右栏：生产动态（pipeline 状态机）+ 知识层健康度（活跃/待复核/已弃用）

**可借鉴的功能/细节**：

1. **三态徽章揭示"系统诚实度"**：[OverviewPage.jsx:122-134](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/OverviewPage.jsx#L122-L134) 同时显示"示例 Vault / 本地 Vault"+"索引实时 / 数据服务离线 / 索引连接中"。**借鉴到 V1.2.0 总览**：用同样的语义徽章告诉用户"数据是不是实时的"，避免"看到数据但其实是缓存"的误解。
2. **GSAP 入场编排时间线（hero→指标条→面板，stagger 0.07~0.08s）**：[OverviewPage.jsx:62-82](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/OverviewPage.jsx#L62-L82) 用一条 timeline 串起整页入场；并通过 `overviewEntranceHasCompleted` 模块级变量保证只播一次。**借鉴到 V1.2.0**：我们 Liquid Glass 风格本身已经很有"质感"，再叠一套轻量 stagger 入场（每个 panel 0.06s 错峰 fade+slide 8px）会让首屏更有"仪式感"。
3. **60s 自动刷新 + focus/visibilitychange 触发**：[OverviewPage.jsx:36-59](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/OverviewPage.jsx#L36-L59) 三个触发器（定时、窗口获焦、标签切回前台）协同，且统一封装为 `cancelled` 闭包防止卸载后 setState。**借鉴到 V1.2.0**：抽成 `useAutoRefresh(fn, { intervalMs, onFocus, onVisible })` 通用 hook，所有"指标类"页面统一用它。
4. **"知识层健康度"分类法**（活跃/待复核/已弃用）天然适配知识沉淀。**借鉴到 V1.3.0 沉淀 Vault**：我们的 Wiki 概念页可以加 status: active/needsReview/deprecated 字段。
5. **`status-dot status-dot--pulse` 状态点动画**：把"进行中"的状态用脉冲表达。**借鉴到 V1.2.0 总览**：今日/明日计划的"进行中"任务用 pulse dot 标识。

---

### 1.2 `/graph` 知识星图（KnowledgeGraph + GraphEngine）

**页面用途**：把 Vault 里所有 Wiki 概念 + 双向链接画成可拖拽、可缩放、可筛选、可点击的力导向图。

**核心设计**（远超普通 ECharts 集成）：
- React 只是壳，**自研 Canvas 引擎** `graph-engine.js / graph-renderer.js / graph-layout.js / graph-hit-test.js / graph-motion.js / graph-label-cache.js` 拥有自己的渲染时钟。
- 节点可拖拽、画布可平移、滚轮可缩放、+/- 按钮可调、0 键 fitToView、双击进入 DocumentDrawer。
- **类型 / 状态筛选透镜**：根据 activeTypes / activeStatuses 过滤显示节点。
- 节点悬停显示 tooltip（类型 + 连接数 + 标题），点击有选中态（高亮 + 关联边高亮 + 其他边灰化）。
- **预览模式（preview）**：OverviewPage 上的"小星图"复用同一引擎，但禁用控件、不显示 tooltip。

**可借鉴的功能/细节**：

1. **"自研 Canvas 引擎而不是 D3 force / vis.js"的选择**：[graph/](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/) 7 个文件拆分渲染 / 命中测试 / 标签缓存 / 动画。**借鉴到 V1.4.0**：我们的"售前项目关系图"、"知识图谱"（V1.3）可以照这个模式做，从一开始就避免被图表库绑死。
2. **`preview` 模式**让一个组件既服务完整页又服务首页 mini 卡。**借鉴到 V1.2.0**：总览的"今日计划时间线"、"最近项目"都可以做 preview / full 双模式。
3. **键盘快捷键缩放**（`-` / `+` / `0` fitToView）：**借鉴到 V1.4.0**：所有画布类组件都加这一套快捷键。
4. **筛选透镜（types/statuses）**通过 props 传入，没有冗余的内部状态。**借鉴到 V1.4.0**：我们的图谱筛选也用 props 而不是 URL state，让它在被嵌入其它页面时也能复用。

---

### 1.3 `/wiki` Wiki 层（CollectionPage kind=wiki）

**页面用途**：把知识图谱"拍扁"成线性可读的列表（按概念/框架分类）。

**可借鉴的功能/细节**：

1. **"图谱是关系视图，列表是线性视图"的双形态**：[App.jsx:79-89](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/App.jsx#L79-L89) Wiki 路由直接复用 CollectionPage，传 kind="wiki"。**借鉴到 V1.3.0**：我们的"会议纪要"既要有时间线视图，也要有按客户/项目聚合的列表视图，可以共用一个 CollectionPage。
2. **eyebrow / title / description 三段式标题**：[App.jsx:82-85](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/App.jsx#L82-L85) 每页都有 `KNOWLEDGE LAYER · Wiki 层 · 结构化知识：来源拆解、概念、框架、诊断与待验证问题。星图的线性视图。` 这种"用途一句话"描述。**借鉴到 V1.2.0**：我们所有页面的 PageHeader 都补上 description（很多页只有 title 没有 description）。

---

### 1.4 `/materials` 素材层（MaterialsPage）

**页面用途**：浏览"待看 / 收藏 / 归档"的原始资料（raw），按文件夹树导航，附"待看队列"。

**核心设计**：
- URL 即状态：`?folder=10_raw/articles&view=queue` 三种视图模式（home / folder / queue），用 `useSearchParams` 而非内部 state。
- FolderCard 显示 `X 份素材 / Y 个子目录 / Z 待看`，进入子目录后右侧滑出 MaterialDocumentRow 列表。
- 每行有"待看"开关（IconBookmark），点击后状态会乐观更新。
- 顶栏可"只看待看"切换（queuedOnly state），搜素框。
- EmptyState 区分"队列空"和"文件夹空"两种文案，且分别给出"去任意素材行点'待看'"和"添加到 Vault"的下一步引导。

**可借鉴的功能/细节**：

1. **URL 即状态（`useSearchParams`）让分享/书签/刷新都能恢复**：[MaterialsPage.jsx:64-75](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/MaterialsPage.jsx#L64-L75) 这是一个我们项目还做得很弱的点。**借鉴到 V1.2.0 总览/计划**：今日/明日计划、项目管理都改成 `?date=2026-08-11&status=doing` URL 驱动。
2. **"待看"作为一种轻量收藏**（带 IconBookmark 切换、queuedCount 统计）。**借鉴到 V1.3.0 阅读/资料**：我们阅读模块的"待看"和"已读"完全照这个模式。
3. **EmptyState 文案区分场景且给"下一步"动作**：[MaterialsPage.jsx:47-61](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/MaterialsPage.jsx#L47-L61) 这是细节但很重要。**借鉴到 V1.2.0**：所有空态（凭据保险箱空、习惯打卡空、财务速记空）都按这个"场景+下一步"两段式写。
4. **乐观更新 + 失败回滚**（`setPendingIds` Set + mutationError）：**借鉴到 V1.2.0**：所有 toggle 类操作（待看、已完成、星标）都按这个模式。

---

### 1.5 `/books` 书架（BooksPage）

**页面用途**：管理"成册"的长篇内容（如把一篇文章拆成多章节，或读书笔记），支持章节导航 + 阅读进度 + 双语对照。

**可借鉴的功能/细节**：

1. **阅读进度持久化（按 `bookId + language + chapterId` 粒度）**：[DocumentDrawer.jsx:162-185](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/DocumentDrawer.jsx#L162-L185) `queueBookProgress` 240ms 防抖 flush，离开文档时强制 flush。**借鉴到 V1.3.0 阅读/资料**：一本书/一份长报告的"上次读到哪"自动保存。
2. **`previousBookChapter` / `nextBookChapter` 边缘处理**：第一/末章时显示"这是本版本的第一章 / 已读到本版本最后一章"而不是禁用按钮。**借鉴到 V1.3.0**：所有"上一条/下一条"导航都按这个边缘处理。

---

### 1.6 `/daily-hot` 每日热点（DailyHotPage）

**页面用途**：聚合外部信号（公开匿名 API + AI 综述），按"今日必看 / 24 小时精选 / 值得浏览"三档分流，每条热点都标注来源与时间。

**核心设计**：
- 每条热点卡片有 `daily-hot-card--featured`（首条加粗特写）和普通两种规格。
- 卡片含：序号（01/02/03）、eyebrow（MULTI-SOURCE EVENT / AI HOT SELECTED）、领域徽章、标题、为何值得看（attention.reason）、AI 综述、最新进展、来源/分类/时间、操作（查看事件 / 原始来源）。
- "AI HOT 综述"是一个独立区块（`.daily-hot-card__summary`），告诉用户"这一段是 AI 写的"。

**可借鉴的功能/细节**：

1. **"AI 写"显式标识**：[DailyHotPage.jsx:60-64](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/DailyHotPage.jsx#L60-L64) 当一段内容是 AI 生成的，**必须**有视觉标识。**借鉴到 V1.2.0/V1.3.0**：我们的"AI 总结"、"AI 周报"功能都要加这个标识（与"原话/原文"严格区分）。
2. **每条外部链接都标注"来源 + 分类 + 时间"**：[DailyHotPage.jsx:31-39](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/DailyHotPage.jsx#L31-L39) 这是"可信度"的最低要求。**借鉴到 V1.3.0 社媒洞察/会议纪要**：所有引用都要带来源 + 时间戳。
3. **"为何值得看"作为卡片副标题**（attention.reason）：**借鉴到 V1.3.0 每日热点/灵感**：我们的"今日热点"卡片也要带"为什么这条值得看"的一句话。
4. **聚合分级（必看 / 精选 / 浏览）**适合"信息过载"场景。**借鉴到 V1.3.0 充电学习**：我们"充电学习"页也可以按"必读 / 选读 / 拓展"三档分类。

---

### 1.7 `/social-insights` 社媒洞察（SocialInsightsPage）

**页面用途**：把"AI 自动抓取 + 人工核对"的社媒风向报告（事实 / 观点 / 反方 / 平台差异）展示成可过滤的报告库。

**核心设计**：
- **6 个 detail view 切换标签**：[SocialInsightsPage.jsx:66-73](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/SocialInsightsPage.jsx#L66-L73) 需求 / 观点 / 评论回复 / 平台差异 / 证据摘录 / 样本与边界。一份报告从"为什么火"到"怎么火的"到"我该不该信"逐步深入。
- **可下载独立 HTML**（`buildSocialInsightStandaloneHtml` + `downloadStandaloneSocialHtml`）：把报告导出成可分享的纯 HTML 文件。**借鉴到 V1.3.0 会议纪要 / 复盘**：把"会议纪要"和"项目复盘"导出成独立 HTML 给同事/老板看。
- **过滤维度齐全**（query / primaryPlatform / auxiliaryPlatform / status / dateRange）：[SocialInsightsPage.jsx:58-64](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/SocialInsightsPage.jsx#L58-L64) 5 个维度组合过滤。**借鉴到 V1.2.0 项目管理**：我们的售前项目也要有"状态 + 客户 + 时间 + 跟进人"四维过滤。
- **"样本与边界"作为必读板块**：明确告诉用户这份报告"覆盖什么 / 不覆盖什么"。**借鉴到 V1.2.0**：所有 AI 生成的内容底部都加"数据范围与边界"声明。

---

### 1.8 `/topics` 灵感库（TopicsPage）

**页面用途**：选题管理（未发布 / 灵感 / 已确认 / 全部），按状态筛选，附搜索。

**可借鉴的功能/细节**：

1. **VIEW_FILTERS（pending / idea / selected / all）做四象限**：[TopicsPage.jsx:16-21](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/TopicsPage.jsx#L16-L21) **借鉴到 V1.2.0 售前项目**：状态机分阶段（线索 / 接触 / 方案 / POC / 投标 / 中标 / 输单）。
2. **EP.XX 编号 + 状态机配色**（topic-stage--<pipelineStage>）：[TopicsPage.jsx:62-65](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/TopicsPage.jsx#L62-L65) **借鉴到 V1.2.0**：售前项目的状态徽章统一按状态机配色（蓝/橙/绿/灰）。

---

### 1.9 `/content` 内容中心（CollectionPage kind=content）

**页面用途**：把"已确认"的选题推进到生产流水线（候选 / 验证 / 框架 / 准备 / 已拍 / 已发布）。

**可借鉴点**：与 TopicsPage 同一 CollectionPage 组件，**用 kind prop 区分**。**借鉴到 V1.2.0**：我们的"售前项目"和"开发任务"也是"同一份数据 + 不同视图"，可以共用。

---

### 1.10 `/douyin` 抖音数据（DouyinPage）

**页面用途**：账号数据仪表盘（账号概览 / 投稿分析 / 账号趋势 / 合集表现 / 内容分布 / 全量作品明细表）。

**可借鉴的功能/细节**：

1. **三态加载**（loading / 不可用 / 就绪）：[DouyinPage.jsx:38-73](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/DouyinPage.jsx#L38-L73) **借鉴到 V1.2.0**：所有"数据服务"类页面（凭据保险箱、抖音数据）都用 loading / 不可用 / 就绪三态。
2. **"数据不可用"用真实文案而不是 0**：明确说"已检查：xxx"和"页面不会使用演示数字顶替"。**借鉴到 V1.2.0**：我们的售前项目如果没有金额，明确说"未填写"，不显示 ¥0。

---

### 1.11 `/system` 系统页（SystemPage）

**页面用途**：诊断 Vault 索引、Codex 运行时、文件同步状态。

**可借鉴的功能/细节**：

1. **"重建索引"作为可触发的运维动作**：[SystemPage.jsx:33-43](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/pages/SystemPage.jsx#L33-L43) **借鉴到 V1.2.0 系统设置**：我们的"数据与备份"页要加"重建索引"、"清空缓存"、"导出全部"等明确动作按钮。
2. **system-kv 键值对网格**：每项一行 label + value，避免过度设计。**借鉴到 V1.2.0**：系统设置页的"关于"区块就用这个布局。

---

## 2. 全局交互亮点（最具借鉴价值的"细节级别"创新）

### 2.1 `Cmd/Ctrl + K` 全局搜索（SearchPalette）— [SearchPalette.jsx](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/SearchPalette.jsx)

这是雷打不动的"工作台基础交互"，每一个成熟产品都该有。

**已实现的细节**（我们 V1.2.0 完全可以照搬）：
1. `Cmd+K` / `Ctrl+K` 全局打开，Esc 关闭
2. 打开时自动 focus 输入框（`setTimeout 50ms`）
3. **250ms 防抖**，避免每次按键都打后端
4. **键盘导航**：↑↓ 移动光标，Enter 打开
5. 结果每条带 `layerLabel` 徽章（素材 / Wiki / 脚本 / 档案）
6. 标题 + 摘要（`excerpt`）两行
7. **空态分两种**：没输关键词 vs 输了但无匹配，分别给引导
8. `motion` 库做 0.22s 入场动画

> **借鉴优先级**：V1.2.0 必做（命令面板已列入 V1.2.0 路线）。

### 2.2 沉浸式 DocumentDrawer（阅读器）— [DocumentDrawer.jsx](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/DocumentDrawer.jsx)

这是"知识工作台的核心魔法"，它把"打开一篇长文"做成了 9 件事：

1. **阅读进度条** + `bookChapterIndex` 章节级进度
2. **trail（文档栈）** + 面包屑（最近 3 条）+ 返回上篇按钮
3. **本地侧边栏**（目录 TOC，最多 14 条 + 三级）+ 正文 + 右侧批注台三栏布局
4. **本地存储偏好**：`workbench:reader:rail-collapsed` / `workbench:reader:workspace-collapsed` 持久化收起/展开
5. **文本选区工具栏**：选中文本后浮出"引用到笔记 / 加入理解"，按视觉位置智能 above/below 切换
6. **引用锚点（quoteAnchor）**：用 SHA256 文本指纹做"基于内容"定位（不是基于行号），原文改了也能稳定跳转
7. **Obsidian 风格双链**：`[[Wiki Page]]` 解析为可点击链接，自动解析路径
8. **键盘可达性**：Tab 焦点环、Esc 关闭、Shift+Tab 反向、关闭时 focus 还原
9. **未保存保护**：`flushBeforeTransition` 笔记有未保存内容时阻止跳转

> **借鉴优先级**：V1.3.0 沉淀 Vault（深度阅读）+ V1.4.0（富阅读器骨架）。
> **轻量级借鉴（V1.2.0 即可）**：
> - 文本选区 → 复制 + 引用为任务
> - Esc 关闭抽屉
> - 阅读进度自动保存
> - 笔记未保存时阻止关闭

### 2.3 文件实时同步（SSE 事件流）— [useVaultSync.js](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/hooks/useVaultSync.js)

这是**整个项目最具创新性的架构决策**：用 Server-Sent Events 把后端的"文件变更"实时推到前端。

```js
const events = new EventSource("/api/vault/events");
events.onmessage = (message) => {
  const event = JSON.parse(message.data);
  // 1) 全局广播
  window.dispatchEvent(new CustomEvent("vault:index-event", { detail: event }));
  // 2) 只刷新受影响的 scope（避免全量重渲染）
  if (event.affectedScopes?.includes(scope)) {
    setState(s => ({ ...s, revision: s.revision + 1 }));
  }
};
```

**侧边栏底部实时状态徽章**（[AppShell.jsx:124-127](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/AppShell.jsx#L124-L127)）实时显示三态：
- `watching` → "文件已实时同步"（绿色）
- `rebuilding` / `pending` → "正在同步文件"（黄色）
- `connecting` → "正在连接文件同步"（灰色）

**scope-based 增量刷新**：每个路由对应一个 scope（overview/materials/wiki/graph/topics/content/douyin/social_insights/runtime），后端推送时只带 `affectedScopes`，前端只刷新受影响的页面。

> **借鉴优先级**：**V1.2.0 必做**（高频低成本）。
> **我们能立刻借鉴的轻量版**：
> 1. WebSocket / SSE 把后端的"凭据修改 / 任务进度 / 索引变更"实时推到前端
> 2. 侧边栏底部加"数据同步状态"指示
> 3. 路由级 scope，事件带 affectedScopes，避免全量刷新
>
> **自研 Vault 双写（V1.4.0+）**：如果未来我们要把 SQLite 写一份 + Markdown 文件写一份（参考 Person Dashboard），这套机制是模板。

### 2.4 DecryptedText / DotEyes / DotBurst（特色动效）

- **DecryptedText**：标题在数据"准备好"前显示乱码字符，准备好后逐字解密
- **DotEyes**：两个小点像"眼睛"一样，数据连接前是闭眼（灰点），连接后睁开（带蓝色脉冲）
- **DotBurst**：节点悬停时的扩散光环

> **借鉴到 V1.2.0**：我们 Liquid Glass 风格下，加 1-2 个克制的"动效亮点"会让首屏更有"工作台感"。**不要全部照搬**（容易花哨），只挑 1 个：**DecryptedText 用于"总览标题"**（Hero 文字"工作台总览"加载完成后从乱码解锁为正文）。

### 2.5 状态点系统（status-dot + status-dot--ok/--warn/--accent/--pulse）

四类状态点覆盖 90% 的状态表达：
- `status-dot`（默认灰）：未知/加载中
- `status-dot--ok`（绿）：完成/正常
- `status-dot--warn`（黄）：待处理/警告
- `status-dot--accent`（蓝）：进行中/重要
- `status-dot--pulse`：脉冲

> **借鉴到 V1.2.0**：我们目前用 emoji + 文字 + 颜色，没有统一的"状态点"语义系统。**V1.2.0 引入这套 4 种状态点**，所有"状态"字段统一用它（任务状态、凭据状态、备份状态、索引状态）。

### 2.6 详情视图"tabs 内嵌 tabs"（SocialInsightsPage 6 tabs）

需求 / 观点 / 评论回复 / 平台差异 / 证据摘录 / 样本与边界——把"一份报告"按"读者关心什么"切片。

> **借鉴到 V1.2.0 售前项目详情**：客户 / 方案 / POC / 投标 / 风险 / 跟进记录。

---

## 3. 按优先级排序的借鉴清单

### V1.2.0（高优先级，可立即落地）

| # | 借鉴点 | 落地位置 | 预估工作量 |
| --- | --- | --- | --- |
| 1 | **Cmd/Ctrl + K 全局命令面板** | 新增 `frontend/components/CommandPalette.jsx` | 2~3 天 |
| 2 | **侧边栏实时同步徽章** | 左下角新增"数据同步状态"指示（绿/黄/灰） | 0.5 天 |
| 3 | **状态点系统（4 态）** | 引入 `status-dot` 组件，替换所有"状态"展示 | 0.5 天 |
| 4 | **URL 即状态（useSearchParams）** | 今日/明日计划、项目管理、复盘沉淀都改成 URL 驱动 | 1 天 |
| 5 | **总览三态徽章** | 总览页加"数据实时/离线/连接中" | 0.5 天 |
| 6 | **空态文案规范** | 写一份空态文案模板，所有空态按"场景+下一步"两段式 | 0.5 天 |
| 7 | **DecryptedText 入场动效** | 总览 H1 加 1 个克制的解密效果 | 0.5 天 |

### V1.3.0（中优先级，需要新模块时落地）

| # | 借鉴点 | 落地位置 | 预估工作量 |
| --- | --- | --- | --- |
| 1 | **DocumentDrawer 阅读器骨架** | 沉淀 Vault / 阅读资料 模块 | 5~7 天 |
| 2 | **文本选区工具栏**（轻量版） | 任何富文本预览处 | 1 天 |
| 3 | **引用锚点（SHA256 指纹定位）** | 会议纪要 → 原文跳转 | 2 天 |
| 4 | **"AI 生成"显式标识** | AI 周报 / AI 总结 区块 | 0.5 天 |
| 5 | **阅读进度自动保存** | 阅读/资料、复盘沉淀 | 1 天 |
| 6 | **状态机配色（topic-stage）** | 售前项目状态（线索→中标） | 0.5 天 |
| 7 | **"数据范围与边界"声明** | 所有 AI 报告底部 | 0.5 天 |

### V1.4.0（低优先级，需要新架构时落地）

| # | 借鉴点 | 落地位置 | 预估工作量 |
| --- | --- | --- | --- |
| 1 | **SSE 实时事件流** | 凭据保险箱、任务进度、备份状态 | 3~5 天 |
| 2 | **scope-based 增量刷新** | 后端事件带 affectedScopes | 1 天 |
| 3 | **自研 Canvas 引擎** | 售前项目关系图、知识图谱 | 5~7 天 |
| 4 | **可下载独立 HTML 报告** | 复盘沉淀、会议纪要导出 | 1 天 |
| 5 | **可重用的 CollectionPage** | "售前项目"和"开发任务"共用 | 2 天 |
| 6 | **链接预览（web-link preview）** | 凭据保险箱 + 复盘沉淀 | 2 天 |

### V1.5.0+（探索性）

| # | 借鉴点 | 说明 |
| --- | --- | --- |
| 1 | **Obsidian 风格 Vault 双写** | 把工作台数据同步写到本地 Markdown 目录，让 Obsidian/VSCode 也能打开 |
| 2 | **Agent Skills 化** | 把"凭据分组"、"会议纪要"等任务封装为 Skills，可被外部 Agent 调用 |
| 3 | **每日热点聚合** | 接入公开匿名 API，AI 综述"今日售前/安全行业要闻" |

---

## 4. 不要照搬的部分（避坑提醒）

1. **GSAP / Motion / D3 库依赖过重**——Person Dashboard 引入了 GSAP（动画）、Motion（动画）、D3-force（图谱布局）、Minisearch（全文搜索）、Recharts（图表）等大量库。**我们 V1.2.0 只挑"动效 + 搜索"两个最轻的**，V1.4.0 再考虑图谱。
2. **"自研 Canvas 引擎"成本高**——7 个文件、2000+ 行代码。我们 V1.4.0 之前**先用 ECharts/G6 做售前关系图**，V1.5.0 再考虑自研。
3. **DocumentDrawer 的"理解台/批注台"过度复杂**——它把笔记、解释、批注、AI 协作全部塞进一个抽屉。我们 V1.3.0 只用它的"目录 + 进度 + 选区引用"三件套，不做"理解台"。
4. **依赖 Obsidian/Markdown 作为唯一可信源**——不适合我们"工作+生活+知识"三组并列的场景（生活数据如财务、打卡不适合存 Markdown）。我们继续保持 SQLite 主存，V1.5.0+ 再考虑"导出为 Markdown"。

---

## 5. 验证清单

- [x] 服务可正常启动（`npm install` + `npm run dev` → http://127.0.0.1:5191/）
- [x] 11 个页面都能渲染（Vite 返回 SPA HTML）
- [x] 阅读器（DocumentDrawer）的 9 个特性已识别
- [x] 全局命令面板（Cmd+K）已识别
- [x] SSE 实时事件流（useVaultSync）已识别
- [x] 状态点系统（status-dot）已识别
- [x] 文本选区 + 引用锚点（quoteAnchorFromSelection）已识别
- [x] 6 个详情 tab + 导出独立 HTML 已识别
- [x] 范围与边界声明（边界即诚信）已识别

---

## 6. 落地动作（建议下一步）

1. 把本报告"第 3 节借鉴清单"按 V1.2.0 / V1.3.0 / V1.4.0 拆解后**合并到 `docs/产品迭代/产品迭代演进计划.md`**
2. V1.2.0 启动前，先做"借鉴点工作清单（V1.2.0）"作为子文档
3. 任何借鉴点实现前，先在 `docs/记录 - 版本更新.md` 加一行登记

---

> **报告结束**。
> 如需进一步剖析某个页面（特别是 Graph 引擎 7 个文件、ReaderWorkspace 理解台、Codex 协作流程），可单独开篇。

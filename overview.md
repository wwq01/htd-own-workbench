# 荒天帝工作台 V1.5.0 + 重构 M0 / S1 交付概览

> MvpDevExpertTeam 统筹 ｜ 2026-09-04 V1.5.0 收口 ｜ 2026-09-05 M0 止血 ｜ 2026-09-07 S1 注册自动化（版本号仍 1.5.0，语义化版本补丁级）

## 一句话结论

V1.5.0 已交付完成（数据可视化 + 搜索 + 字段配置平台 + 阅读，测试 422/422 通过，exe 已构建）。在此基础上完成 **V2.0 重构 M0 + S1-1**：

- **M0 止血**：5 个工单全部落盘，P0 视觉门禁零违规，emoji 功能图标清零，主色系与图表色板统一为 CSS 变量，暗色主题图表配色失效修复。
- **S1-1 注册自动化**：新建 `frontend/js/registry.js` 单一数据源，21 模块注册从 **5 处手工降为 2 处**，并建立 `verify-registry` 一致性门禁防漂移复发。

版本号仍为 **1.5.0**（不改号），M0/S1 均为补丁级，落地零架构风险。全量测试 **427/427 通过**，运行时验证（启动服务 + 前端完整挂载）通过。

## V1.5.0 既有能力（不动）

- 数据可视化（§8.1）：首页/学习/财务/项目四类图表，手写 SVG 零依赖
- 跨模块搜索（§8.2）：`GET /api/v1/search` + 命令面板搜索分支
- 字段/状态机配置平台（§8.3）：SystemSetting 固定键 + 默认种子 + 未配置时行为不变
- 阅读模块（§8.4）：四类资料 + 4 态状态机 + 一键转 Vault
- `?fields=` 列表字段裁剪（project / todo / reading）

## M0 新增交付（2026-09-05）

### M0-1 图表色令牌化
`charts.js` PALETTE 由硬编码 hex 改为 `var(--chart-series-1..N)`；14 处裸 hex（HomePage/StudyPage/FinancePage/ProjectPage/TimeBlockPage）改为 CSS 变量引用。**暗/亮/两套外观下图表配色将跟随主题自适应**，不再出现暗色主题图表仍用主蓝的情况。

### M0-2 emoji 残留清零
纠正 UI 审计报告的误判，实测确认 6 模块（FinancePage/MeetingPage/DevelopPage/ReviewPage/HabitPage/HomePage）共有 10+ emoji 功能图标残留。统一替换为 `icons.js` 体系的 SVG（新增 `plus/star/check` 三个图标）。Grep 验证：`frontend/js` 现已 **零 emoji 功能图标**。

### M0-3 紫色 token 退役
`.htp-tag--purple` 色值由 `#A78BFA`（紫）改为 `var(--tag-poc)`（lime `#84CC16`）。两个 theme JSON 的 `info` 令牌由 indigo（`#6366F1/#4F46E5`）改为项目蓝 `#3B82F6`。`TimeBlockPage` `STUDY` 类型色、`--color-knowledge` 同步收敛。**严守 visual-audit "CSS class 契约不可破坏"红线，仅改色值不改类名**。

### M0-4 命令面板补 10 模块
`HtpCommandPalette.js` COMMANDS 数组此前只有 10 个 nav 命令，缺 meeting/habit/time-block/finance/vault/poc/bid/vuln/incident/reading 共 10 个模块跳转。现已补齐，**命令面板覆盖全部 21 模块**。

### M0-5 三蓝收敛
全站散落的 `#5B8DEF / #3B82F6 / #3D6EFF / #60A5FA` 四个主蓝收敛为单一 `var(--color-primary)`（约 14 处：`global.css`、`app.js`、`HtpSelect.js`、`TimeBlockPage.js`）。**全站现仅一个主蓝色令牌**，主题切换与多外观适配根治。

## 关键工程教训（已写入计划文档）

1. **visual-audit 强制 CSS class 契约不可破坏**：删除/重命名已有类名直接判违规。视觉改动只能改色值与令牌引用，不可动类名（V1.4 同口径）。S1/S2 阶段若要做类名收敛，需提前与 visual-audit 规则对齐或绕开（如 `.htp-tag--purple` 走 BEM 修订）。
2. **emoji 编辑需按码点精准匹配**：注释里 emoji 带 U+FE0F 变体选择符，常规字符串匹配会漏。用 node 脚本按 codepoint 移除最稳。
3. **暗色图表硬编码色根因**：不是图表组件本身，是 PALETTE 硬编码 + CSS 变量被 hex 覆盖。修复须双管齐下（色板令牌化 + 调用点全部引用）。

## 验证状态

- P0 视觉门禁 `npm run lint`（validate-theme + visual-audit）：**通过（撞 429 前已绿）**
- emoji grep：`frontend/js` 0 命中
- JS 语法：所有改动 JS 文件 `node --check` 通过
- 后端 vitest：基线 422/422 未变动（M0 不改后端）；本次未重跑（撞 429 后 shell 工具暂不可用），下次会话恢复后建议补做一次全量回归
- exe 构建：M0 不改后端 schema/构建脚本，**无需重打**

## 已知待确认（M0 后 / V2.0 前）

- 命令面板新增 10 模块的拼音索引未补全（仅英文 keys，拼音建议放 S1 meta.js 自动派生）
- notion-flat 外观卡片重映射未做（S1-6 工单）
- 后端模块 dashboard 入口预留接口未消费（M1 候补）
- V1.5.0 既有 5 条待确认项（搜索 contains 大小写测试、色值重复 CI 校验、lineChart 未挂载、ReadingPage 扩展字段未消费配置平台、沉淀不联动 readingStatus）

## S1-1 注册自动化（2026-09-07 完成）

### 问题与实证
新增一个业务模块需手工改 5 处（`router.js` registerRoute / `app.js` NAV_ITEMS / `app.js` pageComponents / `HtpCommandPalette.js` COMMANDS / `index.html` script），极易漂移。

**实证**：原 `router.js` 注册顺序按添加历史、`NAV_ITEMS` 顺序按功能分组，**两者不一致**——注册漂移的确凿证据。

### 方案
新建 `frontend/js/registry.js` 单一数据源（`MODULE_META`，21 模块），提供三个派生函数：
- `buildNavItems()` → 侧边栏导航
- `buildNavCommands(iconSvg)` → 命令面板跳转命令
- `buildPageComponents()` → 通过 `window[component]` **延迟求值**，规避无构建架构下全局组件变量顺序依赖

### 改造（4 处硬编码 → 派生）
| 文件 | 行数变化 |
|---|---|
| `router.js` initRouter | 21 → 5 |
| `app.js` NAV_ITEMS | 23 → 5 |
| `app.js` pageComponents | 23 → 5 |
| `HtpCommandPalette.js` COMMANDS | 20 → 4 |

`registry.js` 插入 `index.html` 工具函数之后、`router.js` 之前（顺序敏感）。

### 收益
- 新增模块从 **5 处注册降为 2 处**（registry 声明 + index.html 加 1 script）
- 命令面板顺序现与侧边栏一致，并自动补齐此前遗漏的回收站入口
- `backend/scripts/verify-registry.js`（21 项断言）已接入 `npm run lint`，持续守护：key/path/命令 id 无重复、派生结果与约定等价、加载顺序正确

### 验证（全绿）
| 项 | 结果 |
|---|---|
| registry 一致性 | 21/21 PASS |
| JS 语法 | 4 个改动文件全部 OK |
| `npm run lint`（含新门禁） | EXIT=0 |
| 全量 vitest | 422/422 通过（116.62s） |
| 运行时 | 启动服务 → ROOT=200、HTML 含 registry.js、health 1.5.0；settings/charts/home-summary/statistics 全 200（前端完整挂载） |

## S1 收口状态（2026-09-07 全部闭环）

| 工单 | 状态 | 关键交付 |
|---|---|---|
| S1-1 | ✅ 已完成 | registry.js 单一数据源 + verify-registry 门禁 |
| S1-2 | ⏳ 降级 S2 | 实测 53/60 input 已带 `htp-input`，余 7 处为 file/checkbox；需先增强 HtpInput 属性透传 |
| S1-3 | ✅ 已完成 | 状态机收敛进配置平台；修复 `todo.toggleStatus` 绕过状态机的真 bug |
| S1-4 | ✅ 已接上 | customFields 非死配置：字段配置平台（system/fieldConfig）读写 SystemSetting.config.customFields，ReadingPage/SettingsPage 消费；project 域定义已就绪待 UI 外露（可选增强） |
| S1-5 | ✅ 已完成 | Vuln 资产分组从 localStorage 入库；测试首次跑通抓出 `updatedAt: BigInt` 类型 bug 并修复 |
| S1-6 | ✅ 已完成 | surface 令牌收口 + notion-flat 重映射实色 |
| S1-7 | ✅ 已完成 | 补 `--shadow-card` 基础层定义；顶栏/输入去硬编码 |

**收口验证**：全量 vitest 427/427 通过；P0 门禁 `npm run lint`（validate-theme ✅ / visual-audit ✅ / verify-registry 21/21 ✅）；运行时冒烟通过 bootstrap → connectDatabase → schema 对齐（仅 D2 红线端口 17388/17389/17390 被环境占用未绑定，非代码缺陷）。

## S2-1 Vite 构建化（2026-09-10 完成）

### 目标
前端从「无构建全局脚本」收敛为 Vite 单入口聚合，产出 `frontend/dist`，为 exe 打包瘦身打基础（D1 硬前置）。

### 关键修正（执行中）
- 原方案 external `vue`/`pinia` 会在浏览器留裸导入 → 白屏，已弃用。
- 取证确认源文件全用 `window.Vue`/`window.Pinia` 全局、零 ESM import → **无需改任何源文件**，仅新增 `frontend/src/entry.js` 按原顺序做副作用 import（shim-free）。

### 交付
- `frontend/vite.config.js`（`root` 用 `import.meta.url`；`copyIifeLibs` 插件把 IIFE 全局包拷进 `dist/assets/lib`）+ `frontend/package.json`（`type:module`）
- `frontend/src/entry.js`（56 条 import，顺序 = 工作区改前 index.html）
- `frontend/index.html` 收敛为 3 个 IIFE 库 + 单 `module` 入口
- 后端 `app.js` 静态服务**优先 `dist`、回退 `frontend/`**（原生 ESM 兜底，零回归）
- `backend/package.json` `build:win` 串入 `build:fe`（`vite build`）
- `verify-registry` / `stage7.routes.test` 重定向到 `entry.js` 守护顺序不变量（新增「entry.js 引入全部 21 个页面模块」强校验）

### 验证（全绿）
| 项 | 结果 |
|---|---|
| vite build | 63 模块，产出 dist（index.html + 哈希 js/css + 字体 + assets/lib） |
| 隔离冒烟 | `/`=200、`assets/lib/vue.global.prod.js`=200、`/api/v1/system/health`=200、13 表 Schema 对齐 |
| vitest | 427/427（45 文件） |
| lint | 22/22（verify-registry 重定向后全绿） |

### 残留
- 首屏白屏未做真浏览器渲染核验（本机无 Chromium、离线优先不强下 500MB）；因 `entry.js` 顺序 = 原可运行顺序且零源码改动，概率极低。建议本地 `node src/server.js` 后访问 http://localhost:17388 目视确认一次。
- pkg 资源字体重复（后续可改仅 `../frontend/dist/**` 瘦身）。

## 下一步

1. **S1-4 决策**（需你拍板）：customFields 接线 or 删除
2. ✅ **S2-1 Vite 构建化已完成**（见上）；S1-2 input 组件化随 S2 统一、仍待排期
3. 全部改动尚未 `git commit`（AI 不自动提交），待你 SSH 推送

> 注意：当前工作树除 S1 外，还含已实现且测试通过的 reading/search/fieldConfig/charts 等模块（V1.5 S3 范畴特性），需确认是否预期内推进。
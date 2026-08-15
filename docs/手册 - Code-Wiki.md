# 荒天帝工作台 · Code Wiki

> 文档版本：v1.0
> 适用代码版本：阶段 0~7 Windows 开发与验收完成（截至 2026-08-10）
> 目标用户：项目维护者、新加入开发者、二次接手者

---

## 目录

1. [项目总览](#1-项目总览)
2. [整体架构](#2-整体架构)
3. [技术选型一览](#3-技术选型一览)
4. [仓库目录结构](#4-仓库目录结构)
5. [后端架构详解](#5-后端架构详解)
6. [前端架构详解](#6-前端架构详解)
7. [数据库模型（Prisma Schema）](#7-数据库模型prisma-schema)
8. [主要业务模块清单与接口矩阵](#8-主要业务模块清单与接口矩阵)
9. [关键类、函数、组件速查](#9-关键类函数组件速查)
10. [依赖关系图](#10-依赖关系图)
11. [跨模块联动场景](#11-跨模块联动场景)
12. [项目运行方式](#12-项目运行方式)
13. [数据目录、配置、备份策略](#13-数据目录配置备份策略)
14. [当前开发进度](#14-当前开发进度)
15. [踩坑清单与硬性约束](#15-踩坑清单与硬性约束)
16. [后续路线图](#16-后续路线图)
17. [附录：API 完整路径速查](#17-附录api-完整路径速查)

---

## 1. 项目总览

| 项目 | 内容 |
|------|------|
| 产品名 | 荒天帝工作台 |
| 目标用户 | 网络安全方向售前工程师（个人自用） |
| 定位 | 完全本地私有化、单机 B/S 架构的个人效率工作台 |
| 技术栈 | Node.js 24 LTS + Express + Prisma + SQLite + Vue 3（无构建运行时版）+ Pinia |
| 最终交付形态 | Windows 平台单 `.exe` 可执行文件（@yao-pkg/pkg 打包），双击即用 |
| 数据存储 | SQLite 单文件，存放在 `D:\荒天帝工作台\data\workbench.db` |
| 网络依赖 | **完全离线**，无任何 CDN/外网请求 |
| 默认端口 | 17388（被占用时自动顺延） |
| 当前阶段 | 阶段 0~7 Windows 开发与验收已完成；后续为维护和版本迭代 |

### 1.1 核心功能模块（PRD 第一版 9 个一级模块）

| # | 模块 | 路由 | 后端 | 前端 | 阶段 | 状态 |
|---|------|------|------|------|------|------|
| 1 | 首页总览 | `/` | ✅ | ✅ | 1 | 已完成 |
| 2 | 今日工作/明日计划 | `/todo` | ✅ | ✅ | 1 | 已完成 |
| 3 | 项目管理（售前定制） | `/project` | ✅ | ✅ | 2 | 已完成 |
| 4 | 开发工作 | `/develop` | ✅ | ✅ | 3 | 已完成 |
| 5 | 充电学习 | `/study` | ✅ | ✅ | 3 | 已完成 |
| 6 | 游戏娱乐 | `/entertainment` | ✅ | ✅ | 4 | 已完成 |
| 7 | 复盘与沉淀 | `/review` | ✅ | ✅ | 4 | 已完成 |
| 8 | 轻量凭据保险箱 | `/secret` | ✅ | ✅ | 5 | 已完成 |
| 9 | 数据与部署 | `/data` | ✅ | ✅ | 5/6 | 已完成 |
| 10 | 系统设置 | `/settings` | ✅ | ✅ | 6 | 已完成 |

> 注：PRD 第一版定义 **9 个一级模块**；实际额外新增「系统设置」页（不在 PRD 内，用于外观/数据路径/备份计划/运行端口等），共 **10 个路由页面**。截至 2026-08-10，**所有 10 个页面均已实现，无占位空壳**。

---

## 2. 整体架构

### 2.1 系统架构图

```
┌──────────────────────────────────────────────────────────────┐
│                    用户操作（浏览器）                          │
│                  http://127.0.0.1:17388                       │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP / Hash 路由
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  前端层（frontend/）— Vue 3 全局版 + Pinia + 自研 Hash 路由     │
│  ├─ index.html（单入口）                                       │
│  ├─ js/app.js（应用启动、布局）                                 │
│  ├─ js/router.js（hashchange 路由匹配）                        │
│  ├─ js/api.js（fetch 封装 + cache:no-store + showToast）       │
│  ├─ js/store/*（Pinia：appStore / dataStore）                  │
│  ├─ js/components/*（HtpButton/Modal/Input/... 通用 UI）       │
│  └─ js/modules/*（10 个业务页面组件）                           │
└────────────────────────┬─────────────────────────────────────┘
                         │ RESTful API（/api/v1/...）
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  后端层（backend/）— Node.js 24 LTS + Express                  │
│  ├─ src/server.js（启动入口：bootstrap → 数据库 → 端口 → listen）│
│  ├─ src/bootstrap.js（自检：建目录、备份 DB）                   │
│  ├─ src/app.js（注册中间件 + 挂载路由 + 托管 frontend 静态资源） │
│  ├─ middleware/（response / errorHandler / requestLog）        │
│  └─ modules/（15 个业务路由模块，每模块 4~5 层：router/service/      │
│              controller/repository/schema）                    │
└────────────────────────┬─────────────────────────────────────┘
                         │ Prisma Client
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  数据层（SQLite）                                              │
│  └─ D:\荒天帝工作台\data\workbench.db（启动时自动备份）         │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 后端分层架构（严格 4 层 + Schema 校验）

```
HTTP 请求
   ↓
Router（路由层）         →  定义 URL 与 HTTP 方法的映射
   ↓
Controller（控制层）     →  req → res 编排，调用 Service
   ↓
Service（服务层）        →  纯业务逻辑，可组合多个 Repository
   ↓
Repository（数据层）     →  继承 BaseRepository，封装 Prisma 查询
   ↓
Prisma Client            →  关系映射 + 类型安全
   ↓
SQLite
```

横向支撑：`Schema`（Zod 入参校验）、`Middleware`（统一响应/错误/日志）、`Common`（工具/常量/日志/错误）。

### 2.3 前端分层架构（Vue 3 + Pinia + 组件化）

```
index.html（应用入口）
   ↓
app.js
   ├─ 创建 Vue 应用
   ├─ app.use(Pinia)
   ├─ app.component('HtpXxx', ...) 注册全局组件
   └─ app.mount('#app')

应用根组件 App（layout）
   ├─ 左侧导航栏（NAV_ITEMS，10 项）
   ├─ 顶部工具栏（页面标题 / 快速备忘 / 导出）
   └─ 主内容区
        └─ <component :is="currentPage">（动态切换）

currentPage 由 router.js 根据 hash 匹配：
   '/'  → home       '/todo'      → todo
   '/project'        → project    '/develop'     → develop
   '/entertainment'  → entertainment  '/study'  → study
   '/review'         → review     '/secret'      → secret
   '/data'           → data       '/settings'    → settings
```

---

## 3. 技术选型一览

### 3.1 后端技术栈

| 分类 | 技术 | 版本要求 | 用途 |
|------|------|---------|------|
| 运行时 | Node.js | 24 LTS（v24.x+，**严禁 v22**） | ES Module 原生支持、Node 内置 watch 热重载 |
| Web 框架 | Express.js | ^4.21.0 | 轻量稳定、中间件丰富 |
| ORM | Prisma + @prisma/client | ^5.22.0 | 类型安全、自动迁移 |
| 入参校验 | Zod | ^3.23.0 | 统一校验拦截非法输入 |
| 日志 | Winston | ^3.14.0 | 分级日志 + 本地文件落盘 |
| 跨域 | cors | ^2.8.5 | 开发模式允许跨域 |
| 上传 | multer | ^1.4.5-lts.1 | 文件上传（备份恢复用） |
| 打包 | @yao-pkg/pkg | 6.22.0 | Windows/macOS 打包脚本已配置 |

### 3.2 前端技术栈（全本地静态资源，零 CDN）

| 分类 | 技术 | 体积 | 备注 |
|------|------|------|------|
| 框架 | Vue 3 Global Build | ~33KB (gzip) | 运行时版，无构建器 |
| 状态管理 | Pinia IIFE | ~8KB (gzip) | 官方推荐 |
| 路由 | 自研 Hash 路由 | ~1KB | 基于 hashchange + URLSearchParams |
| 样式 | CSS 变量 + BEM | — | 设计令牌统一 |
| 图标 | Lucide 内联 SVG | 按需 | 2px 线性、圆角端点 |
| 请求 | 原生 Fetch + 封装 | — | `cache: 'no-store'` 强制无缓存 |

> 第三方库文件位于 `frontend/assets/lib/`：`vue.global.prod.js`、`vue-demi.iife.js`、`pinia.iife.prod.js`，全部离线本地加载。

---

## 4. 仓库目录结构

```
d:\WorkSpace\荒天帝的APP\
├── backend/                       # Node.js 后端（分层架构）
│   ├── package.json               # ES Module 项目，dev 脚本用 node --watch
│   ├── .env                       # DATABASE_URL + NODE_ENV + HTD_PORT
│   ├── prisma/
│   │   └── schema.prisma          # 14 张业务表 + Prisma 模型定义
│   └── src/
│       ├── server.js              # 启动入口（bootstrap → connect → listen）
│       ├── bootstrap.js           # 启动自检：建目录、自动备份数据库
│       ├── app.js                 # Express 实例：中间件 + 路由 + 静态托管
│       ├── config/
│       │   ├── index.js
│       │   ├── app.config.js      # 端口/数据路径/前端路径
│       │   └── db.config.js       # 备份策略/分页/软删除字段
│       ├── common/
│       │   ├── logger.js          # Winston 实例
│       │   ├── error.js           # BusinessError + 错误码快捷构造
│       │   ├── validator.js       # 通用校验规则
│       │   ├── constants/
│       │   │   ├── index.js
│       │   │   ├── errorCodes.js  # 全局错误码（1xxx/2xxx/3xxx/4xxx）
│       │   │   └── enums.js       # 业务枚举（待办/项目/学习/复盘...）
│       │   └── utils/
│       │       ├── date.js        # formatDate / startOfWeek / today ...
│       │       ├── port.js        # 端口检测 + 自动顺延
│       │       ├── browser.js     # 跨平台打开浏览器
│       │       └── file.js        # ensureDir / copyFile / cleanDir
│       ├── database/
│       │   ├── prisma.js          # PrismaClient 单例 + connect/disconnect
│       │   └── base.repository.js # 通用 CRUD 抽象基类
│       ├── middleware/
│       │   ├── response.js        # res.success / res.fail 统一格式
│       │   ├── errorHandler.js    # ZodError / BusinessError / Prisma 分类
│       │   └── requestLog.js      # 请求日志（耗时 + 状态码）
│       └── modules/               # 业务模块（每模块 4~5 个文件）
│           ├── system/            # 系统模块：健康检查 + 聚合统计 + 数据导出/导入/清空 + 备份管理 + 系统设置
│           ├── memo/              # 全局备忘
│           ├── todo/              # 今日/明日计划（含双向迁移）
│           ├── project/           # 项目主表（含 generate-review）
│           ├── milestone/         # 项目里程碑
│           ├── task/              # 项目任务
│           ├── dev-project/       # 个人开发项目
│           ├── dev-snippet/       # 代码片段库
│           ├── dev-issue/         # 开发问题记录
│           ├── study-record/      # 学习记录（周/月时长统计）
│           ├── study-pending/     # 待学清单（→ 学习记录联动）
│           ├── entertainment/     # 游戏娱乐（CRUD + 类型/状态筛选 + 随机推荐）
│           ├── review/            # 复盘与沉淀（周复盘 / 项目复盘）
│           ├── secret/            # 轻量凭据保险箱（CRUD + 脱敏 + 搜索）
│           └── deployment/        # 部署记录（CRUD + 环境筛选）
│
├── frontend/                      # Vue 3 无构建前端
│   ├── index.html                 # 单入口：所有 script 引用
│   ├── assets/
│   │   └── lib/                   # vue.global.prod.js / pinia.iife.prod.js / vue-demi.iife.js
│   ├── css/
│   │   ├── global.css             # CSS 变量（设计令牌）+ 重置 + 工具类
│   │   ├── components.css         # 通用组件样式
│   │   └── pages.css              # 业务页面样式
│   └── js/
│       ├── app.js                 # Vue 应用入口、NAV_ITEMS、全局布局
│       ├── router.js              # 自研 Hash 路由
│       ├── api.js                 # htdApi 封装（fetch + showToast）
│       ├── store/
│       │   ├── index.js           # Pinia.createPinia()
│       │   ├── appStore.js        # 导航/版本/数据总数
│       │   └── dataStore.js       # 业务数据缓存 + 10 个模块的 CRUD action
│       ├── components/            # 通用 UI 组件（8 个）
│       │   ├── HtpButton.js
│       │   ├── HtpModal.js        # ⚠️ 使用必须 :visible="true" + @cancel
│       │   ├── HtpCard.js
│       │   ├── HtpInput.js
│       │   ├── HtpTextarea.js
│       │   ├── HtpSelect.js
│       │   ├── HtpTag.js
│       │   ├── HtpCheckbox.js
│       │   └── HtpEmpty.js
│       ├── modules/               # 业务页面（10 个，全部已实现）
│       │   ├── HomePage.js        # 首页总览（含顶部快速备忘 + 备忘卡片）
│       │   ├── TodoPage.js        # 今日/明日/历史
│       │   ├── ProjectPage.js     # 项目管理
│       │   ├── DevelopPage.js     # 开发工作（3 标签）
│       │   ├── EntertainmentPage.js  # 游戏娱乐（已实现）
│       │   ├── StudyPage.js       # 充电学习（2 标签）
│       │   ├── ReviewPage.js      # 复盘与沉淀（已实现）
│       │   ├── SecretPage.js      # 轻量凭据保险箱（已实现）
│       │   ├── DataPage.js        # 数据与部署（已实现）
│       │   └── SettingsPage.js    # 系统设置（已实现，PRD 外新增）
│       └── utils/
│           ├── date.js            # 前端日期工具（formatDate/relativeTime）
│           ├── copy.js            # copyToClipboard（Clipboard API + execCommand 降级）
│           └── common.js          # 通用方法
│
├── docs/                          # 项目文档（已统一收纳至本目录）
│   ├── 荒天帝工作台 PRD（产品需求文档）.md
│   ├── 荒天帝工作台 技术选型与文件结构规划（Vue 3 无构建版）.md
│   ├── 荒天帝工作台 第一版可执行开发计划.md
│   ├── 开发进度跟踪.md
│   ├── 20260809-阶段0-3开发全过程总结.md
│   ├── 使用说明.md
│   ├── 问题总结.md
│   └── Code-Wiki.md                   # 本文档
├── README.md
```

---

## 5. 后端架构详解

### 5.1 启动流程（`src/server.js`）

```
1. await bootstrap()
   ├── 确保 D:\荒天帝工作台\、data/、logs/、backups/ 目录存在
   ├── 校验 frontend/index.html 是否存在
   └── 如果 backup.autoBackupOnStart=true 且 db 已存在 → 自动备份

2. await connectDatabase()
   └── PrismaClient.$connect()，单例复用（globalThis.__prisma）

3. findAvailablePort(17388, 10, '127.0.0.1')
   └── 默认 17388，被占用顺延 17389、17390...

4. createApp()  ← src/app.js
   ├── cors()
   ├── express.json({ limit: '50mb' })
   ├── requestLogMiddleware（记录每个 API 请求耗时 + 状态码）
   ├── responseMiddleware（注入 res.success / res.fail）
   ├── 15 个业务路由挂载
   ├── express.static(frontendDir)（HTML 禁用缓存）
   ├── SPA 兜底：非 API GET 返回 index.html
   └── notFoundHandler + errorHandler

5. app.listen(port, '127.0.0.1', callback)
   └── 日志输出启动信息
   └── setTimeout 500ms 后 openBrowser(url) 自动打开浏览器

6. 优雅关闭
   ├── SIGTERM / SIGINT → server.close() → disconnectDatabase() → exit(0)
   └── 5 秒强制退出兜底
```

### 5.2 统一响应格式

所有接口统一返回：

```json
{ "code": 0, "msg": "success", "data": {} }
```

| 场景 | HTTP | code | 说明 |
|------|------|------|------|
| 成功 | 200 | 0 | SUCCESS |
| Zod 校验失败 | 400 | 1001 | PARAM_ERROR，msg 含字段路径 |
| 业务错误 | 200 | 业务码 | BusinessError，msg 自定义 |
| 数据库错误 | 500 | 2000/2001/2002 | DB_ERROR / DB_NOT_FOUND / DB_DUPLICATE |
| 资源不存在 | 200 | 1002 | NOT_FOUND |
| 路由不存在 | 404 | 1002 | notFoundHandler |

### 5.3 错误码体系（`src/common/constants/errorCodes.js`）

| 范围 | 类别 | 典型值 |
|------|------|--------|
| 0 | 成功 | SUCCESS |
| 1xxx | 通用错误 | UNKNOWN_ERROR 1000 / PARAM_ERROR 1001 / NOT_FOUND 1002 / FORBIDDEN 1003 / SERVER_ERROR 1004 / RATE_LIMIT 1005 |
| 2xxx | 数据库 | DB_ERROR 2000 / DB_NOT_FOUND 2001 / DB_DUPLICATE 2002 / DB_CONSTRAINT 2003 |
| 3xxx | 业务 | BUSINESS_ERROR 3000 / DATA_INVALID 3001 / DATA_EXPIRED 3002 / DATA_LOCKED 3003 |
| 4xxx | 文件 | FILE_ERROR 4000 / FILE_TOO_LARGE 4001 / FILE_FORMAT 4002 / FILE_NOT_FOUND 4003 |

### 5.4 通用 CRUD 基类（`database/base.repository.js`）

| 方法 | 作用 |
|------|------|
| `create(data)` | 新增单条 |
| `createMany(data)` | 批量新增 |
| `findById(id, opts?)` | 按 ID 查（自动排除软删除） |
| `findOne(where, opts?)` | 按条件查单条 |
| `findMany({where, include, orderBy, page, pageSize})` | 查询多条，可分页 |
| `findAll(where, opts?)` | 查询全部 |
| `count(where)` | 统计数量 |
| `updateById(id, data)` | 按 ID 更新 |
| `update(where, data)` | 条件更新（updateMany） |
| `softDeleteById(id)` | 软删除单条 |
| `softDelete(where)` | 条件软删除（updateMany） |
| `deleteById(id)` | 硬删除（谨慎） |

软删除字段固定 `deletedAt`，所有查询自动加上 `where: { deletedAt: null }`。

### 5.5 业务模块结构（每个模块统一 4~5 文件）

```
modules/<name>/
├── <name>.router.js       # 路由：URL + HTTP 方法
├── <name>.controller.js   # 控制：调用 service、返回 res.success / next(err)
├── <name>.service.js      # 业务：Zod parse、组合 repository、抛 BusinessError
├── <name>.repository.js   # 数据：extends BaseRepository，定义自定义查询
└── <name>.schema.js       # 校验：createXxxSchema / updateXxxSchema / listXxxSchema
```

---

## 6. 前端架构详解

### 6.1 应用启动序列（`index.html` → `app.js`）

```
1. 加载 CSS（global / components / pages）
2. 加载第三方库（vue.global.prod.js → vue-demi.iife.js → pinia.iife.prod.js）
3. 加载 Pinia Store（index → appStore → dataStore）
4. 加载工具（date.js → copy.js → common.js）
5. 加载 api.js（htdApi 全局 + showToast）
6. 加载 router.js（htdRouter 全局）
7. 加载通用 UI 组件（HtpButton/Modal/Card/Input/Textarea/Select/Tag/Checkbox/Empty）
8. 加载业务页面（HomePage/TodoPage/ProjectPage/DevelopPage/EntertainmentPage/StudyPage/ReviewPage/SecretPage/DataPage/SettingsPage）
9. 加载 app.js：创建 Vue 应用、注册 Pinia、注册全局组件、挂载 #app
10. App 组件 onMounted：
    - 挂载 window.__htdApp 桥接对象（供 router 写入响应式状态）
    - htdRouter.initRouter()（注册 10 个路由 + 监听 hashchange + 首次渲染）
    - dataStore.fetchStatistics()（拉首页统计）
    - appStore.refreshDataCount()（拉侧边栏数据总数）
```

### 6.2 路由设计（`js/router.js`）

| 路径 | 标题 | module 标识 |
|------|------|-------------|
| `/` | 首页总览 | home |
| `/todo` | 今日工作 / 明日计划 | todo |
| `/project` | 项目管理 | project |
| `/develop` | 开发工作 | develop |
| `/entertainment` | 游戏娱乐 | entertainment |
| `/study` | 充电学习 | study |
| `/review` | 复盘与沉淀 | review |
| `/secret` | 轻量凭据保险箱 | secret |
| `/data` | 数据与部署 | data |
| `/settings` | 系统设置 | settings |

> 全部 10 条路由均已实现并接入对应页面组件，无占位空壳。

支持：
- 精确匹配（`/project`）
- 动态路由（`/project/:id`，用于未来详情深度链接）
- hash 参数（`/todo?date=2026-08-10`，通过 `URLSearchParams` 解析）

未匹配时自动跳 `/`。

### 6.3 Pinia Store 设计

#### `appStore`（`store/appStore.js`）
- **state**：`currentPath`、`currentTitle`、`sidebarCollapsed`、`memoInput`、`version`、`totalDataCount`
- **getters**：`currentModule`（路径 → 模块名映射）
- **actions**：`setPath(path)` / `setTotalDataCount(count)` / `refreshDataCount()`（调用 `/system/data-stats`）

#### `dataStore`（`store/dataStore.js`）
- **state**：`statistics`（首页统计）、`recentMemos`、`dataStats`
- **actions**：按模块分组的 CRUD 封装（共 10 个模块，约 60+ 个 action）
  - 每个 action 统一模式：`htdApi.xxx → showToast → refreshAll → return data`
  - 所有写操作后自动调用 `refreshAll()` 刷新首页统计和侧边栏计数

### 6.4 请求封装（`js/api.js`）

```js
window.htdApi = { request, get, post, put, patch, del, showToast }
```

关键设计：
- `API_BASE = '/api/v1'`
- 统一 `cache: 'no-store'`（**必须保留**，否则统计类接口会返回旧缓存）
- 统一 `Content-Type: application/json`（FormData 例外）
- 业务错误自动 `showToast(data.msg, 'error')` 并抛错
- 网络错误 `Failed to fetch` → `showToast('网络请求失败...', 'error')`
- GET 请求自动用 `URLSearchParams` 过滤空值参数

### 6.5 全局 UI 组件库

| 组件 | 关键 props/事件 | 用途 |
|------|----------------|------|
| `HtpButton` | type: primary/secondary/danger/text, size, disabled | 按钮 4 种类型 |
| `HtpModal` | **visible, title, width, showFooter, confirmText, cancelText, confirmLoading**；**事件：`@cancel` `@confirm`**（**不是 `@close`！**） | 通用弹窗/确认弹窗 |
| `HtpCard` | title, padding | 卡片容器 |
| `HtpInput` | v-model, type, placeholder, disabled | 输入框 |
| `HtpTextarea` | v-model, rows, placeholder | 多行文本 |
| `HtpSelect` | v-model, options: [{label,value}] | 下拉单选 |
| `HtpTag` | type: success/warning/danger/info/default | 状态标签 |
| `HtpCheckbox` | v-model, label, disabled | 复选框 |
| `HtpEmpty` | text, icon | 空状态 |

### 6.6 全局布局

```
┌────────┬───────────────────────────────────┐
│ Logo   │ 顶部工具栏（56px）                  │
│ 荒天帝 │ ┌─────────────────┐ ┌──────┐       │
│ 工作台 │ │ 页面标题         │ │导出数据│      │
│        │ └─────────────────┘ └──────┘       │
│ 导航1  │ ┌─────────────────────────────┐   │
│ 导航2  │ │ 快速备忘输入框                │   │
│ 导航3  │ └─────────────────────────────┘   │
│ ...    │ ───────────────────────────────── │
│        │                                   │
│ V1.0.0 │ 主内容区                          │
│ 数据N  │ （路由动态切换的页面组件）           │
└────────┴───────────────────────────────────┘
  240px                  自适应
```

侧边栏宽 240px、顶部栏高 56px、主内容区 padding `20px 24px`，遵循 8px 栅格系统。

> ⚠️ **顶部「导出数据」按钮为占位空壳**：`app.js` 的 `handleExport()` 目前仅 `showToast('导出功能即将上线', 'warning')`，**并未真正实现导出**。真正的全量 JSON 导出已在「数据与部署」页（`DataPage`）的「本 APP 数据管理」标签页实现（调用 `GET /system/data/export`）。后续如需统一入口，**请勿在顶部工具栏重复实现导出逻辑**，直接复用 `DataPage` 的导出能力或改为跳转到该页即可。

> 📝 **备忘录无独立页面**：`memo` 模块没有 `MemoPage.js`，备忘入口集成在首页（`HomePage`）——顶部「快速备忘」输入框（回车即存）+ 首页「最近备忘」卡片。阶段 0~3 总结文档中出现的 `MemoPage.js` 引用为笔误，实际文件不存在。

---

## 7. 数据库模型（Prisma Schema）

数据库：SQLite（文件位置 `D:\荒天帝工作台\data\workbench.db`）。

### 7.1 表清单（14 张业务表）

| 表名 (DB) | 模型 (Prisma) | 模块 | 核心字段 | 软删除 | 索引 |
|----------|--------------|------|---------|--------|------|
| `memos` | Memo | 备忘 | content | ✅ | — |
| `todos` | Todo | 待办 | title, category, priority, status, todoDate, completedAt, sortOrder | ✅ | todoDate, status, category |
| `projects` | Project | 项目 | customerName, phase, securityDomains(JSON), priority, background, coreRequirements, startDate, expectedEndDate, progress | ✅ | phase |
| `project_milestones` | ProjectMilestone | 里程碑 | projectId→Project, name, dueDate, completed, sortOrder | ✅ | projectId, dueDate |
| `project_tasks` | ProjectTask | 项目任务 | projectId→Project, name, completed, sortOrder | ✅ | projectId |
| `dev_projects` | DevProject | 开发项目 | name, description, status, techStack(JSON), todoItems(JSON) | ✅ | status |
| `dev_snippets` | DevSnippet | 代码片段 | name, category, code, remark | ✅ | category |
| `dev_issues` | DevIssue | 开发问题 | title, status, symptom, investigation, solution | ✅ | status |
| `entertainments` | Entertainment | 娱乐 | name, type, status, rating(0-5), progress, review | ✅ | type, status |
| `study_records` | StudyRecord | 学习记录 | type, techDirection, topic, notes, source, duration, studyDate | ✅ | type, studyDate |
| `study_pendings` | StudyPending | 待学清单 | resourceType, title, sourceLink, remark, completed | ✅ | completed |
| `reviews` | Review | 复盘 | type(week/project), weekKey, projectId, autoData(JSON), highlights, pitfalls, reusableExperience, improvements, customerPainPoints, presentationHighlights, exposedWeakness, reusableTips, reviewResult | ✅ | type, weekKey, projectId |
| `secrets` | Secret | 凭据 | name, type, content, usageScenario, remark, expiryDate | ✅ | type |
| `deployments` | Deployment | 部署 | name, envType, deviceType, ipAddress, config, steps, commands, remark | ✅ | envType |

### 7.2 通用约定

- **ID 类型**：`String` + `@default(cuid())`
- **时间字段**：`createdAt @default(now())` + `updatedAt @updatedAt` + `deletedAt DateTime?`（软删除）
- **排序字段**：`sortOrder Int @default(0)`（升序在前）
- **枚举字段**：用 `String` 而非原生 enum（SQLite 不支持 enum，且便于后续扩展）
- **JSON 字段**：`String` + `@default("[]")`，由应用层序列化为 JSON（如 `securityDomains`、`techStack`、`todoItems`、`autoData`）
- **日期字段**：用 `String`（`YYYY-MM-DD`），便于按字符串筛选

### 7.3 关系

```
Project 1 ─┬─ N ProjectMilestone（onDelete: Cascade）
           └─ N ProjectTask      （onDelete: Cascade）
```

其他表之间无外键关系（业务上不强制）。

---

## 8. 主要业务模块清单与接口矩阵

### 8.1 已完成模块

| 模块 | 后端 router 路径 | 主要接口 |
|------|----------------|---------|
| **system** | `/api/v1/system` | `GET /health`、`GET /statistics`、`GET /data-stats`、`GET /data/export`、`POST /data/import`、`POST /data/clear` |
| **memo** | `/api/v1/memos` | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| **todo** | `/api/v1/todos` | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id`、`POST /:id/toggle`、`POST /migrate/today-to-tomorrow`、`POST /migrate/tomorrow-to-today`、`POST /migrate`（自定义日期迁移） |
| **project** | `/api/v1/projects` | `GET /`（带筛选）、`GET /:id`（含 milestones+tasks）、`POST /`、`PUT /:id`、`PATCH /:id/memo`（失焦自动保存）、`DELETE /:id`、`POST /:id/generate-review` |
| **milestone** | `/api/v1/milestones` | `GET /`（按 projectId）、`GET /:id`、`POST /`、`PUT /:id`、`POST /:id/toggle`、`DELETE /:id` |
| **task** | `/api/v1/tasks` | `GET /`（按 projectId）、`GET /:id`、`POST /`、`PUT /:id`、`POST /:id/toggle`、`DELETE /:id` |
| **dev-project** | `/api/v1/dev-projects` | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| **dev-snippet** | `/api/v1/dev-snippets` | `GET /`（按 category 聚合）、`GET /categories`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| **dev-issue** | `/api/v1/dev-issues` | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| **study-record** | `/api/v1/study-records` | `GET /`（按 type/techDirection 筛选）、`GET /stats`（周/月时长）、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| **study-pending** | `/api/v1/study-pendings` | `GET /`（按 completed 筛选）、`GET /:id`、`POST /`、`PUT /:id`、`POST /:id/complete`（**标记已学习 → 自动创建学习记录**）、`DELETE /:id` |
| **entertainment** | `/api/v1/entertainments` | `GET /`（按 type/status 筛选）、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id`、`GET /random`（随机推荐） |
| **review** | `/api/v1/reviews` | `GET /`（按 type/weekKey/projectId 筛选）、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| **secret** | `/api/v1/secrets` | `GET /`（按 type 筛选 + keyword 搜索）、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| **deployment** | `/api/v1/deployments` | `GET /`（按 envType 筛选）、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |

### 8.2 模块完成状态（截至 2026-08-10）

全部 **15 个后端路由模块 + 10 个前端页面** 均已实现并通过验收，无占位空壳：

- 阶段 0~3 模块：`system` / `memo` / `todo` / `project` / `milestone` / `task` / `dev-project` / `dev-snippet` / `dev-issue` / `study-record` / `study-pending`（§8.1 已列）
- 阶段 4 模块：`entertainment`（游戏娱乐）、`review`（复盘与沉淀）
- 阶段 5 模块：`secret`（凭据保险箱）、`deployment`（部署记录）
- 阶段 6 模块：`system` 的 `data`（数据导出/导入/清空）、`backup`（备份管理）、`settings`（系统设置），对应前端 `DataPage` / `SettingsPage`

> 注：早期文档曾将 `data` 误标为「未完成」，实际阶段 6 已完成；`EntertainmentPage` / `ReviewPage` / `SecretPage` / `DataPage` 也均已在对应阶段实现，请勿再当作空壳补做。

---

## 9. 关键类、函数、组件速查

### 9.1 后端关键类

| 路径 | 名称 | 职责 |
|------|------|------|
| `src/server.js` | `startServer()` | 启动主流程编排 |
| `src/app.js` | `createApp()` | Express 应用工厂 |
| `src/bootstrap.js` | `bootstrap()` | 启动自检 + 自动备份 |
| `src/database/prisma.js` | `prisma`（单例）、`connectDatabase()`、`disconnectDatabase()` | Prisma 客户端管理 |
| `src/database/base.repository.js` | `BaseRepository` | 通用 CRUD 基类 |
| `src/common/error.js` | `BusinessError` | 业务错误类 |
| `src/common/logger.js` | `logger`（Winston） | 全局日志实例 |
| `src/common/utils/date.js` | `formatDate` / `today` / `tomorrow` / `startOfWeek` / `endOfWeek` / `startOfMonth` / `endOfMonth` / `getWeekKey` / `daysBetween` / `relativeTime` / `getWeekdayName` | ⚠️ **所有日期格式化必须走这里，禁止 `toISOString().split('T')[0]`** |
| `src/common/utils/port.js` | `isPortAvailable`、`findAvailablePort` | 端口冲突自动顺延 |
| `src/common/utils/browser.js` | `openBrowser(url)` | 跨平台打开浏览器（Win/macOS/Linux） |
| `src/common/utils/file.js` | `ensureDir` / `copyFile` / `copyDir` / `getDirSize` / `formatSize` / `cleanDir` | 文件操作工具 |
| `src/middleware/response.js` | `responseMiddleware` | 注入 `res.success(data, msg)` 和 `res.fail(code, msg, data)` |
| `src/middleware/errorHandler.js` | `notFoundHandler`、`errorHandler` | ZodError / BusinessError / Prisma Error 分类 |
| `src/middleware/requestLog.js` | `requestLogMiddleware` | 记录每个 API 耗时 + 状态码（4xx warn / 5xx error） |
| `src/modules/system/system.service.js` | `SystemService.healthCheck()` / `getStatistics()` / `getDataStats()` | 供首页使用 |
| `src/modules/study-pending/study-pending.service.js` | `StudyPendingService.completeAndConvert(payload)` | **最复杂业务点**：标记已学习→自动创建学习记录，含数据迁移（`topic←title`、`source←sourceLink`） |
| `src/modules/study-record/study-record.repository.js` | `StudyRecordRepository.sumWeekDuration()` / `sumMonthDuration()` | 统计周/月学习时长 |
| `src/modules/todo/todo.service.js` | `TodoService.migrateTodayToTomorrow()` / `migrateTomorrowToToday()` / `migrateCustom(date)` | 双向迁移 + 自定义日期迁移 |
| `src/modules/project/project.service.js` | `ProjectService.updateMemo(id, memo)`（失焦自动保存）、`generateReview(id)`（自动填充复盘草稿）、`updateProgress(id)`（根据任务完成度自动计算） | 项目核心业务 |
| `src/modules/system/backup.service.js` | `BackupService.list()` / `create()` / `download()` / `remove()` | SQLite 备份管理（启动自动备份 + 保留最近 N 个） |
| `src/modules/system/data.service.js` | `DataService.exportAll()` / `importAll()` / `clearByType()` | 全量 JSON 导出/导入/分类清空 |
| `src/modules/system/settings.service.js` | `SettingsService.get()` / `update()` | 系统设置读写 |
| `src/modules/entertainment/entertainment.service.js` | `EntertainmentService.randomPick()` | 游戏娱乐：随机推荐 |
| `src/modules/review/review.service.js` | `ReviewService.list()` / `create()` / `update()` / `delete()` | 复盘：周/项目复盘 |
| `src/modules/secret/secret.service.js` | `SecretService.list()` / `create()` / `update()` / `delete()` | 凭据：脱敏由前端控制显示 |
| `src/modules/deployment/deployment.service.js` | `DeploymentService.list()` / `create()` / `update()` / `delete()` | 部署记录：环境筛选 |

### 9.2 前端关键函数/组件

| 路径 | 名称 | 职责 |
|------|------|------|
| `js/app.js` | `App`（根组件）、`NAV_ITEMS`（9 项导航）、`LOGO_SVG` | 应用骨架 |
| `js/router.js` | `registerRoute`、`parseHash`、`matchRoute`、`navigate`、`renderRoute`、`initRouter` | 路由注册、解析、匹配、渲染 |
| `js/api.js` | `request()`、`get/post/put/patch/del`、`showToast()` | 统一请求 |
| `js/store/appStore.js` | `useAppStore` | 导航/版本/数据总数 |
| `js/store/dataStore.js` | `useDataStore` | 业务数据 + 10 个模块的 CRUD action |
| `js/components/HtpModal.js` | `HtpModal` | 通用弹窗（**props.visible 默认 false，emits: 'update:visible' / 'confirm' / 'cancel'**） |
| `js/utils/copy.js` | `copyToClipboard(text)` | **双保险**：优先 `navigator.clipboard.writeText`，失败降级到隐藏 `textarea` + `execCommand('copy')` |
| `js/utils/date.js` | `htdDate.{formatDate, today, tomorrow, daysBetween, getWeekdayName, getGreeting, relativeTime, formatDateTime}` | 前端日期工具 |
| `js/modules/HomePage.js` | `HomePage` | 首页：问候语 + 4 个统计卡片 + 高优先级待办 + 即将到期里程碑 + 快速备忘 + 明日计划预览 |
| `js/modules/TodoPage.js` | `TodoPage` | 待办：今/明/历史 三标签 + 分类/优先级筛选 + 勾选 + 双向迁移 |
| `js/modules/ProjectPage.js` | `ProjectPage` | 项目：左右分栏 + 阶段/安全领域筛选 + 里程碑/任务/备忘 + 生成复盘 |
| `js/modules/DevelopPage.js` | `DevelopPage` | 开发工作：3 标签 + 状态/分类筛选 + 代码片段一键复制 |
| `js/modules/StudyPage.js` | `StudyPage` | 学习：2 标签 + 周/月统计 + 标记已学习弹窗 |
| `js/modules/EntertainmentPage.js` | `EntertainmentPage` | 游戏娱乐：列表 + 类型/状态筛选 + 评分/进度 + 随机推荐 |
| `js/modules/ReviewPage.js` | `ReviewPage` | 复盘：周复盘（只读模板填空）/ 项目复盘（关联项目自动填充） |
| `js/modules/SecretPage.js` | `SecretPage` | 凭据保险箱：列表 + 脱敏显示 + 搜索 + 复制内容 |
| `js/modules/DataPage.js` | `DataPage` | 数据与部署：部署记录 CRUD + 本 APP 数据管理（导出/导入/清空）+ 备份管理 |
| `js/modules/SettingsPage.js` | `SettingsPage` | 系统设置：外观/数据路径/备份计划/运行端口（PRD 外新增页） |

---

## 10. 依赖关系图

### 10.1 后端模块依赖

```
server.js
  └─ app.js ─────────┬─ middleware/* ─┬─ common/error.js ─┬─ constants/*
  │                  │                │                    └─ utils/...
  │                  │                └─ common/logger.js
  │                  │
  │                  └─ modules/*（每个模块独立）
  │                       ├─ <name>.router.js
  │                       ├─ <name>.controller.js ── service.js ─┬─ repository.js ─┬─ base.repository.js
  │                       │                                       │                  └─ prisma.js
  │                       └─ <name>.schema.js                     └─ common/utils/date.js
  │                                               
  ├─ bootstrap.js
  ├─ database/prisma.js ──── common/logger.js + config/app.config.js
  └─ common/utils/port.js / browser.js

config/*
  └─ app.config.js（被 db.config.js / logger.js / prisma.js 引用）
```

**依赖原则**：单向依赖（外层 → 内层），无循环依赖。每个业务模块独立，可单独新增/删除。

### 10.2 前端依赖

```
index.html（按顺序加载）
  ├─ assets/lib/         第三方：Vue + Pinia + vue-demi
  ├─ store/index.js → appStore.js → dataStore.js
  ├─ utils/              date / copy / common
  ├─ api.js              依赖 window.showToast（自己定义）
  ├─ router.js           依赖 window.__htdApp（app.js 挂载）
  ├─ components/         HtpXxx（无业务依赖）
  ├─ modules/            XxxPage（依赖 store / api / router / components）
  └─ app.js              入口：创建 Vue 应用、注册组件、挂载
```

**加载顺序硬性要求**（在 `index.html` 中）：
1. Vue / Pinia 必须先于 store
2. store 必须先于 api、components、modules
3. api 必须先于 components（`HtpSelect` 等可能间接用到）
4. modules 必须先于 app.js

**新增业务页面**时必须 3 处注册：
1. `js/store/dataStore.js`：新增 `fetchXxx / createXxx / updateXxx / deleteXxx` 4 个 action
2. `js/router.js`：`registerRoute('/xxx', { title, module: 'xxx' })`
3. `index.html` `<script>` 引用（按依赖顺序）
4. `js/app.js` `NAV_ITEMS` 加导航项

---

## 11. 跨模块联动场景

| 触发 | 动作 | 目标模块 | 实现位置 |
|------|------|---------|---------|
| **项目管理** → 「生成项目复盘」按钮 | 调用 `POST /projects/:id/generate-review`，后端自动创建复盘草稿（填充客户名、项目周期），然后**前端需跳转到 `/review`** | 复盘与沉淀 | `project.controller.js` → `review` 表 |
| **今日工作** → 「一键迁移未完成到明日」 | 调用 `POST /todos/migrate/today-to-tomorrow`，将今日 `pending` 状态项的 `todoDate` 改为明天 | 明日计划 | `todo.service.js` |
| **今日工作** → 「一键迁移明日到今日」 | 调用 `POST /todos/migrate/tomorrow-to-today` | 今日工作 | 同上 |
| **待学清单** → 「标记已学习」按钮 | 调用 `POST /study-pendings/:id/complete`，**后端事务内**：1) 更新 pending.completed=true 2) 创建 studyRecord（`topic←title`、`source←sourceLink`、其他字段由表单输入） | 充电学习-学习记录 | `study-pending.service.js#completeAndConvert` |
| **全局顶部** → 「快速备忘」回车 | 调用 `POST /memos`，自动刷新首页统计 | 首页 + 备忘 | `dataStore.createMemo()` |
| **首页** → 4 个统计卡片 | 点击跳转到对应模块 | 项目/开发/学习/待办 | `HomePage.js` 中 `goProject / goDevelop / goStudy / goTodo` |
| **首页** → 「即将到期里程碑」 | 跳转到项目管理（项目详情可看具体里程碑） | 项目管理 | `system.service.js#getStatistics` |

---

## 12. 项目运行方式

### 12.1 环境要求

| 项 | 要求 |
|----|------|
| Node.js | **v24 LTS（严禁 v22）** |
| 安装位置 | `D:\softwareInstall\nodejs`（推荐） |
| 数据库 | SQLite（Node 内置，无需安装） |
| 浏览器 | 任意现代浏览器（Chrome/Edge 推荐） |
| 端口 | 17388（被占用自动顺延） |

### 12.2 首次启动

```bash
# 1. 进入后端目录
cd D:\WorkSpace\荒天帝的APP\backend

# 2. 安装依赖（首次）
npm install

# 3. 初始化数据库（首次）
npx prisma generate
npx prisma db push

# 4. 启动开发模式（带热重载）
npm run dev
```

启动成功日志：
```
========================================
  荒天帝工作台已启动
  访问地址: http://127.0.0.1:17388
  API 前缀: /api/v1
  数据目录: D:\荒天帝工作台
  运行环境: development
========================================
```

500ms 后自动打开浏览器。

### 12.3 日常启动

```bash
# 直接启动
cd D:\WorkSpace\荒天帝的APP\backend
npm run dev
```

> ⚠️ **必须用 `npm run dev`**（`node --watch`），不要用 `npm start`，否则修改代码不会自动重载。

### 12.4 验证服务正常

```powershell
# 健康检查
curl.exe -s http://127.0.0.1:17388/api/v1/system/health
# 期望: {"code":0,"msg":"success","data":{"status":"ok",...}}

# 首页统计
curl.exe -s http://127.0.0.1:17388/api/v1/system/statistics
# 期望: {"code":0,"data":{"projectCount":0,"devIssueCount":0,...}}
```

### 12.5 浏览器访问

- **首页**：http://127.0.0.1:17388/
- **API Base**：http://127.0.0.1:17388/api/v1/

### 12.6 停止服务

- `Ctrl + C` 触发 SIGINT，5 秒内优雅关闭
- 超时则强制退出

### 12.7 打包为单 .exe（阶段 7，Windows 已验收）

```bash
npm run build:win
# 产出: build/荒天帝工作台.exe（双击即运行，无需 Node 环境）
# 首次启动会自动初始化数据库模板
```

---

## 13. 数据目录、配置、备份策略

### 13.1 数据目录结构

```
D:\荒天帝工作台\
├── data\
│   ├── workbench.db         # 主数据库
│   ├── workbench.db-journal # SQLite 临时日志（运行中）
│   └── workbench.db.backup  # （备用）
├── logs\
│   ├── workbench.log        # 所有日志
│   └── error.log            # 错误日志
└── backups\
    ├── workbench_20260808.db
    ├── workbench_20260809.db
    └── ...（保留最近 7 个，超出自动清理）
```

### 13.2 关键配置

| 配置 | 位置 | 默认值 | 备注 |
|------|------|--------|------|
| 数据库路径 | `config/app.config.js#dbPath` | `D:\荒天帝工作台\data\workbench.db` | 可通过 `HTD_DATA_ROOT` 覆盖 |
| 数据库 URL | `config/db.config.js#url` | `file:...workbench.db` | 自动从 dbPath 拼接 |
| 端口 | `config/app.config.js#port` | 17388 | 可通过 `HTD_PORT` 覆盖 |
| 自动备份 | `config/db.config.js#backup.autoBackupOnStart` | true | 启动时自动备份 |
| 备份保留 | `config/db.config.js#backup.maxBackups` | 7 | 超出自动删除 |
| API 前缀 | `config/app.config.js#apiPrefix` | `/api/v1` | |
| 主机 | `config/app.config.js#host` | `127.0.0.1` | 仅本机访问 |
| 软删除字段 | `config/db.config.js#softDeleteField` | `deletedAt` | |
| 默认分页 | `config/db.config.js#pagination` | page=1, pageSize=20, max=100 | |

### 13.3 环境变量（`backend/.env`）

```bash
DATABASE_URL="file:D:\荒天帝工作台\data\workbench.db"
NODE_ENV=development
HTD_PORT=17388
```

注意：`prisma.js` 启动时**显式设置** `process.env.DATABASE_URL = file:...`，**绕过 .env 编码问题**（中文路径在某些环境下会乱码）。

---

## 14. 当前开发进度

### 14.1 阶段总览（截至 2026-08-10）

| 阶段 | 名称 | 后端 | 前端 | 验收 |
|------|------|------|------|------|
| 0 | 环境搭建 + 基础骨架 | ✅ | ✅ | ✅ |
| 1 | 生活规划（Todo + Memo） | ✅ | ✅ | ✅ |
| 2 | 核心业务（项目管理 + 售前定制） | ✅ | ✅ | ✅ |
| 3 | 效率成长（开发工作 + 充电学习） | ✅ | ✅ | ✅ |
| 4 | 娱乐放松 + 复盘中心 | ✅ | ✅ | ✅ |
| 5 | 个人工具箱（密码）+ 部署记录 | ✅ | ✅ | ✅ |
| 6 | 数据管理 + 系统设置 | ✅ | ✅ | ✅ |
| 7 | 最终集成 + 打包交付 | 🟡 | 🟡 | 部分完成：集成/性能/路由/配置完成，exe 待运行时下载 |

### 14.2 已实现接口能力（按模块）

#### system（✅）
- `GET /health` — 健康检查
- `GET /statistics` — 首页聚合（项目数/待解决问题/今日未完成/本周学习时长/备忘数/即将到期里程碑/最近备忘/明日计划预览）
- `GET /data-stats` — 各表条目总数（供数据管理页 + 侧边栏统计）
- `GET /data/export`、`POST /data/import`、`POST /data/clear` — JSON 导出/导入/分类清空
- `GET /backups`、`POST /backups`、`GET /backups/:fileName/download`、`DELETE /backups/:fileName` — SQLite 备份管理
- `GET /settings`、`PUT /settings` — 系统设置

#### memo（✅）
- 完整 CRUD，`GET /` 按 `createdAt desc`，可加 `?limit=N` 取最近

#### todo（✅）
- 完整 CRUD
- `POST /:id/toggle` 切换完成状态（自动写 `completedAt`）
- `POST /migrate/today-to-tomorrow` — 今日未完成 → 明日
- `POST /migrate/tomorrow-to-today` — 明日 → 今日
- `POST /migrate { date: 'YYYY-MM-DD' }` — 自定义日期迁移
- `GET /?date=YYYY-MM-DD` 历史回看

#### project（✅）
- 完整 CRUD
- 筛选：phase / priority / securityDomain / keyword
- `GET /:id` 返回 `milestones + tasks` 关联
- `PATCH /:id/memo` 项目备忘失焦自动保存
- `POST /:id/generate-review` 一键生成项目复盘草稿（**review 表中新增 type='project' 的记录，自动填充客户名、起止日期等基础信息**）
- **项目进度自动计算**：service 内根据里程碑 + 任务完成度更新 `progress` 字段

#### milestone（✅）
- 按 projectId 查询
- 完整 CRUD
- `POST /:id/toggle` 切换完成状态

#### task（✅）
- 按 projectId 查询
- 完整 CRUD
- `POST /:id/toggle`

#### dev-project（✅）
- 完整 CRUD
- 筛选：status / keyword
- `techStack`（JSON 数组）、`todoItems`（JSON 数组）

#### dev-snippet（✅）
- 完整 CRUD
- 按 category 筛选
- `GET /categories` 返回已使用的分类列表

#### dev-issue（✅）
- 完整 CRUD
- 按 status 筛选
- 首页 `devIssueCount` 只计「待解决 + 排查中」

#### study-record（✅）
- 完整 CRUD
- 筛选：type / techDirection
- `GET /stats` 返回 `{ weekHours, monthHours }`

#### study-pending（✅）
- 完整 CRUD
- 按 completed 筛选
- **`POST /:id/complete`** — 标记已学习并自动创建学习记录（事务内）
  - 信息映射：`title → topic`、`sourceLink → source`、`resourceType → techDirection`（兜底）
  - 表单字段：type / techDirection / duration / studyDate / notes
  - 返回 `{ pending, record }`

#### entertainment（✅）
- 完整 CRUD
- 筛选：type / status
- `GET /random` 随机推荐（首页/娱乐页「随便来一个」）

#### review（✅）
- 完整 CRUD
- 筛选：type（week/project）/ weekKey / projectId
- `type='project'` 记录由 `project.generate-review` 自动创建草稿

#### secret（✅）
- 完整 CRUD
- 筛选：type
- keyword 搜索（name / usageScenario / remark）
- 内容脱敏由前端控制（点击「显示」才明文，复制走 `copyToClipboard`）

#### deployment（✅）
- 完整 CRUD
- 筛选：envType（开发/测试/生产）
- 字段：设备类型 / IP / 配置 / 步骤 / 命令

### 14.3 当前状态

| 优先级 | 任务 | 估计工时 | 说明 |
|--------|------|---------|------|
| ✅ | Windows exe 构建与干净环境验收 | 已完成 | 单文件 exe 可脱离 Node.js 启动并完成 HTTP/持久化验证 |
| ⏸ | macOS 构建物 | 本版本范围外 | 按当前需求不构建 |
| ⏸ | Windows 安装包 / 便携版 | 可选 | 当前交付为单个 exe |

---

## 15. 踩坑清单与硬性约束

> 以下是从阶段 0~3 开发中沉淀的「永久性约束」，违反必出 bug。

### 🔴 硬性约束 1：日期格式化

```js
// ❌ 严禁（UTC 时区，东八区会偏移 1 天）
date.toISOString().split('T')[0]

// ✅ 必须使用
import { formatDate } from '../common/utils/date.js';  // 后端
// 或
htdDate.formatDate(date);  // 前端
```

**适用范围**：所有拼接到 SQL `where` 子句的日期字符串（`todoDate`、`dueDate`、`studyDate` 等），以及「本周/本月/7 天内/明日」范围统计。

**例外**：`system.healthCheck` 返回的 `timestamp` 故意用 ISO 格式（UTC）。

### 🔴 硬性约束 2：HtpModal 使用

```html
<!-- ❌ 错误：visible 默认 false，弹窗不显示；close 事件不存在 -->
<htp-modal v-if="modalVisible" @close="...">
  ...
</htp-modal>

<!-- ✅ 正确 -->
<htp-modal
  v-if="modalVisible"
  :visible="true"           <!-- 必须显式传 true -->
  :title="..."
  @cancel="modalVisible = false"   <!-- 取消事件是 cancel，不是 close -->
  @confirm="submitForm"
>
  ...
</htp-modal>
```

组件定义：`emits: ['update:visible', 'confirm', 'cancel']`，关闭按钮调用 `handleClose() → $emit('cancel')`。

### 🔴 硬性约束 3：Vue 3 Global Build 模板限制

```html
<!-- ❌ 错误：模板不支持可选链，会静默失败（页面空白无报错） -->
<htp-tag :type="item?.meta?.type">{{ item?.name }}</htp-tag>

<!-- ✅ 正确：封装到 setup() 的纯函数中 -->
<!-- setup() -->
function getTagType(item) {
  if (!item || !item.meta) return 'default';
  return item.meta.type;
}
<!-- 模板 -->
<htp-tag :type="getTagType(item)">{{ item.name }}</htp-tag>
```

**全局构建版**（`vue.global.prod.js`）的模板编译器只支持子集，不支持 ES2020 可选链 `?.` 和空值合并 `??`。

### 🔴 硬性约束 4：Fetch 必须 `cache: 'no-store'`

```js
// ✅ 必须保留在统一请求封装中
const config = {
  ...options,
  cache: 'no-store',  // 禁用浏览器 HTTP 缓存
  headers: { ...defaultHeaders, ...options.headers },
};
```

**原因**：统计类接口（`/study-records/stats`、`/system/statistics`）必须返回最新值，否则会出现「新建学习记录后统计不变」的 bug。

### 🔴 硬性约束 5：Node.js 版本必须是 24 LTS

```bash
node -v  # 必须是 v24.x.x，v22 会导致 Prisma 兼容问题
```

### 🔴 硬性约束 6：后端启动必须用 `npm run dev`

```bash
# ✅ 正确（带热重载，文件变更自动重启）
npm run dev

# ❌ 错误（不会热重载，修改代码不生效）
npm start
```

`dev` 脚本：`node --watch src/server.js`（Node 24 内置 watch）。

### 🔴 硬性约束 7：Node 版本/路径问题

- 沙箱环境可能禁止访问 `D:\荒天帝工作台\` 下的 `*.db-journal`、`*.log`、`*.db`，写入数据库时需要用 `dangerouslyDisableSandbox: true`。
- 数据库路径必须使用**绝对路径**指向 `D:\荒天帝工作台\data\workbench.db`，不要写相对路径。
- `prisma.js` 显式设置 `process.env.DATABASE_URL` 绕过中文路径编码问题。

### 🔴 硬性约束 8：新增模块必做 3 件事

1. **后端**：`modules/<name>/` 4 个文件（router / controller / service / repository + schema.js）
2. **后端**：`app.js` 注册路由 `app.use('/api/v1/<name>s', <name>Router)`
3. **前端**：`dataStore.js` 新增 4 个 action（fetch / create / update / delete）
4. **前端**：`router.js` 注册路由
5. **前端**：`index.html` 按依赖顺序 `<script>` 引用新页面
6. **前端**：`app.js` `NAV_ITEMS` 加导航项

### 🔴 硬性约束 9：新增模块必带 Zod Schema

后端所有 `service.create / update` 必须先 `xxxSchema.parse(payload)`，防止脏数据写入。

### 🔴 硬性约束 10：高危操作必须二次确认

前端所有删除（单条 / 清空 / 导入覆盖）必须用 `HtpModal` 二次确认弹窗，参照 `HomePage` 的 `confirmDelMemo` 模式。

### 🔴 硬性约束 11：数据清理外键顺序

```js
// ✅ 正确顺序：子表 → 父表
// 项目相关：projectTask → projectMilestone → review → project
// 然后：todo → memo → devProject → devSnippet → devIssue → studyRecord → studyPending
```

注意 Prisma JS client 使用 **camelCase**（`prisma.projectTask.deleteMany`）。

### 🟡 踩坑：PowerShell 中执行 curl

```powershell
# ❌ PowerShell 的 curl 是 Invoke-WebRequest 的别名
curl http://...  # 实际是 Invoke-WebRequest

# ✅ 正确
curl.exe -s http://127.0.0.1:17388/api/v1/system/health

# ❌ PowerShell 不支持 &&
npm install && npm run dev

# ✅ 用 ;
npm install; npm run dev

# ❌ POST JSON 时引号转义麻烦
curl -X POST -d '{"name":"test"}'

# ✅ 先写文件再 --data
$json = '{"name":"test"}' | Out-File -Encoding UTF8 req.json
curl.exe -X POST --data "@req.json" -H "Content-Type: application/json" http://...
```

---

## 16. 后续路线图（历史）

> 本路线图（阶段 4~7）已在 **2026-08-10 前全部交付完成**，此处保留作为历史演进记录。当前项目进入维护与版本迭代期；新增需求请参考第 8 / 14 节的模块清单扩展。

```
阶段 4（1.5 天）
  ├─ P0：ReviewPage 前端（2 标签：周复盘 / 项目复盘）
  │       - 周复盘：自动拉 system.statistics 当周数据（只读）
  │       - 周复盘：4 模板填空区（亮点/踩坑/经验/改进）
  │       - 项目复盘：列表 + 关联项目自动填充
  │       - 阶段 2 收尾线头
  ├─ P1：Entertainment 全栈
  │       - 后端 4 层（CRUD + 类型/状态筛选）
  │       - 前端 EntertainmentPage
  │       - 增强：「随机推荐」「今日轮播」
  └─ 验收 + 清空数据

阶段 5（1.5 天）
  ├─ Secret 模块全栈（CRUD + 脱敏 + 搜索 + 加解密预留）
  └─ Deployment 模块全栈（CRUD + 环境筛选）

阶段 6（1 天）
  ├─ DataPage 前端（部署记录 + 系统数据管理）
  ├─ 数据导出（全量 JSON）
  ├─ 数据导入（JSON 校验 + 覆盖）
  ├─ 数据清空（分类别 + 二次确认）
  └─ 系统设置（外观/数据路径/备份计划）

阶段 7（1 天）
  ├─ 全量回归测试
  ├─ @yao-pkg/pkg 打包配置
  ├─ Windows .exe 输出
  └─ 用户使用说明文档
```

---

## 17. 附录：API 完整路径速查

| 路径前缀 | 模块 | 完整路由 |
|---------|------|---------|
| `/api/v1/system` | system | `GET /health`、`GET /statistics`、`GET /data-stats` |
| `/api/v1/memos` | memo | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| `/api/v1/todos` | todo | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id`、`POST /:id/toggle`、`POST /migrate/today-to-tomorrow`、`POST /migrate/tomorrow-to-today`、`POST /migrate` |
| `/api/v1/projects` | project | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`PATCH /:id/memo`、`DELETE /:id`、`POST /:id/generate-review` |
| `/api/v1/milestones` | milestone | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`POST /:id/toggle`、`DELETE /:id` |
| `/api/v1/tasks` | task | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`POST /:id/toggle`、`DELETE /:id` |
| `/api/v1/dev-projects` | dev-project | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| `/api/v1/dev-snippets` | dev-snippet | `GET /`、`GET /categories`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| `/api/v1/dev-issues` | dev-issue | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| `/api/v1/study-records` | study-record | `GET /`、`GET /stats`、`GET /:id`、`POST /`、`PUT /:id`、`DELETE /:id` |
| `/api/v1/study-pendings` | study-pending | `GET /`、`GET /:id`、`POST /`、`PUT /:id`、`POST /:id/complete`、`DELETE /:id` |

---

## 文档维护说明

- 本文档随代码库演进同步更新
- 新增模块时，请同步更新：第 1 节模块表、第 4 节目录、第 8 节接口矩阵、第 9 节关键类、第 14 节进度
- 出现新踩坑时，请追加到第 15 节
- 文档路径：`D:\WorkSpace\荒天帝的APP\docs\Code-Wiki.md`

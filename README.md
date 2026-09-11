# 荒天帝工作台

本项目是一个完全本地运行的个人工作台，覆盖**工作 / 生活 / 知识 / 系统**四类场景，包含待办、项目、开发、会议、学习、娱乐、习惯、财务、阅读、复盘沉淀、漏洞/POC/投标/应急等安全售前相关模块，以及凭据保险箱、数据与部署、回收站等系统能力。

> 核心理念：**本地优先 / 离线可用 / 数据自主**。所有数据存于本机（默认 `D:\荒天帝工作台`），不依赖任何云端账户。

## 当前版本

**V1.5.0**（2026-09-11）｜**V2.0 重构进行中，尚未发版**

- 语义化版本仍为 1.5.0（V2.0 重构以补丁级累积提交推进，未做大版本号跳变）。
- V2.0 重构已落地：S1 注册自动化 / 状态机收敛 / 组件化 + S2-1 Vite 构建化（详见 `docs/产品迭代/V2.0-全面重构计划.md`）。

## 当前状态

- 后端测试：**427/427 通过（45 个测试文件，Node v24 LTS）**。
- P0 质量门禁 `npm run lint`：**22/22 通过**（validate-theme + visual-audit + verify-registry 三道）。
- 前端 **21 个业务模块**经 `frontend/js/registry.js` 单一数据源注册；后端 **28 个 Prisma 数据模型**。
- Windows 单文件运行程序（`build/荒天帝工作台.exe`，约 257MB）已完成独立启动、首页、接口、CRUD 与重启持久化验证。
- 多套外观切换：**Liquid Glass + Notion 极简平铺**，暗/亮双模式 + 装饰开关（CSS 变量覆盖层，零数据迁移）。
- 可视化与搜索：首页/学习/财务/项目四类手写 SVG 图表、跨模块搜索、字段/状态机配置平台、阅读模块。
- ⚠️ **首屏白屏尚待真浏览器目视确认**（本机构建链路已验证 `/=200`、dist 资源可达、entry.js 引入全部 21 页面模块顺序正确，但未经 Chromium 真实渲染）。

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | Node 24 LTS + Express 4 + Prisma 5.22 + SQLite（`sql.js`）+ winston / zod / cors / multer |
| 前端 | Vue 3 全局版（`window.Vue` / `window.Pinia`，不引入 npm 包）+ Pinia + Vite 构建化（单入口 `frontend/src/entry.js`，产物 `frontend/dist`，后端静态服务优先 `dist`、回退 `frontend/`） |
| 打包 | `@yao-pkg/pkg` 产出 Windows 单文件 exe（macOS 可 `npm run build:mac` 自构建） |

## 开发启动

```powershell
$env:Path = "D:\softwareInstall\nodejs;" + $env:Path
cd backend
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:17388/`（可用 `HTD_PORT` 覆盖端口、`HTD_DATA_ROOT` 指定数据目录，便于隔离测试）。首次启动自动初始化数据库结构，数据默认保存在 `D:\荒天帝工作台`。

## 测试与构建

```powershell
cd backend
npm test                 # 单元测试（vitest run），隔离于临时库，绝不直连生产库
npm run lint             # 三道门禁：validate-theme + visual-audit + verify-registry
npm run audit            # schema / 枚举 / 状态机可加载性门禁
npm run build:win        # 产出 Windows 单文件 exe
npm run build:mac        # （macOS 环境）产出 macOS 二进制
```

持续集成见 `.github/workflows/ci.yml`：lint + typecheck + test + build(win/mac) + launcher-test(macOS)，门禁全绿才允许合并/发布。

构建产物生成在项目内的 `build/` 目录，已被 Git 忽略。本地发布文件位于项目外 `D:\荒天帝工作台发布\荒天帝工作台.exe`。

## 前端模块（21 个，registry 单一数据源）

| 分组 | 模块 |
|---|---|
| 首页 | 首页总览 |
| 工作 | 今日/明日计划、项目管理、会议纪要、开发工作、POC 跟踪、投标档案、漏洞跟踪库、应急响应记录 |
| 生活 | 时间块/番茄钟、游戏娱乐、财务速记、习惯打卡 |
| 知识 | 充电学习、复盘与沉淀、沉淀 Vault、阅读资料 |
| 系统 | 凭据保险箱、数据与部署、回收站、系统设置 |

## 文档

文档体系按前缀分类（`基线-` 规划 / `手册-` 使用 / `报告-` 剖析 / `记录-` 演进 / `分析-` 专项）：

- [产品迭代演进计划](docs/产品迭代/产品迭代演进计划.md)（全栈演进总纲）
- [V2.0 全面重构计划](docs/产品迭代/V2.0-全面重构计划.md)
- [前端系统化设计](docs/产品迭代/前端系统化设计.md)（前端宪法）
- [后端系统化设计](docs/产品迭代/后端系统化设计.md)（后端宪法）
- [PRD](docs/基线%20-%20PRD.md)
- [第一版可执行开发计划](docs/基线%20-%20开发计划.md)
- [技术选型](docs/基线%20-%20技术选型.md)
- [Code-Wiki](docs/手册%20-%20Code-Wiki.md)
- [使用说明](docs/手册%20-%20使用说明.md)
- [开发进度](docs/记录%20-%20开发进度.md)
- [问题总结](docs/记录%20-%20问题总结.md)
- [版本更新](docs/记录%20-%20版本更新.md)

## Git 管理边界

提交源码、前端离线依赖、测试、脚本、Prisma schema、数据库模板和文档；不提交 `node_modules/`、`.env`、日志、运行数据库、`build/` 和本地 `.exe`。完整规则见 [.gitignore](.gitignore)。

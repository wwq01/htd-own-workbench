# 荒天帝工作台

本项目是一个完全本地运行的个人工作台，包含待办、项目、开发、学习、娱乐、复盘、凭据和部署记录等模块。

## 当前版本

**v1.4.0**（2026-08-23）

## 当前状态

- 阶段 0-7 Windows 开发与验收完成。
- 后端测试：**40 个测试文件，382/382 通过**（Node v24 LTS）。
- Windows 单文件运行程序已完成独立启动、首页、接口、CRUD 和重启持久化验证。
- macOS 启动器已提供（`build/launcher/荒天帝工作台.command`，双击即用，含端口顺延 17388→17389→17390、同源复用、升级前备份）；本版本暂不随发布包附带 macOS 预编译二进制，可在 macOS 环境 `npm run build:mac` 自构建。
- 新增 4 个业务模块（POC 跟踪 / 投标档案 / 漏洞跟踪库 / 应急响应记录）+ 多套外观切换（Liquid Glass + Notion 极简平铺，暗/亮双模式 + 装饰开关）。

## 开发启动

```powershell
$env:Path = "D:\softwareInstall\nodejs;" + $env:Path
cd backend
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:17388/`。首次启动会自动初始化数据库结构，数据默认保存在 `D:\荒天帝工作台`。

## 测试与构建

```powershell
cd backend
npm test                 # 单元测试（vitest run）
npm run lint             # 主题 + 视觉契约门禁（validate-theme + visual-audit）
npm run audit            # schema / 枚举 / 状态机可加载性门禁
npm run build:win        # 产出 Windows 单文件 exe
npm run build:mac        # （macOS 环境）产出 macOS 二进制
```

持续集成见 `.github/workflows/ci.yml`：lint + typecheck + test + build(win/mac) + launcher-test(macOS)，门禁全绿才允许合并/发布。

构建产物生成在项目内的 `build/` 目录，但该目录已被 Git 忽略。当前本地发布文件位于项目外的 `D:\荒天帝工作台发布\荒天帝工作台.exe`。

## 文档

- [第一版可执行开发计划](docs/荒天帝工作台 第一版可执行开发计划.md)
- [开发进度跟踪](docs/开发进度跟踪.md)
- [Code-Wiki](docs/Code-Wiki.md)
- [使用说明](docs/使用说明.md)
- [问题总结](docs/问题总结.md)
- [PRD](docs/荒天帝工作台 PRD（产品需求文档）.md)

## Git 管理边界

提交源码、前端离线依赖、测试、脚本、Prisma schema、数据库模板和文档；不提交 `node_modules/`、`.env`、日志、运行数据库、`build/` 和本地 `.exe`。完整规则见 [.gitignore](.gitignore)。

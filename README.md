# 荒天帝工作台

本项目是一个完全本地运行的个人工作台，包含待办、项目、开发、学习、娱乐、复盘、凭据和部署记录等模块。

## 当前状态

- 阶段 0-7 Windows 开发与验收完成。
- 后端测试：20 个测试文件，184/184 通过。
- Windows 单文件运行程序已完成独立启动、首页、接口、CRUD 和重启持久化验证。
- 本版本不提供 macOS 构建物。

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
npm test
npm run build:win
```

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

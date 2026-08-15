# OPEN-DECISIONS — 悬而未决登记册

> 专家团 SOP 要求：出现「定不下来 / 先放一放 / 等外部条件」时在此落条。
> 只追加 + 就地关闭（OPEN → RESOLVED，补 Resolution 字段）。

| Date | Source | Open Item | Related Constraints | Current Leaning | Blocked By | Resolves When | Status |
|------|--------|-----------|---------------------|-----------------|------------|---------------|--------|
| 2026-08-15 | Ardot 体检 §7.2 | Sarasa 字体加载方式（系统安装 or 打包 @font-face）+ Medium 回退策略 | 宪法：Sarasa 仅 Regular/Bold，禁用 Medium(500)；本地优先/离线可用/数据自主 | 已决：打包 @font-face 随 exe，Medium 500→600 回退 Bold | — | 已拍板 | RESOLVED（见 ADR-001） |
| 2026-08-15 | Ardot 体检 §7.2 边界说明 | 亮色主题锚点帧（渐变/光斑像素级对齐） | 锚点仅提供暗色 Frame；亮色沿用既有推导值 | 倾向 V1.4 多主题阶段统一补亮色锚点帧 | 等 V1.4 多主题启动 | V1.4 启动时 | OPEN（design-decision-to-evaluate） |
| 2026-08-15 | 用户澄清 + 打包实测 | Windows 打包目标 node22-win-x64 与「必须用 Node 24 LTS」硬约束冲突 | 硬约束：必须用 Node 24 LTS（v22 有 Prisma 兼容问题）；之前因没找到 24LTS 临时用 22 | 已决：升级为 **node24-win-x64**。本机 24LTS 在 `D:\softwareInstall\nodejs` v24.19.0；`@yao-pkg/pkg@6.22.0` 原生支持 node24（help/test 均含 node24）；实打 exe 成功（243MB，16:34）；node24 下 182/184 测试通过（backup 测试失败为本沙箱 safe-delete shim 拦截 `unlinkSync` 所致，与版本无关，真实环境通过）。mac 目标保持 `node22-macos-x64`（用户未提供 mac 24 路径，win 环境无法验证 mac 打包） | — | 已拍板 | RESOLVED |
| 2026-08-15 | 用户指令「顺手收掉 #A」+ 体检报告 §6 运行问题 | 启动脚本 `node --watch` 与「反复重启已弃用」矛盾，手册硬约束 6 仍强制 --watch，多处手册自相矛盾 | 硬约束：弃用 node --watch，直接 node 启动；文档内部自相矛盾 | 已决：dev 脚本改为 `node src/server.js`（与 start 等价，无热重载）；Code-Wiki 硬约束 6 / §12.3 / 使用说明 / 开发进度「后端启动」段统一为「直接启动、无热重载、改码手动重启」；历史文档（阶段总结）提及 --watch 的段落为弃用前认知，以本约束为准 | — | 已拍板 | RESOLVED |

| 2026-08-16 | V1.2 开发交付 | 命令面板 / 状态点 / 保存三态机 / 备份升级 UI / 启动器进程复用 等 V1.2 功能落地 | 无构建全局 Vue 宪法；本地优先/离线可用；node24 LTS；200/200 测试零回归 | 已全部随 V1.2.0 交付：前端 9 工具文件 + 3 组件（HtpCommandPalette/StatusDot/ConfirmPermanentDelete）+ uiStore 接入；后端 backup.service/controller/router + origin-guard/backup-trigger 中间件 + server.js 进程复用；200/200 测试 + exe 构建通过 | — | 已随 V1.2.0 交付 | RESOLVED |
| 2026-08-16 | V1.2 范围评审 | 完整软删除 / 回收站「三段式」（全 10 模块 `deletedAt` + 列表过滤 + 回收站视图 + 永久删除二次确认）未做 | 硬约束数据自主/本地优先；改动 Prisma schema 全模块迁移属数据模型变更，不在用户真实库上冒险 | 先交付安全可复用的 `ConfirmPermanentDelete` 组件作 P0 实物（永久删除二次确认已就位）；完整软删除 + 回收站视图 **defer 至 V1.3**（与数据模型重构一并做） | 需 Prisma schema 迁移 + 全 10 模块适配，属数据模型变更 | V1.3 启动数据模型重构时 | OPEN（deferred-to-V1.3） |

## ADR 索引

- [ADR-001](./ADR-001.md)：Sarasa 字体打包方案（@font-face 随 exe + Medium 回退 Bold）

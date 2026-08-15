# OPEN-DECISIONS — 悬而未决登记册

> 专家团 SOP 要求：出现「定不下来 / 先放一放 / 等外部条件」时在此落条。
> 只追加 + 就地关闭（OPEN → RESOLVED，补 Resolution 字段）。

| Date | Source | Open Item | Related Constraints | Current Leaning | Blocked By | Resolves When | Status |
|------|--------|-----------|---------------------|-----------------|------------|---------------|--------|
| 2026-08-15 | Ardot 体检 §7.2 | Sarasa 字体加载方式（系统安装 or 打包 @font-face）+ Medium 回退策略 | 宪法：Sarasa 仅 Regular/Bold，禁用 Medium(500)；本地优先/离线可用/数据自主 | 已决：打包 @font-face 随 exe，Medium 500→600 回退 Bold | — | 已拍板 | RESOLVED（见 ADR-001） |
| 2026-08-15 | Ardot 体检 §7.2 边界说明 | 亮色主题锚点帧（渐变/光斑像素级对齐） | 锚点仅提供暗色 Frame；亮色沿用既有推导值 | 倾向 V1.4 多主题阶段统一补亮色锚点帧 | 等 V1.4 多主题启动 | V1.4 启动时 | OPEN（design-decision-to-evaluate） |
| 2026-08-15 | 用户澄清 + 打包实测 | Windows 打包目标 node22-win-x64 与「必须用 Node 24 LTS」硬约束冲突 | 硬约束：必须用 Node 24 LTS（v22 有 Prisma 兼容问题）；之前因没找到 24LTS 临时用 22 | 已决：升级为 **node24-win-x64**。本机 24LTS 在 `D:\softwareInstall\nodejs` v24.19.0；`@yao-pkg/pkg@6.22.0` 原生支持 node24（help/test 均含 node24）；实打 exe 成功（243MB，16:34）；node24 下 182/184 测试通过（backup 测试失败为本沙箱 safe-delete shim 拦截 `unlinkSync` 所致，与版本无关，真实环境通过）。mac 目标保持 `node22-macos-x64`（用户未提供 mac 24 路径，win 环境无法验证 mac 打包） | — | 已拍板 | RESOLVED |
| 2026-08-15 | 用户指令「顺手收掉 #A」+ 体检报告 §6 运行问题 | 启动脚本 `node --watch` 与「反复重启已弃用」矛盾，手册硬约束 6 仍强制 --watch，多处手册自相矛盾 | 硬约束：弃用 node --watch，直接 node 启动；文档内部自相矛盾 | 已决：dev 脚本改为 `node src/server.js`（与 start 等价，无热重载）；Code-Wiki 硬约束 6 / §12.3 / 使用说明 / 开发进度「后端启动」段统一为「直接启动、无热重载、改码手动重启」；历史文档（阶段总结）提及 --watch 的段落为弃用前认知，以本约束为准 | — | 已拍板 | RESOLVED |

## ADR 索引

- [ADR-001](./ADR-001.md)：Sarasa 字体打包方案（@font-face 随 exe + Medium 回退 Bold）

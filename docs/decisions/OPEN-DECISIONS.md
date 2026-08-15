# OPEN-DECISIONS — 悬而未决登记册

> 专家团 SOP 要求：出现「定不下来 / 先放一放 / 等外部条件」时在此落条。
> 只追加 + 就地关闭（OPEN → RESOLVED，补 Resolution 字段）。

| Date | Source | Open Item | Related Constraints | Current Leaning | Blocked By | Resolves When | Status |
|------|--------|-----------|---------------------|-----------------|------------|---------------|--------|
| 2026-08-15 | Ardot 体检 §7.2 | Sarasa 字体加载方式（系统安装 or 打包 @font-face）+ Medium 回退策略 | 宪法：Sarasa 仅 Regular/Bold，禁用 Medium(500)；本地优先/离线可用/数据自主 | 已决：打包 @font-face 随 exe，Medium 500→600 回退 Bold | — | 已拍板 | RESOLVED（见 ADR-001） |
| 2026-08-15 | Ardot 体检 §7.2 边界说明 | 亮色主题锚点帧（渐变/光斑像素级对齐） | 锚点仅提供暗色 Frame；亮色沿用既有推导值 | 倾向 V1.4 多主题阶段统一补亮色锚点帧 | 等 V1.4 多主题启动 | V1.4 启动时 | OPEN（design-decision-to-evaluate） |

## ADR 索引

- [ADR-001](./ADR-001.md)：Sarasa 字体打包方案（@font-face 随 exe + Medium 回退 Bold）

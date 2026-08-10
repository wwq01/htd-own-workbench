# 荒天帝工作台 · Liquid Glass 视觉重构规范

> 本规范用于将「荒天帝工作台」从当前"扁平实心、缺层次"的外观，重构为对标 **macOS 最新版【天气】APP** 的 Liquid Glass（液态玻璃）风格。
> **仅外观改动，不影响任何功能。** 本文件是机器可读的执行依据，可跨会话 / 跨账号 / 跨 AI 复用。

---

## 0. 视觉锚点（Ardot 设计文件）

当接手 AI **已接入 Ardot MCP** 时，用它作为视觉对照（人工肉眼确认也用这个链接）：

- 文件 URL：`https://ardot.tencent.com/file/713415031333859`
- fileId：`713415031333859`
- Frame 节点：
  - ① 应用外壳 App Shell → `2:1`（玻璃侧栏 + 玻璃顶栏 + 内容区）
  - ② 组件库 Component Library → `2:102`（按钮 / 输入 / 标签 / 弹窗 / 列表 / 进度 / Toast）
  - ③ 项目管理页 → `2:159`（真实页面落地示例）

**引用指令（给连了 Ardot 的 AI）：**
```
请先执行 open_design(fileId:"713415031333859")，再 batch_read 节点
2:1 / 2:102 / 2:159，将画布作为视觉对照基准；实际代码改动以本规范第 2–8 节为准。
```

**引用指令（给执行 CSS 重构的 AI，无需 Ardot）：**
```
请先阅读 docs/视觉重构-LiquidGlass规范.md，按其令牌重映射表（第 2、3 节）与
各组件玻璃配方（第 6、7 节），仅修改 frontend/css/{global,components,pages}.css。
```

---

## 1. 设计目标与红线（硬约束）

**目标：** 对标 macOS 天气 APP 的 Liquid Glass——通透材质、空间分层、光影描边、放大圆角、精致交互反馈。

**红线（违反任意一条即视为失败）：**

1. **仅外观改动**：不得修改任何 `.js`、`index.html`、router、store、api、后端、数据库。
2. **class 名是契约**：不得新增 / 删除 / 重命名任何 CSS class，只允许"换皮"。
3. **保留全部变量**：`:root` 与 `html[data-theme="light"]` 的现有变量全部保留，在其基础上重映射，**不得删除**。
4. **双主题**：必须同时交付暗色与亮色两套主题（亮色主题需新增 glass 令牌）。
5. **兜底**：`backdrop-filter` 必须有 `@supports` 回退（不支持时回退为半透明实色）。
6. **文件范围**：只允许改 `frontend/css/global.css`、`frontend/css/components.css`、`frontend/css/pages.css`。

---

## 2. 设计令牌重映射表（global.css `:root` 暗色）

| 变量 | 旧值 | 新值（暗色） | 说明 |
|---|---|---|---|
| `--bg-deepest` | `#0B1220` | 渐变背景墙底色（见 §5） | 页面最底层改为分层渐变，不再纯色 |
| `--bg-page` | `#0F172A` | `rgba(13,18,32,0.55)` + `backdrop-filter` | 内容区底，半透明透出背景墙 |
| `--bg-card` | `#1E293B` | `rgba(255,255,255,0.10)` + `backdrop-filter: blur(20px)` | 卡片玻璃化 |
| `--bg-hover` | `#273449` | `rgba(255,255,255,0.16)` | hover 态玻璃 |
| `--text-primary` | `#F1F5F9` | 保持 `#F1F5F9` | 不变 |
| `--text-secondary` | （沿用现有） | 保持，必要时提亮至 `rgba(241,245,249,0.72)` | 保证玻璃上可读性 |
| `--color-primary` | `#3B82F6` | `#5B8DEF`（更通透的蓝，去网页蓝感） | 强调色 |
| `--border-default` | `#334155` | `rgba(255,255,255,0.16)` + 内高光（见 §4） | 玻璃描边替代生硬实线 |
| `--radius-base` | `6px` | `12px` | 放大圆角 |
| `--radius-lg` | （如有） | `22px` | 大面板圆角 |
| `--radius-md` | （如有） | `16px` | 中面板圆角 |
| `--shadow-modal` | `0 4px 12px rgba(0,0,0,0.3)` | `inset 0 1px 0 rgba(255,255,255,0.20), 0 8px 30px rgba(0,0,0,0.28)` | 玻璃投影 |

**新增 glass 令牌（写入 `:root`，供组件复用）：**
```css
:root{
  --glass-bg:        rgba(255,255,255,0.10);
  --glass-bg-strong: rgba(255,255,255,0.16);
  --glass-border:    rgba(255,255,255,0.18);
  --glass-highlight: rgba(255,255,255,0.22);
  --glass-blur:      20px;
  --glass-saturate:  160%;
}
```

---

## 3. 亮色主题令牌（`html[data-theme="light"]`）

亮色下玻璃用"亮白磨砂"，描边改深色细线 + 白色内高光：

| 变量 | 新值（亮色） | 说明 |
|---|---|---|
| `--bg-page` | `rgba(255,255,255,0.55)` + blur | 内容区白玻璃 |
| `--bg-card` | `rgba(255,255,255,0.65)` + blur | 卡片白玻璃 |
| `--bg-hover` | `rgba(255,255,255,0.85)` | hover 白玻璃 |
| `--color-primary` | `#2F6BEE` | 亮色强调蓝 |
| `--border-default` | `rgba(15,23,42,0.10)` + 内高光白 | 亮色玻璃描边 |
| 背景墙 | 浅色分层渐变（浅蓝→浅紫→浅青）+ 降低光斑 opacity | 见 §5 亮色版 |

```css
html[data-theme="light"]{
  --glass-bg:        rgba(255,255,255,0.55);
  --glass-bg-strong: rgba(255,255,255,0.72);
  --glass-border:    rgba(15,23,42,0.10);
  --glass-highlight: rgba(255,255,255,0.85);
}
```

---

## 4. 玻璃材质通用配方（所有面板 / 卡片 / 按钮底）

玻璃 = **半透明填充 + 背景模糊 + 白色内高光 + 多层投影 + 1px 高光描边**：

```css
.glass{
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),   /* 顶部内高光，模拟边缘折射 */
    0 8px 30px rgba(0,0,0,0.28);            /* 悬浮投影 */
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
  .glass{ background: rgba(30,41,59,0.92); }   /* 不支持时回退实色 */
}
```

---

## 5. 背景墙（玻璃透出的底，必做前提）

玻璃只有在"背后有丰富内容"时才透得出质感。给 `body` / `.app-layout` 加分层渐变 + 2 个模糊光斑：

```css
/* 暗色 */
body{
  background:
    radial-gradient(60% 50% at 80% 10%, rgba(124,92,255,0.55), transparent 60%),
    radial-gradient(50% 45% at 12% 85%, rgba(56,189,248,0.45), transparent 60%),
    linear-gradient(135deg, #0B1220 0%, #2A1F45 40%, #123A4F 75%, #0B1E2A 100%);
}
/* 亮色 */
html[data-theme="light"] body{
  background:
    radial-gradient(60% 50% at 80% 10%, rgba(150,120,255,0.30), transparent 60%),
    radial-gradient(50% 45% at 12% 85%, rgba(120,200,255,0.28), transparent 60%),
    linear-gradient(135deg, #EEF2FB 0%, #E8E4F7 40%, #E2F1F7 75%, #EAF4F0 100%);
}
```

---

## 6. 组件玻璃配方（components.css）

> 组件清单（class 名**原样保留**，只换皮）：`HtpButton` / `HtpModal` / `HtpCard` / `HtpInput` / `HtpSelect` / `HtpTag` / `HtpCheckbox` / `HtpEmpty` / `HtpProgress` / `HtpFilterBar` / `HtpTabs` / `HtpListItem`。

- **HtpCard**：使用 §4 `.glass`，`border-radius: var(--radius-lg)`。
- **HtpButton（主）**：`background: var(--color-primary)`（实心，保留辨识度）；圆角 `var(--radius-md)`；按下时 `transform: scale(0.97)` + 加深投影。次按钮 / 文字按钮改为 `--glass-bg` 玻璃或纯文字。
- **HtpInput / HtpSelect**：`background: rgba(255,255,255,0.06)` + `border:1px solid var(--glass-border)`；**聚焦态**：`border-color: var(--color-primary)` + `box-shadow: 0 0 0 3px rgba(91,141,239,0.25)`（蓝边光晕）。
- **HtpTag（状态标签）**：胶囊形 `border-radius: 999px`，半透明底色 + 同色系低饱和文字，例如需求/方案/POC/投标/交付/结项 6 色，均 `rgba(色,0.16)` 底 + `rgba(色,0.9)` 字。
- **HtpModal**：遮罩 `backdrop-filter: blur(8px)` + 半透明黑；面板 `.glass` + `border-radius: var(--radius-lg)` + 更强投影。
- **HtpListItem**：行 hover 用 `--glass-bg-strong`；激活态左侧加 2px 强调色条 + 整行玻璃底。
- **HtpProgress**：轨道 `rgba(255,255,255,0.10)`，填充用主色 + 顶部 1px 高光。
- **HtpTabs**：选中项玻璃胶囊底（参考外壳导航激活态），未选中透明。
- **HtpCheckbox / HtpEmpty / HtpFilterBar**：统一描边改为 `--glass-border`，圆角放大，空态图标降透明度。

---

## 7. 外壳布局（pages.css）

- `.app-sidebar`：改为悬浮玻璃（`.glass` + `border-radius: var(--radius-lg)`），与内容区之间留 `~16px` 间隙形成空间分层；`logo` / `nav` / `footer` 垂直排布。
- 导航项（`.nav-item`）默认透明；**激活态**：玻璃胶囊 `background: var(--glass-bg-strong)` + `inset` 高光 + 左侧 2px 主色条。
- `.app-topbar`：玻璃顶栏，标题左、操作右；搜索/备忘为"药丸"玻璃输入。
- `.app-content`：去除原纯色底，透出背景墙；内部卡片按 §6 玻璃化。

---

## 8. 交互反馈（全局）

| 状态 | 反馈 |
|---|---|
| hover | 背景升为 `--glass-bg-strong`；轻微 `translateY(-1px)`；投影加深 |
| active / 点击 | `transform: scale(0.97)`；高光内收 |
| focus（输入/可聚焦） | 主色描边 + 外发光 `0 0 0 3px rgba(91,141,239,0.25)` |
| 过渡 | 统一 `transition: background .2s, box-shadow .2s, transform .12s ease` |

字体：本项目字体栈为 **Sarasa Gothic SC**，该字体仅有 Regular / Bold，**不得**使用 Medium；层级靠 `font-weight: 400 / 600 / 700` + 字号区分。

---

## 9. 验收清单

- [ ] 仅改了 3 个 CSS 文件，无任何 `.js` / `index.html` / 后端改动（红线 1、6）。
- [ ] 所有原有 class 名保留，无新增/删除/重命名（红线 2）。
- [ ] `:root` 与 `html[data-theme="light"]` 原有变量全部保留并重映射（红线 3）。
- [ ] 暗 / 亮双主题均呈现玻璃质感（红线 4）。
- [ ] `backdrop-filter` 有 `@supports` 回退（红线 5）。
- [ ] 背景墙已加分层渐变 + 光斑，玻璃透出底色可见。
- [ ] 侧栏 / 顶栏 / 卡片 / 按钮 / 输入 / 标签 / 弹窗 / 列表 / 进度 均玻璃化且风格一致。
- [ ] 功能回归：启动应用，遍历 10 个页面，交互（增删改查、弹窗、切换主题）正常。

---

## 10. 一句话引用模板（贴到新会话即可）

```
视觉重构规范见 docs/视觉重构-LiquidGlass规范.md（视觉锚点 Ardot 文件 fileId 713415031333859，
含 Frame 应用外壳 2:1 / 组件库 2:102 / 项目管理页 2:159）。请按规范仅改
frontend/css/{global,components,pages}.css：重映射令牌 + 组件玻璃化 + 双主题 + @supports 兜底。
严禁改动任何 .js、index.html、router、store、api、后端。完成后逐条对照第 9 节验收清单自检。
```

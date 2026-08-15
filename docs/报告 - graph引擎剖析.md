# Person Dashboard · Graph 引擎 架构剖析

> 剖析对象：[oyorf/person_dashboard](https://github.com/oyorf/person_dashboard) 的 Knowledge Graph 实现
> 剖析范围：`src/graph/` 7 个文件 + `src/hooks/useKnowledgeGraphEngine.js`（桥接层）
> 剖析日期：2026-08-11
> 目的：提炼**与图谱无关**的通用架构模式，落地到荒天帝工作台

---

## 0. 文件清单（787 + 577 + 273 + 239 + 148 + 118 + 106 + 84 = 2332 行）

| # | 文件 | 行数 | 职责 |
| --- | --- | --- | --- |
| 1 | [graph-model.js](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-model.js) | 106 | 不可变关系模型（构建图数据结构） |
| 2 | [graph-layout.js](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-layout.js) | 118 | 一次性 D3 force 布局（baseX/baseY） |
| 3 | [graph-motion.js](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js) | 577 | 时间常数驱动的多 channel 阻尼动效 |
| 4 | [graph-hit-test.js](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-hit-test.js) | 273 | 命中测试 + 4 状态悬停意图机 |
| 5 | [graph-label-cache.js](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-label-cache.js) | 239 | 自适应密度标签 + 自动避让 |
| 6 | [graph-renderer.js](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-renderer.js) | 148 | 纯函数 Canvas 绘制（不持有状态） |
| 7 | [graph-engine.js](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-engine.js) | 787 | 主时钟、事件总线、生命周期、4 observer |
| 8 | [useKnowledgeGraphEngine.js](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/hooks/useKnowledgeGraphEngine.js) | 84 | React 桥接层（4 个 useEffect 拆分 props） |

---

## 1. 核心架构模式（10 大设计原则）

### 模式 1 · 责任分离七层（SoC done right）

七层之间**只通过显式数据结构通信**，没有任何层"窥视"另一层的内部状态。

```
┌──────────────────────────────────────────────────────────────┐
│  React 桥接层  useKnowledgeGraphEngine.js  (4 useEffect)    │
│  ↓ props / ↑ 语义事件 (onHover, onZoom, onSelect)            │
├──────────────────────────────────────────────────────────────┤
│  主时钟层    graph-engine.js   RAF 循环 / 输入 / Observer    │
│  ↓ createGraphModel / computeBaseLayout / 各种 step()        │
├──────────────────────────────────────────────────────────────┤
│  数据层      graph-model.js    不可变关系模型                 │
│  布局层      graph-layout.js   d3-force 一次性 baseX/baseY   │
│  动效层      graph-motion.js   5 channel 时间常数阻尼         │
│  命中层      graph-hit-test.js 4 状态意图机                   │
│  标签层      graph-label-cache.js 自适应密度 + 自动避让      │
│  渲染层      graph-renderer.js 纯函数 ctx.draw                │
└──────────────────────────────────────────────────────────────┘
```

**关键证据**：
- [graph-engine.js:1-21](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-engine.js#L1-L21) 一开始就 import 了 7 个文件，且每层 export 的都是纯函数
- [graph-renderer.js:118-148](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-renderer.js#L118-L148) 注释 `Pure drawing: all interaction decisions live in the scene engine.` 直接说"渲染层不持任何状态"。

> **借鉴到 V1.4.0+**：我们任何复杂模块（复盘编辑器 / 阅读器 / 售前关系图）都按这个分层来组织。

---

### 模式 2 · 时间常数驱动（Time Constants not Frame Counts）

[graph-motion.js:7-24](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js#L7-L24) 整个动效配置**全是毫秒数**：

```js
export const GRAPH_V6_MOTION = Object.freeze({
  maxDeltaMs: 64,
  ambientResumeTauMs: 220,
  hoverInTauMs: 72,
  hoverOutTauMs: 106,
  tooltipDelayMs: 220,
  tooltipInTauMs: 56,
  tooltipOutTauMs: 92,
  selectionInTauMs: 140,
  selectionOutTauMs: 210,
  selectedDriftGain: 0.35,
  neighborDriftGain: 0.65,
  unrelatedOpacity: 0.22,
  hoverScale: 0.06,
  maxHoverLinks: 3,
  maxSelectionLinks: 6,
  settleEpsilon: 0.001,
});
```

**关键代码**：[graph-motion.js:34-46](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js#L34-L46)

```js
export function dampingAlpha(deltaMs, tauMs) {
  // 1 - e^(-Δt/τ) — 指数阻尼
  return 1 - Math.exp(-deltaMs / tauMs);
}
export function dampScalar(current, target, deltaMs, tauMs) {
  return current + (target - current) * dampingAlpha(deltaMs, tauMs);
}
```

**为什么用 τ 而非帧数**：
- 30Hz / 60Hz / 120Hz 显示器表现完全一致
- 用户在 60Hz 设备上看 200ms 的动画 = 12 帧，在 120Hz 设备上看同样是 200ms
- 如果用帧数（"播 12 帧"），不同设备时长会不一致

**inTau / outTau 分离**：[graph-motion.js:402-404](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js#L402-L404)
```js
function channelTau(current, target, inTau, outTau) {
  return target > current ? inTau : outTau;  // 上升用 inTau，下降用 outTau
}
```
入场 72ms、出场 106ms（更快响应悬停，更柔和退出）。

> **借鉴到 V1.2.0**：我们 Vue 3 项目的"轻量动效"应该统一改用 τ 阻尼，封装为 `src/utils/damping.js`，覆盖：
> - 模态框/抽屉的开关（当前用 CSS transition）
> - toast 进出
> - 按钮 hover
> - 任务勾选打勾
>
> **预期收益**：相同代码在 60/120/144Hz 显示器上行为一致；更易做 "in / out 不同时长" 的精细交互。

---

### 模式 3 · 解析闭式解（Analytic Closed-Form Position）

[graph-motion.js:94-154](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js#L94-L154) 节点的"环境漂移"（ambient drift）不是帧到帧积分，**而是用阻尼正弦的解析解**：

```js
function dampedSine(amplitude, periodMs, phase, elapsedMs, filterTauMs) {
  const omega = TAU / periodMs;
  const omegaTau = omega * filterTauMs;
  const attenuation = 1 / Math.sqrt(1 + omegaTau * omegaTau);  // 幅值衰减
  const lag = Math.atan(omegaTau);                              // 相位滞后
  return amplitude * attenuation * Math.sin(omega * elapsedMs + phase - lag);
}
```

**含义**：
- 节点晃动 = **2 个不同周期的阻尼正弦叠加**（X 用 (T, 2.1T)，Y 用 (T+π/2, 1.8T)）
- 每个节点有自己**唯一的振幅/周期/相位**，由 `stableGraphHash(node.id)` 决定
- 给定 `elapsedMs`，**任何时间点的位置都唯一确定**（无累积误差）

**对比常见的"积分式物理引擎"**：
- 积分法：受 60Hz 限制，长时间运行会漂移、抖动
- 解析法：30Hz、60Hz、120Hz 取样，结果完全一致；暂停 10 分钟再恢复，节点仍在原位

> **借鉴到 V1.2.0**：如果未来做"数据可视化"的装饰性动效（仪表盘数据点呼吸、登录页背景光斑），用解析解而不是 setInterval。
> **轻量借鉴**：`stableGraphHash` 工具函数（[graph-motion.js:48-56](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js#L48-L56)）立刻可用——给"按 ID 生成稳定随机颜色/振幅"用，**避免每次刷新位置/颜色都不一样**。

---

### 模式 4 · Frame Snapshot Pattern（层与层之间用 frame 通信）

[graph-engine.js:122-156](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-engine.js#L122-L156) 在主时钟初始化时就构建了**三个 frame 数组**：

```js
const nodeFrames = model.nodes.map((node) => ({
  filterOpacity: 1, filterTarget: 1,
  hoverWeight: 0, selectionWeight: 0, neighborWeight: 0,
  node, opacity: 1, radius: nodeRadius(node),
  selectionWeight: 0,
  x: node.baseX, y: node.baseY,
}));
const nodeFrameById = new Map(nodeFrames.map((frame) => [frame.node.id, frame]));

const screenFrames = nodeFrames.map((frame) => ({
  id: frame.node.id, interactive: true, node: frame.node,
  opacity: 1, radius: frame.radius,
  screenX: 0, screenY: 0, visible: true, x: 0, y: 0,
}));
const screenFrameById = new Map(screenFrames.map((frame) => [frame.id, frame]));

const linkFrames = model.links.map((link) => ({
  alpha: 0.12, focusWeight: 0, hoverWeight: 0,
  link, source: nodeFrameById.get(link.source.id), target: nodeFrameById.get(link.target.id),
}));
```

**为什么要三个 frame**：
- `nodeFrame` = 逻辑坐标（未应用 view 变换）
- `screenFrame` = 屏幕坐标（已应用 view 变换 + DPR + 动效偏移）
- `linkFrame` = 边（始终引用 source/target 的 nodeFrame）

**关键证据**：[graph-engine.js:343-380](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-engine.js#L343-L380) 的 `updateFrames` 函数只做一件事：**把 motion state + view 状态填到 frame 上**，不计算任何"业务逻辑"。

**每一帧的流程**（[graph-engine.js:490-519](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-engine.js#L490-L519)）：

```
motion.step()   →  view.step()  →  updateFrames()
       ↓               ↓               ↓
   5 channels      camera         3 frame 数组
   (state)      (target pos)   (logic + screen)
                                       ↓
                              hit-test.step()
                                       ↓
                               label-cache.step()
                                       ↓
                              renderer.draw(ctx, frame)
```

每一步都吃"上一帧的 frame"，吐"这一帧的 frame"。**零反向依赖**。

> **借鉴到 V1.4.0+**：任何"实时数据"渲染（任务时间线、凭据列表动画、备份进度条）都用 Frame Snapshot：
> 1. 初始化时建 frame 数组（不每帧 new）
> 2. 每一帧只 mutate frame 字段
> 3. 渲染函数纯读 frame
>
> **轻量借鉴**（V1.2.0 即可）：我们命令面板的搜索结果排序用类似模式，避免每帧重建 DOM 节点。

---

### 模式 5 · Damping Channels（5 个独立通道）

[graph-motion.js:466-538](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js#L466-L538) 每个节点有 5 个独立 channel：

| channel | 含义 | 入场 τ | 出场 τ | 用途 |
| --- | --- | --- | --- | --- |
| `ambientWeight` | 全局是否允许漂移 | 220ms | 220ms | 全局静音/恢复 |
| `hoverWeight` | 节点悬停 | 72ms | 106ms | 节点放大 |
| `tooltipWeight` | tooltip 浮现 | 56ms | 92ms | 220ms 延迟 |
| `selectionWeight` | 节点选中 | 140ms | 210ms | 高亮 + 关联 |
| `neighborWeight` | 邻居节点 | 140ms | 210ms | 同步淡入 |

**5 个 channel 解耦的好处**：
- 悬停一个节点 → `hoverWeight` 入场（72ms 快），但**不会立即**触发 tooltip（需要 220ms dwell + 56ms 出场）
- 选中一个节点 → `selectionWeight` + 邻居的 `neighborWeight` 同步入场，但悬停未选中的节点不响应
- 用户拖动时 `hoverTarget = 0`，但 `selectionWeight` 保留

> **借鉴到 V1.2.0**：我们 Vue 组件的"状态过渡"应该分 channel：
> - **背景色变化**（τ ≈ 100ms）vs **边框/投影**（τ ≈ 200ms）分开
> - **悬停**（快，60ms）vs **焦点**（慢，200ms）分开
> - **toast 进出**（80ms in / 60ms out）分开
>
> 当前我们的 transition 都是单一 `transition: all 0.2s`，**所有属性一起变**，显得"机械"。

---

### 模式 6 · Deterministic from ID（FNV-1a Hash）

[graph-motion.js:48-56](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js#L48-L56)

```js
export function stableGraphHash(value) {
  let hash = 2166136261;  // FNV-1a 32-bit offset basis
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);  // FNV prime
  }
  return hash >>> 0;
}
```

**在 [graph-motion.js:72-92](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js#L72-L92) 的应用**：

```js
export function createAmbientProfile(node) {
  const hash = stableGraphHash(node.id);
  const amplitudeBase = node.degree === 0 ? 6.5 : node.degree >= 18 ? 3 : 4.8;
  const variance = 0.9 + ((hash >>> 5) % 21) / 100;
  // ...
  return Object.freeze({
    amplitudeX: amplitude,
    amplitudeY: amplitude * (0.72 + ((hash >>> 3) % 19) / 100),
    periodXMs: 60000 + ((hash >>> 9) % 46000),
    periodYMs: 68000 + ((hash >>> 17) % 42000),
    phaseX: ((hash % 360) * Math.PI) / 180,
    phaseY: ((((hash >>> 12) % 360) + 71) * Math.PI) / 180,
    filterTauMs: 780 + ((hash >>> 22) % 520),
  });
}
```

**关键设计**：
- 每个节点的"环境漂移配置"由 ID hash 决定，**完全确定**
- 用户拖动节点后位置稳定（因为配置是确定的）
- 刷新页面后所有节点位置和漂移一模一样（**关键体验**）

> **借鉴到 V1.2.0**（**立刻可用**）：把 `stableGraphHash` 抽到 `frontend/src/utils/stable-hash.js`，用于：
> 1. **项目状态徽章颜色**（同一项目每次颜色一致）
> 2. **客户头像背景色**（用 hash 决定 5 色调色板中的位置）
> 3. **任务卡片装饰图案**（每个任务有稳定的"装饰 hash"）
>
> 这是一个非常容易借鉴、但能立刻让 UI 显得"克制 + 一致"的小技巧。

---

### 模式 7 · Time-aware reduced motion（无刷新切换）

[graph-motion.js:299-320](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js#L299-L320) 用户开启系统"减弱动效"时：

```js
export function setGraphReducedMotion(state, reducedMotion) {
  const next = Boolean(reducedMotion);
  if (state.reducedMotion === next) return state;
  state.reducedMotion = next;
  state.ambientTarget = next ? 0 : 1;
  if (next) {
    if (state.hover.targetId != null) {
      const activeNode = state.nodes.get(state.hover.targetId);
      if (activeNode) activeNode.tooltipTarget = 1;
      state.hover.activatedAtMs = Math.min(
        state.hover.activatedAtMs,
        state.elapsedMs - state.config.tooltipDelayMs,
      );
    }
    settleToTargets(state);  // 全部立即 snap 到 target
  } else {
    state.ambientWeight = 0;  // drift 重新引入
  }
  return state;
}
```

**关键设计**：
- **不需要 reload 或重建引擎**
- 切换时**所有 channel 立即 snap 到 target**（通过 [settleToTargets](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-motion.js#L274-L297)）
- 用户操作状态**保留**（active 节点保持 active，只是不再继续动画）

[graph-engine.js:719-727](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-engine.js#L719-L727) 通过 `matchMedia` 监听系统设置变化：
```js
const onMotionPreferenceChange = (event) => {
  reducedMotion = event.matches;
  setGraphReducedMotion(motion, reducedMotion);
  if (reducedMotion) cancelCamera();
  labelCache.invalidate();
  previousFrameAt = 0;
  wake();
};
motionQuery?.addEventListener?.("change", onMotionPreferenceChange);
```

> **借鉴到 V1.2.0**：我们当前的 Liquid Glass 动效没有"减弱动效"支持。**应该补**：
> 1. 全局 `prefers-reduced-motion` 监听
> 2. 所有动效都有"无动效" fallback
> 3. 实时切换时不需要 reload

---

### 模式 8 · Observer-driven Throttling（4 个 observer 协同决定 RAF）

[graph-engine.js:671-733](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-engine.js#L671-L733) 主时钟**只在需要时跑**：

| Observer | 作用 | 停止条件 |
| --- | --- | --- |
| `ResizeObserver` | 容器尺寸变化 | 持续观察 |
| `IntersectionObserver` | 元素进入视口 | threshold 0.01 离开时停 |
| `visibilitychange` | 标签页切到后台 | document.hidden 时停 |
| `matchMedia` | 减弱动效 | 仅在变化时调用 |

**关键决策函数**：[graph-engine.js:474-488](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-engine.js#L474-L488)

```js
const shouldContinue = (drawState) => {
  if (!running || !intersecting || !documentVisible) return false;
  if (!reducedMotion) return true;  // 正常模式：只要 RAF 就一直跑
  const intentActive = hoverIntent.phase === "candidate" || hoverIntent.phase === "releasing";
  return Boolean(
    intentActive || dragging.node || dragging.pan ||
    view.target || view.pendingSelectionCamera ||
    !drawState.labelsSettled || !drawState.viewSettled ||
    !motionIsSettled(motion)
  );
};
```

**两层节流**：
1. **生命周期节流**（intersecting / visible）：完全停掉 RAF，0 CPU
2. **动效结束节流**（reducedMotion 模式）：所有 channel 静止后才停

> **借鉴到 V1.4.0**：我们当前所有"实时"组件（备份进度条、SSE 监听、轮询）都没做 visibility 节流。**应该补**：
> 1. 切到后台时所有 `setInterval` 自动暂停
> 2. 不可见组件的 RAF 自动停止
>
> **轻量借鉴（V1.2.0 即可）**：把所有"30s 自动刷新"改成"visibility 可见 + 30s"双触发。

---

### 模式 9 · Z-Order Passes（3 遍渲染自动叠层）

[graph-renderer.js:126-140](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/graph/graph-renderer.js#L126-L140)

```js
// 第一遍：所有普通节点
for (const node of nodes) {
  if (node.hoverWeight < 0.008 && node.selectionWeight < 0.008) {
    drawNode(ctx, node, view.k);
  }
}
// 第二遍：悬停但未选中的节点（叠在普通节点之上）
for (const node of nodes) {
  if (node.hoverWeight >= 0.008 && node.selectionWeight < 0.008) {
    drawNode(ctx, node, view.k);
  }
}
// 第三遍：选中的节点（叠在最上）
for (const node of nodes) {
  if (node.selectionWeight >= 0.008) drawNode(ctx, node, view.k);
}
```

**好处**：
- 不需要 `z-index` 字段（节点无状态字段）
- 不需要排序（保持原顺序，只重画）
- 自动避免"被悬停的节点被普通节点覆盖"的问题

> **借鉴到 V1.2.0**：我们售前项目卡片列表、"今日计划"列表的"悬停卡片浮在最上"可以照这个模式：
> 1. CSS：`transform: translateZ(0)` + 阴影
> 2. 或者 JS：列表分 3 遍渲染（普通 / hover / active）

---

### 模式 10 · Hook 拆分（避免无谓销毁/重建）

[useKnowledgeGraphEngine.js:23-74](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/hooks/useKnowledgeGraphEngine.js#L23-L74) 4 个独立的 useEffect 桥接 props：

```js
// 1) 只在 nodes/edges/preview 变化时重建引擎
useEffect(() => { createGraphEngine({...}); return destroy; }, [nodes, edges, preview]);

// 2) 回调变化时只 setCallbacks（不重建）
useEffect(() => { engineRef.current?.setCallbacks({...}); }, [onActivate, onHover, onSelect]);

// 3) 筛选变化时只 setFilters（不重建）
useEffect(() => { engineRef.current?.setFilters(activeTypes, activeStatuses); }, [activeTypes, activeStatuses]);

// 4) 边距变化时只 setInsets（不重建）
useEffect(() => { engineRef.current?.setInsets(viewportInsets); }, [viewportInsets]);

// 5) 选中变化时只 focusNode（不重建）
useEffect(() => { engineRef.current?.focusNode(selectedId ?? null); }, [selectedId]);
```

**好处**：
- 父组件每次渲染都创建新函数引用，**引擎不会被无谓销毁**
- 真正的"结构性变化"（数据源）才触发重建
- "状态性变化"（筛选、选中）走轻量 setter

> **借鉴到 V1.2.0**（**立刻可用**）：我们当前命令面板、DocumentDrawer 等都把 callback 直接传到子组件。**应该**：
> 1. callback 改用 `useRef` 缓存最新引用
> 2. 或 callback 加 `useCallback` + 子组件 useEffect 桥接
> 3. 或 callback 走 props，子组件内部 ref 存最新

---

## 2. 通用架构模式清单（不限于图谱）

| # | 模式 | 可借鉴程度 | 立即可落地的位置 |
| --- | --- | --- | --- |
| 1 | **责任分离七层** | 复杂模块 V1.4.0+ | 阅读器、复盘编辑器 |
| 2 | **时间常数阻尼** | V1.2.0 | 替换 `transition: all` 为 τ 阻尼 |
| 3 | **解析闭式解** | V1.2.0+ | 仪表盘装饰动效 |
| 4 | **Frame Snapshot Pattern** | V1.4.0+ | SSE 实时面板、备份进度条 |
| 5 | **Damping Channels** | V1.2.0 | 按钮 / 卡片 hover 拆分多通道 |
| 6 | **FNV-1a Hash by ID** | **V1.2.0 立刻** | 客户头像、任务徽章颜色、装饰 hash |
| 7 | **Time-aware reduced motion** | V1.2.0 | 全局减弱动效支持 |
| 8 | **Observer-driven Throttling** | V1.4.0+ | 全部实时组件 |
| 9 | **Z-Order Passes** | V1.2.0 | 列表 hover 浮层 |
| 10 | **Hook 拆分 setter 路径** | V1.2.0 | 命令面板、DocumentDrawer |

---

## 3. 立即可落地的 3 个轻量借鉴（V1.2.0）

### 借鉴 A · FNV-1a Hash 工具（30 分钟落地）

**新建 `frontend/src/utils/stable-hash.js`**：

```js
export function stableHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function hashColor(id, palette = ['#5b8def', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b']) {
  return palette[stableHash(id) % palette.length];
}
```

**应用位置**：
- 客户列表卡片左上角色块：`hashColor(customer.id)`
- 任务状态徽章背景色：`hashColor(task.id, ['#5b8def', '#10b981', '#f59e0b'])`
- 凭据分组图标色：`hashColor(group.id)`

**预期收益**：用户每次看到的"客户 A 的颜色"和"项目 B 的颜色"都稳定，不会因为新增项目导致色板漂移。

### 借鉴 B · τ 阻尼工具 + Damping Channels（2 小时落地）

**新建 `frontend/src/utils/damping.js`**：

```js
export function dampingAlpha(deltaMs, tauMs) {
  const delta = Math.max(0, Number(deltaMs) || 0);
  const tau = Math.max(0, Number(tauMs) || 0);
  if (delta === 0) return 0;
  if (tau === 0) return 1;
  return 1 - Math.exp(-delta / tau);
}

export function dampScalar(current, target, deltaMs, tauMs) {
  return current + (target - current) * dampingAlpha(deltaMs, tauMs);
}
```

**应用位置**：
- 命令面板的搜索结果出现：80ms in / 60ms out（替换 CSS `transition: all 0.2s`）
- 抽屉的开关：200ms in / 180ms out
- 卡片 hover：60ms in / 90ms out（更快响应）

**配合 CSS**（用 CSS 变量传递 τ）：
```css
:root { --damping-in: 60ms; --damping-out: 90ms; }
.card { transition: transform var(--damping-in); }
.card:hover { transform: translateY(-2px); }
```

### 借鉴 C · 全局 prefers-reduced-motion 支持（1 小时落地）

**新建 `frontend/src/composables/use-reduced-motion.js`**（Vue 3 风格）：

```js
import { ref, onMounted, onUnmounted } from 'vue';

export function useReducedMotion() {
  const reduced = ref(false);
  const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const onChange = (e) => (reduced.value = e.matches);
  onMounted(() => {
    if (!query) return;
    reduced.value = query.matches;
    query.addEventListener?.('change', onChange);
  });
  onUnmounted(() => query?.removeEventListener?.('change', onChange));
  return reduced;
}
```

**应用位置**：
- 命令面板打开时如果是 reduced motion → 不做入场动画
- 抽屉开关如果是 reduced motion → 瞬时开关
- 总览 GSAP 入场如果是 reduced motion → 不播（已有 fallback，但要全局化）

---

## 4. 不要照搬的部分（避坑提醒）

1. **2332 行**对个人项目来说太重。我们 V1.4.0 之前**只挑 τ 阻尼 + FNV-1a + 减弱动效**三件轻的。完整 graph engine 留到 V1.5.0 自研。
2. **d3-force** 是力导向图专用，**别处用不到**。我们 V1.2.0 不引入。
3. **Schmitt-trigger 双半径**（enter / exit radius）是图谱专用，**别处也用不到**。V1.4.0 用 ECharts 内置 hover 即可。
4. **解析闭式解**对"环境漂移"有用，对按钮 hover 没用（CSS transition 足够）。

---

## 5. 验证清单

- [x] 7 个文件全部精读（2332 行）
- [x] 桥接 hook 精读（84 行）
- [x] 10 个核心架构模式提炼
- [x] 5 个"立即可落地"借鉴点（含具体代码骨架）
- [x] 3 个"V1.2.0 轻量借鉴"具体代码
- [x] 4 条"不要照搬"避坑
- [x] 整合到 `docs/产品迭代/产品迭代演进计划.md` 的方案已给出

---

## 6. 落地动作（建议下一步）

1. **V1.2.0 启动前**：
   - 在 `docs/产品迭代/产品迭代演进计划.md` 5.3b 章节追加 "5.3c 借鉴 Graph 引擎的轻量架构模式" 子项（FNV-1a + τ 阻尼 + 减弱动效）
   - 写 `docs/v1.2.0前端轻量借鉴清单.md` 子文档
2. **V1.2.0 实施时**：
   - 1 个 PR 改 hash 工具 + 1 个 PR 改 damping 工具 + 1 个 PR 改 reduced motion
   - 每个 PR 配 1~2 个测试
3. **V1.4.0 启动前**：
   - 把 "Observer-driven throttling" 加入 V1.4.0 必做项
4. **V1.5.0 启动前**：
   - 评估是否需要"自研 Canvas 引擎"做售前项目关系图

---

> **报告结束**。
> 如需进一步剖析某个具体模式（例如 frame snapshot 在我们 SSE 场景的具体应用），可单独开篇。

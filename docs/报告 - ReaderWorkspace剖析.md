# ReaderWorkspace 模块架构剖析报告

> 精读对象：
> - [ReaderWorkspace.jsx](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderWorkspace.jsx)（主工作台）
> - [ReaderExplanationPanel.jsx](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderExplanationPanel.jsx)（AI 理解面板）
> - [reader-ui.js](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/lib/reader-ui.js)（Handoff 包 / 选区工具 / 错误码）
> - [reader-notes.mjs](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/lib/reader-ui.js)（后端笔记存储）
> 分析视角：**架构设计**（不重复 CodeX 报告的"状态机、事件总线"等通用模式）
> 输出日期：2026-08-11

---

## 0. 摘要

ReaderWorkspace 是 person_dashboard 里**最复杂的前端模块**——它把"批注 / 引用 / AI 理解 / 知识入库"4 件事压在一个右侧抽屉里。代码量 ≈ 1300 行（不含子文件），但**没有任何"框架魔幻"**：没有 Redux、没有 MobX、没有 react-query，所有状态都是 `useState + useRef + useMemo`。

它的核心价值不在"批注 UI"本身，而在背后一套**完整的"前端草稿状态机"**：用户每改一个字，前端都精确知道"这个改动在排队、在保存、已保存、保存失败、需重试"——而且**永远不会丢用户的输入**。

荒天帝工作台目前没有"批注 / 引用 / 知识沉淀"模块。但 V1.2 计划里有"复盘沉淀页 + 知识库 Vault"、V1.3 计划里有"会议纪要 + 习惯打卡 + 时间块"。**这套"前端草稿状态机"模式可以原样套用到所有"用户长文本输入 + 持久化"场景**——售前方案编辑、复盘报告、笔记草稿、习惯评论。

下面 14 个架构模式按"复用价值密度"排序。

---

## 1. Note 双轨模型：free vs quote

### 1.1 它怎么做的

`note.type` 字段只有两个枚举值（[ReaderWorkspace.jsx#L66-79](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderWorkspace.jsx#L66-L79)）：

```js
function normalizeNote(note, index = 0) {
  return {
    ...note,
    type: note?.type === 'quote' ? 'quote' : 'free',  // 默认 free
    body: String(note?.body ?? ''),
    quoteText: note?.quoteText ? String(note.quoteText) : null,
    anchor: note?.anchor ?? null,  // { startBlock, startOffset, endBlock, endOffset, occurrence, contextBefore, contextAfter }
    ...
  };
}
```

- `free` = 用户随便写，body 必填
- `quote` = 绑定原文，**必有 `quoteText` + `anchor`**，body 是补充

### 1.2 价值点

- **一种 note，两种使命**：UI 渲染差异（左上角图标 + 占位符不同），但**存储格式完全一样**。
- **数据自描述**：`anchor` 字段（即使没有 quote 也有 null 位置），**让"跳转回原文"成为通用能力**。
- **`normalizeNote` 是唯一入口**：所有后端返回 / 草稿创建都走同一个函数，**避免字段不一致**。

### 1.3 荒天帝借鉴落点（V1.2 立即 / V1.3 强化）

- 复盘沉淀（V1.2）每个沉淀条目都是 note：  
  - `type: 'free'` → 自由复盘  
  - `type: 'task'` → 关联待办（等价于 quote，body 写"为什么这件事值得做"）
- 会议纪要（V1.3）每条决议都是 note：  
  - `type: 'decision'` → 决策（quote 形式，引用讨论原话）  
  - `type: 'action'` → 行动项（free 形式，body 写具体内容）

---

## 2. 笔记 5 态：pending / saving / saved / failed / null

### 2.1 它怎么做的

`_saveState` 字段有 5 个值（[L77, 95-104](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderWorkspace.jsx#L77-L95)）：

```js
function noteNeedsSave(note) {
  if (!note) return false;
  if (note.type === 'free' && !note.body.trim() && !note.id) return false;  // 空白且未存
  return (
    note._revision > note._savedRevision ||  // 有未保存改动
    note._saveState === 'pending' ||          // 排队中
    note._saveState === 'failed' ||           // 失败了
    note._saveState === 'saving'              // 正在保存
  );
}
```

`pending` 是初始态（在用户改字后但还没排到 setTimeout），`saving` 是排到了正在发请求，`saved` 是服务端 200 回来。

### 2.2 价值点

- **`_revision` 单调递增**（[L653-667](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderWorkspace.jsx#L653-L667)）：每次用户改字就 +1。
- **`_savedRevision` 是"已保存到哪个 revision"**：服务端 200 后更新。
- **`noteNeedsSave()` 一个函数回答"这条 note 现在该不该保存"**——3 个状态、3 个比较，组合成布尔。
- **避免空保存**：空白且未存过的 note 不触发 save，**省请求**。

### 2.3 荒天帝借鉴落点（V1.2 立即）

- 复盘沉淀、笔记草稿、待办描述、习惯评论——**所有用户长文本输入**都套这个 5 态机。
- 抽到 `frontend/src/utils/draft-state.js`：
  ```js
  export const DRAFT_STATE = Object.freeze({
    PENDING: 'pending', SAVING: 'saving', SAVED: 'saved', FAILED: 'failed',
  });
  export function needsSave({ revision, savedRevision, saveState }) {
    return revision > savedRevision || ['pending', 'failed', 'saving'].includes(saveState);
  }
  ```

---

## 3. Revision-based Save 协议

### 3.1 它怎么做的

`persistNote(key)` 的实现（[L506-563](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderWorkspace.jsx#L506-L563)）是个微型状态机：

```js
async function persistNote(key) {
  // 1. 排队检查：同 key 已有 in-flight？直接复用 promise
  const existing = inFlightRef.current.get(key);
  if (existing) return existing;
  
  // 2. 取出"最新快照"
  const snapshot = notesRef.current.find((n) => n._key === key);
  if (!noteNeedsSave(snapshot)) return { ok: true, skipped: true };
  
  // 3. 推入 in-flight map
  const task = (async () => {
    updateNotes((current) => current.map((note) =>
      note._key === key ? { ...note, _saveState: 'saving', _saveError: null } : note,
    ));
    
    try {
      const response = await saveReaderNote({ ...identity, note: notePayload(snapshot) });
      const saved = normalizeNote(unwrapNote(response) || snapshot);
      
      updateNotes((current) => current.map((note) => {
        if (note._key !== key) return note;
        // 关键：用户保存过程中又改字了怎么办？
        const changedWhileSaving = note._revision > snapshot._revision;
        return {
          ...note,
          id: saved.id || note.id,
          _savedRevision: snapshot._revision,  // 只确认到 snapshot 那一刻
          _saveState: changedWhileSaving ? 'pending' : 'saved',  // 有新改就回到 pending
        };
      }));
    } catch (requestError) {
      updateNotes((current) => current.map((note) =>
        note._key === key ? { ...note, _saveState: 'failed', _saveError: message } : note,
      ));
    } finally {
      inFlightRef.current.delete(key);
      // 关键：保存完成后，如果用户又改字了，递归再保存
      const latest = notesRef.current.find((n) => n._key === key);
      if (latest && latest._revision > snapshot._revision) {
        const timer = setTimeout(() => persistNote(key), SAVE_DELAY);
        timersRef.current.set(key, timer);
      }
    }
  })();
  inFlightRef.current.set(key, task);
  return task;
}
```

### 3.2 价值点

- **Snapshot + Revision 模式**：保存发起时拍快照 `snapshot._revision = N`，保存回来时比较"现在的 revision 是否 > N"——**自动检测"保存中又改了"的情况**。
- **不会丢字**：哪怕用户在 3 秒保存中改了 5 次字，**最后一次一定会保存**（finally 里的递归）。
- **不会重复保存**：in-flight map 保证同 key 不会并发发请求。
- **失败可恢复**：`_saveState = 'failed'` + `_saveError` 字段，UI 提示"保存失败，请重试"，用户重试时直接走 `persistNote` 同一流程。

### 3.3 荒天帝借鉴落点（V1.2 立即）

- 抽到 `frontend/src/utils/draft-saver.js`：
  ```js
  export function createDraftSaver({ save, scheduleMs = 650 }) {
    const inFlight = new Map();
    const timers = new Map();
    return {
      onChange(key, revision, state) { /* 排 setTimeout */ },
      flush(key) { /* 取消 timer，立即存 */ },
      flushAll() { /* 全部存完才返回 */ },
    };
  }
  ```
- 复盘页、待办编辑、习惯评论全部用它。

---

## 4. 双层 timer + inFlight 队列

### 4.1 它怎么做的

```js
const timersRef = useRef(new Map());   // key -> setTimeout id
const inFlightRef = useRef(new Map()); // key -> Promise
```

两个 ref 是**两个独立队列**：

- `timers` = "还没发请求的"（防抖窗口内）
- `inFlight` = "请求在路上"（防并发）

每次 `changeNote`：

```js
const scheduleSave = (key, delay = SAVE_DELAY) => {  // 650ms
  const previous = timersRef.current.get(key);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => { timersRef.current.delete(key); persistNote(key); }, delay);
  timersRef.current.set(key, timer);
};
```

`flush()`（卸载时调用，详见 §5）做了 8 轮：

```js
for (let pass = 0; pass < 8; pass += 1) {
  const keys = new Set([...inFlightRef.current.keys(), ...notesRef.current.filter(noteNeedsSave).map((n) => n._key)]);
  if (!keys.size) return;
  const results = await Promise.all([...keys].map((k) => inFlightRef.current.get(k) || persistNote(k)));
  // 失败 / 还有未保存 → 下一轮
}
```

### 4.2 价值点

- **650ms 防抖**：用户连续打字不会每个字都发请求。
- **`setTimeout` 取消语义**：`clearTimeout(previous)` 重新计时。
- **8 轮 flush**：在卸载时**保证所有 in-flight 都能完成**——即便保存失败，下一轮还会再试。
- **"持久层 + 飞行层" 双层抽象**是异步数据同步的经典模式，**可移植性极强**。

### 4.3 荒天帝借鉴落点（V1.2 立即）

- `frontend/src/utils/draft-saver.js`（同上）封装这两个队列。
- 任何"用户改 → 650ms 后保存"场景都用它。
- 卸载时统一调 `flush()` 兜底。

---

## 5. forwardRef + useImperativeHandle 暴露 flush

### 5.1 它怎么做的

```js
export const ReaderWorkspace = forwardRef(function ReaderWorkspace({ ... }, ref) {
  // ...
  const flush = useCallback(async () => { ... }, [persistNote]);
  useImperativeHandle(ref, () => ({ flush }), [flush]);
  // ...
});
```

父组件（如详情页）可以这样用：

```js
const workspaceRef = useRef(null);
<ReaderWorkspace ref={workspaceRef} ... />

// 路由切换前：
await workspaceRef.current?.flush();
```

### 5.2 价值点

- **不强制父组件管理 note 状态**：所有 note 状态封装在 ReaderWorkspace 内部。
- **逃生口**：父组件**只在关键时机**（路由切换、关闭标签页）调 `flush()`。
- **`useImperativeHandle` 限制 API**：父组件只能调 `flush`，不能调 `persistNote` / `changeNote` 等内部函数。
- **可移植到所有"长表单"组件**：售前方案编辑、复盘报告、笔记详情。

### 5.3 荒天帝借鉴落点（V1.2 / V1.3）

- 任何"用户编辑后需要路由切换"的页面都用 forwardRef + flush：
  ```js
  // 复盘详情页
  const editorRef = useRef(null);
  const handleTabSwitch = async (nextTab) => {
    await editorRef.current?.flush();  // 先存盘
    setTab(nextTab);
  };
  ```
- 这就是为什么 reader/notes 切换时**从来不丢字**。

---

## 6. Save-on-blur + Debounce 双策略

### 6.1 它怎么做的

```js
const changeNote = (key, body) => {
  updateNotes(/* 改 body，_revision + 1，_saveState: 'pending' */);
  scheduleSave(key, SAVE_DELAY);  // 650ms 防抖
};

const blurNote = (key) => {
  const note = notesRef.current.find((n) => n._key === key);
  if (note?._saveState === 'pending' || note?._saveState === 'failed') {
    scheduleSave(key, 0);  // 立即保存，0 延迟
  }
};
```

### 6.2 价值点

- **持续输入时防抖**：650ms 减少请求。
- **失焦立即保存**：用户切到下一条时，**当前条不会因为 650ms 窗口未到而丢**。
- **失败重试用同套流程**：失败时也走 0 延迟。
- **零侵入**：`onChange` 不会卡 UI，状态机自己决定何时真存。

### 6.3 荒天帝借鉴落点（V1.2 立即）

- 复盘页文本框、会议纪要编辑、待办描述——全部用"debounce + blur-0"双策略。
- `flush` 接口让"切换标签页前"和"blur"等价。

---

## 7. 锚点对象 + 双向跳转

### 7.1 它怎么做的

```js
{
  quoteText: "从原文中选出的文字",
  anchor: {
    startBlock: 12,      // 段落索引
    startOffset: 4,      // 段内偏移
    endBlock: 12,
    endOffset: 28,
    occurrence: 0,       // 第几次出现（防止同一段重复）
    contextBefore: "上文 50 字",
    contextAfter: "下文 50 字",
  },
}
```

引用笔记卡片有 3 种交互（[L191-203](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderWorkspace.jsx#L191-L203)）：

1. 点击 quote 按钮 → `onJump({ ...anchor, quoteText })` 跳回原文
2. 原文选中 → 自动建引用 note
3. 跳转前先 `setMobileOpen(false)` 关掉侧栏，让用户看清原文

### 7.2 价值点

- **锚点是富对象**：不只存"哪一段"，还存"前后文"。**哪怕原文被改了一行，也能模糊匹配回去**。
- **`occurrence` 解决重复段**：同一段在文档里出现 3 次时，第 1 次和第 3 次是不同锚点。
- **双向跳转**：note ↔ 原文，**任何时候都能从笔记回到原文**。
- **不绑 DOM 节点 ID**：用段落索引 + 偏移，**Markdown 重排也找得到**。

### 7.3 荒天帝借鉴落点（V1.3 会议纪要）

- 会议纪要每条决议都是 quote（引用某句原话），锚点存"录音第几分第几秒" + "文本版本号"。
- 复盘沉淀里的"案例引用"也是 quote，锚点存"客户案例库 ID + 章节"。

---

## 8. 客户端预览模式（built + preview 二次确认）

### 8.1 它怎么做的

`ManualIngestPanel`（[L268-425](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderWorkspace.jsx#L268-L425)）做了 5 件事：

1. **调 `flush()` 先存盘**（`onBeforePrepare`）
2. **`buildManualWikiIngestPackage` 拼装 prompt**（[reader-ui.js#L85-156](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/lib/reader-ui.js#L85-L156)）
3. **写剪贴板** `navigator.clipboard.writeText(prompt)`
4. **尝试唤起 Codex Desktop** `location.assign('codex://')`
5. **同时在 UI 上展示**完整 prompt 预览 `<textarea readOnly value={prepared.prompt} rows={14} />`

### 8.2 价值点

- **"复制 + 唤起 + 预览" 三合一**：用户任何一个失败都不影响其他步骤。
- **预览区不消失**：哪怕剪贴板失败、唤起失败，**用户还能手动复制预览框的内容**。
- **`onBeforePrepare` 钩子**：让"打包入库材料"和"保存笔记"原子化。
- **用户始终是最后一步的执行人**：Workbench **不直接写入 Wiki**，只整理材料、唤起 Codex、等人粘贴、等人确认。

### 8.3 荒天帝借鉴落点（V1.3 售前方案 / V1.4 POC）

- 售前方案生成时：**前端整理"客户资料 + 需求 + 已有案例" → 复制 prompt → 唤起 Codex / 预览框**。
- POC 验收时：**前端整理"客户环境 + 试用反馈 + 已签条款" → 复制到剪贴板 → 唤起 Claude**。

---

## 9. Capability-driven Tabs（按 eligibility 显隐）

### 9.1 它怎么做的

```js
const eligibleForExplanation = Boolean(canExplain);  // 有正文 + contentHash
const eligibleForIngest = document.layer === 'raw' && typeof readableBody === 'string' && readableBody.trim();

// 渲染时：
{eligibleForExplanation ? <button id="reader-explain-tab" ...>理解</button> : null}
{eligibleForIngest ? <button id="reader-ingest-tab" ...>入库</button> : null}
```

并且有反向保护 effect（[L631-637](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderWorkspace.jsx#L631-L637)）：

```js
useEffect(() => {
  if (tab === 'explain' && !eligibleForExplanation) setTab('notes');
  else if (tab === 'ingest' && !eligibleForIngest) setTab('notes');
}, [eligibleForExplanation, eligibleForIngest, tab]);
```

### 9.2 价值点

- **Tab 按能力显示**：没有正文时不显示"理解"，不显示"入库"。
- **URL deep link 兼容**：如果 URL 直接打开 `?tab=explain` 但当前文档没正文，effect 自动跳回 `notes`。
- **`document.layer === 'raw'` 是关键**：不是所有文档都允许入库（**已沉淀的 wiki 页不能再入库**）。
- **能力是数据，不是配置**：从文档自身属性推导，**没有"配置文件遗漏"的 bug**。

### 9.3 荒天帝借鉴落点（V1.2 / V1.3）

- 复盘页：未完成的复盘显示"沉淀"，已完成的显示"导出 / 分享"。
- 会议纪要：未签字的显示"编辑"，已签字的显示"回溯 / 复制"。
- 抽到 `frontend/src/utils/derive-capabilities.js`：
  ```js
  export function deriveCapabilities({ type, status, hasBody, hasPermissions }) {
    return {
      canEdit: status !== 'archived',
      canExport: status === 'completed',
      canShare: hasPermissions,
      // ...
    };
  }
  ```

---

## 10. Tablist 键盘导航 + ARIA

### 10.1 它怎么做的

```js
const handleTabKeyDown = (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const availableTabs = ['notes', ...(eligibleForExplanation ? ['explain'] : []), ...(eligibleForIngest ? ['ingest'] : [])];
  if (availableTabs.length < 2) return;
  event.preventDefault();
  const currentIndex = Math.max(0, availableTabs.indexOf(tab));
  const nextTab = event.key === 'Home' ? availableTabs[0] :
    event.key === 'End' ? availableTabs.at(-1) :
    availableTabs[(currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + availableTabs.length) % availableTabs.length];
  switchTab(nextTab);
  window.requestAnimationFrame(() => {
    tablist.querySelector(`[data-reader-tab="${nextTab}"]`)?.focus();
  });
};
```

完整 ARIA 属性（[L757-815](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderWorkspace.jsx#L757-L815)）：

- `role="tablist"`, `aria-label="阅读工作台功能"`
- 每个 tab `role="tab"`, `aria-selected`, `aria-controls`, `tabIndex={active ? 0 : -1}`
- 每个 panel `role="tabpanel"`, `aria-labelledby`, `hidden={!active}`

### 10.2 价值点

- **完整 WAI-ARIA Tab 模式**：屏幕阅读器、键盘用户都能用。
- **循环导航**：Right 到底再 Right 回到第一个。
- **Roving Tabindex**：只有当前 tab 是 `tabIndex=0`，其他 `-1`，**符合 ARIA 规范**。
- **`requestAnimationFrame` 同步焦点**：切换后立即 focus 新 tab，键盘焦点不丢。

### 10.3 荒天帝借鉴落点（V1.2 立即）

- 项目管理页的 Tab、"今日/明日计划"切换、复盘的章节切换——**全部按 ARIA Tab 模式重做**。
- 抽到 `frontend/src/components/tabs/Tablist.jsx`：
  ```js
  export function Tablist({ tabs, active, onChange, label }) {
    // 内置 ARIA + 键盘导航 + roving tabindex
  }
  ```
- 任何"内容分块切换"的地方都套用。

---

## 11. 多 Note _key 合并 + _focus 焦点管理

### 11.1 它怎么做的

```js
function clientKey() {
  return globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// 新增 note
const next = normalizeNote({
  _key: clientKey(),
  type: 'free',
  body: '',
  _saveState: 'pending',
  _revision: 0,
  _focus: true,  // 新增的自动聚焦
});
updateNotes((current) => [next, ...current.map((note) => ({ ...note, _focus: false }))]);  // 旧的取消 _focus
```

### 11.2 价值点

- **`_key` 是前端临时 ID**：`crypto.randomUUID` 或 fallback，**永远唯一**。
- **`_key` 和后端 `id` 是两套**：保存成功后 `id = saved.id` 才填上（[L528-538](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderWorkspace.jsx#L528-L538)）。
- **`_focus` 标志位**：新增后自动 focus，旧的 focus 自动清掉。
- **避免 re-render 时的 input 失焦**：用 `autoFocus={note._focus === true}` 而不是 React 19 的 `autoFocus` 属性。

### 11.3 荒天帝借鉴落点（V1.2 立即）

- 复盘页"新增一条要点"、待办页"快速添加子任务"——同样用 `_key` 临时 ID + `_focus` 自动 focus 模式。
- 抽到 `frontend/src/utils/list-with-focus.js`：
  ```js
  export function appendWithFocus(items, newItem) {
    return [{ ...newItem, _focus: true, _key: clientKey() }, ...items.map((i) => ({ ...i, _focus: false }))];
  }
  ```

---

## 12. 边界：codex-explanation 只读

### 12.1 它怎么怎么做

```jsx
{note.origin === 'codex-explanation' ? (
  <p className="reader-note-card__origin">
    Codex 原始解释保持只读；你的核对、反对或补充请另建自由笔记。
  </p>
) : null}

// 文本框
<textarea
  readOnly={note.origin === 'codex-explanation'}
  placeholder={note.origin === 'codex-explanation' 
    ? '补充你的核对、反对或个人判断…' 
    : ...}
  rows={note.type === 'quote' ? 3 : 4}
/>
```

UI 上还多了 `IconSparkles` 替代 `IconNotes`，标题改为"AI 阅读辅助"。

### 12.2 价值点

- **`origin` 字段做"内容来源标识"**：区分 `user`（用户写的）和 `codex-explanation`（AI 写的）。
- **强制只读 + 引导补写**：不让用户改 AI 内容，但**鼓励用户另写一条**作为对 AI 的回应。
- **后端也守门**（[reader-notes.mjs#L256-261](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/server/reader-notes.mjs#L256-L261)）：  
  `if (requestedOrigin === 'codex-explanation' && value.type !== 'quote')` → 拒绝。

### 12.3 荒天帝借鉴落点（V1.3 售前方案）

- 售前方案生成后，**AI 出的方案是只读的**，用户要修改只能"基于 AI 方案新建我的版本"。
- 抽到 `frontend/src/utils/origin-aware.js`：
  ```js
  export function isReadOnly(item) {
    return ['ai-generated', 'system-template', 'archived'].includes(item.origin);
  }
  ```

---

## 13. Polling 退避（指数退避到上限）

### 13.1 它怎么做的

`readerExplanationPollRetry`（[reader-ui.js#L192-200](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/lib/reader-ui.js#L192-L200)）：

```js
export function readerExplanationPollRetry(failureCount) {
  const attempt = Math.max(1, Math.trunc(Number(failureCount) || 1));
  const exhausted = attempt > READER_EXPLANATION_POLL_RETRY_LIMIT;  // 3
  return {
    attempt,
    exhausted,
    delay: exhausted ? null : Math.min(800 * 2 ** (attempt - 1), 4_800),  // 800/1600/3200/4800
  };
}
```

调用方（[ReaderExplanationPanel.jsx#L486-509](file:///D:/WorkSpace/%E7%AC%AC%E4%B8%89%E6%96%B9%E5%B7%A5%E4%BD%9C%E5%8F%B0%E5%80%9F%E9%89%B4/person_dashboard/Workbench/src/components/reader/ReaderExplanationPanel.jsx#L486-L509)）：

```js
const retryState = readerExplanationPollRetry(failures);
setPollIssue({ analysisId: active.id, message, attempt: retryState.attempt, exhausted: retryState.exhausted });
if (!retryState.exhausted) timer = setTimeout(poll, retryState.delay);
```

### 13.2 价值点

- **指数退避 + 封顶**：800 → 1600 → 3200 → 4800ms 上限。
- **明确 `exhausted` 状态**：UI 显示"进度连接不稳定，正在重试（3/3）"，到上限后变成"重新读取进度"按钮。
- **本地服务降级**：检测到本地 API 不可用时（`isLocalOnlyApiError`）直接 `exhausted = true`，**不浪费用户的等待**。
- **失败计数独立**：每个 `analysisId` 自己的失败计数（不是全局）。

### 13.3 荒天帝借鉴落点（V1.3 立即）

- 售前方案 AI 生成、会议纪要 AI 整理、Vault 索引重建——任何"长任务进度查询"都用这套退避。
- 抽到 `frontend/src/utils/poll-with-backoff.js`：
  ```js
  export function createPoller({ fetch, maxAttempts = 3, baseMs = 800, capMs = 4_800 }) {
    let failures = 0;
    return {
      async tick() {
        try { 
          const result = await fetch();
          failures = 0;
          return { ok: true, result };
        } catch (err) {
          failures += 1;
          const exhausted = failures > maxAttempts;
          return { ok: false, exhausted, delay: exhausted ? null : Math.min(baseMs * 2 ** (failures - 1), capMs) };
        }
      },
    };
  }
  ```

---

## 14. 多轮对话线程（readerExplanationThreads）

### 14.1 它怎么做的

每个 `explanation` 记录有 `parentId` 字段（追问指向首问），形成链。`readerExplanationThreads(records)` 把 records 聚合成 `{ root, records, latest }` 数组。

### 14.2 价值点

- **链式追问不丢失上下文**：服务端能根据 `parentId` 把追问拼接到原文对话里。
- **前端可以独立渲染每条对话**：每条对话一个卡片，**互不干扰**。
- **`followUpState` 限制追问轮数**（`READER_EXPLANATION_FOLLOW_UP_LIMIT = 3`）：**防止 AI 失控**。

### 14.3 荒天帝借鉴落点（V1.3 会议纪要 / 复盘）

- 复盘"追问 AI 给建议"：每条追问是独立 thread，限制 3 轮。
- 售前"AI 帮我想下一步"：同款。

---

## 15. 总结：荒天帝可立即落地的清单

| # | 借鉴点 | 价值 | 落地版本 | 工作量 | 落地位置 |
| --- | --- | --- | --- | --- | --- |
| 1 | **Note 双轨模型（free/quote）** | 数据自描述 | V1.2 立即 | 0.5 天 | `frontend/src/utils/note-types.js` |
| 2 | **Note 5 态机（pending/saving/saved/failed）** | 通用草稿管理 | V1.2 立即 | 0.5 天 | `frontend/src/utils/draft-state.js` |
| 3 | **Revision-based Save 协议** | 永不丢字 | V1.2 立即 | 1 天 | `frontend/src/utils/draft-saver.js` |
| 4 | **双层 timer + inFlight 队列** | 防抖 + 防并发 | V1.2 立即 | 0.5 天 | 同上 |
| 5 | **forwardRef + flush 暴露** | 路由切换前存盘 | V1.2 立即 | 0.5 天 | `frontend/src/components/DraftEditor.jsx` |
| 6 | **Debounce + blur-0 双策略** | 失焦立即存 | V1.2 立即 | 0.5 天 | 同 draft-saver |
| 7 | **Quote 锚点 + 双向跳转** | 笔记 ↔ 原文 | V1.3 会议纪要 | 1 天 | `frontend/src/utils/anchor.js` |
| 8 | **客户端预览模式** | AI 不可用不掉链 | V1.3 售前方案 | 1 天 | `frontend/src/utils/ingest-package.js` |
| 9 | **Capability-driven Tabs** | 按数据能力显隐 | V1.2 立即 | 0.5 天 | `frontend/src/utils/derive-capabilities.js` |
| 10 | **ARIA Tablist + 键盘导航** | 无障碍 + 键盘党 | V1.2 立即 | 1 天 | `frontend/src/components/Tablist.jsx` |
| 11 | **_key + _focus 列表管理** | 自动 focus 新增项 | V1.2 立即 | 0.5 天 | `frontend/src/utils/list-with-focus.js` |
| 12 | **origin 字段 + 只读守门** | AI 内容不可改 | V1.3 售前方案 | 0.5 天 | `frontend/src/utils/origin-aware.js` |
| 13 | **Polling 退避（指数+封顶）** | 长任务友好 | V1.3 立即 | 0.5 天 | `frontend/src/utils/poll-with-backoff.js` |
| 14 | **多轮对话 thread** | 追问不丢上下文 | V1.3 复盘 | 1 天 | `frontend/src/utils/thread-merge.js` |

**总计**：V1.2 一个 sprint（约 6-8 工作日）能落地前 11 项，**立刻能解决"复盘 / 笔记 / 待办"的所有"用户长文本输入 + 持久化"场景**。V1.3 再加锚点、预览、对话 thread。

---

## 16. 容易踩的坑

1. **不要用 react-query / SWR** —— 它们是"服务端数据缓存"，和"草稿状态机"是两个东西。ReaderWorkspace 用最朴素的 useState 反而更可控。
2. **不要让前端直接管理 `id` 字段** —— 一定用 `_key` 临时 ID，等服务端 200 后回填 `id`。否则并发保存会撞 ID。
3. **`flush()` 一定要有 8 轮上限** —— 否则网络极差时 flush 会无限等。
4. **不要用 lodash debounce** —— 自己写 5 行 setTimeout 即可，因为要和 inFlight 队列配合。
5. **锚点不要存 DOM 节点** —— Markdown 重排后 DOM 节点会变。要存"段落索引 + 偏移 + occurrence"。
6. **polling 失败一定要有 exhausted 状态** —— 否则网络抖动时用户看到 spinner 转不停，体验极差。
7. **不要在 origin 字段上做权限控制** —— 那是 RBAC 的事。origin 只用来"显示不同 UI"。
8. **`autoFocus` 属性慎用** —— React 19 的 `autoFocus` 只在初次渲染时生效。用 `_focus` 标志位 + `useEffect` + `requestAnimationFrame` 才能稳定 focus。

---

## 17. 和 CodeX 报告的衔接

ReaderWorkspace 报告 + CodeX 报告 一起读，能形成完整的"AI 协作 + 草稿管理"技术栈：

- **CodeX 报告**给的是"AI 任务"侧：状态机、进程管理、错误码、Handoff
- **ReaderWorkspace 报告**给的是"用户输入"侧：草稿状态机、防抖、锚点、ARIAList

**两者结合 = 完整的"V1.3 售前方案"功能**：

- 用户在 Editor（ReaderWorkspace 模式）写需求
- 点"让 AI 帮我" → 触发 CodeX 报告的 JobRunner
- 任务在后台跑（CodeX 报告的 Observable 推送进度）
- AI 产出的方案进 Editor（ReaderWorkspace 模式的 origin-aware 渲染）
- 用户在方案上批注、改写、追问（ReaderWorkspace 报告的草稿状态机）
- 最终确认 → CodeX 报告的 Handoff 包 → 真的写到方案库

V1.3 的 6 周排期里，前 3 周做"草稿侧"，后 3 周做"AI 协作侧"，**正好把两份报告用上**。

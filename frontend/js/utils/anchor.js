/**
 * S2-4 双轨笔记 - 原文锚点工具（纯 DOM 工具，无框架依赖）
 *
 * 双轨机制：
 *   1. 用户在原文区划选文本 → getRangeOffsets 计算相对原文的 [start, end] 字符偏移；
 *   2. 偏移随笔记一起存库（anchor 字段，JSON 串）；
 *   3. 点击笔记 → highlightOffsets 用 <mark> 包裹该区间并滚动定位；
 *   4. 再次点击其它笔记前 clearHighlights 还原，避免高亮叠加。
 *
 * 偏移基于「原文容器的纯文本」计算，与 HTML 结构无关；
 * 原文被编辑后偏移可能漂移，故笔记同时存 quote 快照用于展示与兜底。
 */

/**
 * 解析 anchor 字符串为 { start, end }；非法时返回 null（不抛错）
 */
export function parseAnchor(anchor) {
  if (!anchor || typeof anchor !== 'string') return null;
  try {
    const obj = JSON.parse(anchor);
    if (!obj || typeof obj !== 'object') return null;
    const start = Number(obj.start);
    const end = Number(obj.end);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
    if (start < 0 || end < start) return null;
    return { start, end };
  } catch {
    return null;
  }
}

/**
 * 计算 Range 相对容器的字符偏移 [start, end]
 * 实现：用「容器起点 → range 起点」的 Range 文本长度作为 start，
 * 再加上选中文本长度得到 end（与 HTML 结构无关，只认纯文本）。
 */
export function getRangeOffsets(container, range) {
  if (!container || !range) return null;
  const pre = document.createRange();
  pre.selectNodeContents(container);
  try {
    pre.setEnd(range.startContainer, range.startOffset);
  } catch {
    return null;
  }
  const start = pre.toString().length;
  const text = range.toString();
  return { start, end: start + text.length, text };
}

/**
 * 从当前窗口选区计算偏移（划选建笔记入口）
 * 选区不在容器内时返回 null
 */
export function getSelectionOffsets(container) {
  if (!container) return null;
  const sel = typeof window !== 'undefined' && window.getSelection
    ? window.getSelection()
    : null;
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null;
  }
  return getRangeOffsets(container, range);
}

/**
 * 收集容器内的文本节点，附带各自在纯文本中的起止偏移
 */
function collectTextNodes(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let offset = 0;
  let node = walker.nextNode();
  while (node) {
    const len = node.nodeValue ? node.nodeValue.length : 0;
    nodes.push({ node, start: offset, end: offset + len });
    offset += len;
    node = walker.nextNode();
  }
  return nodes;
}

/**
 * 在容器内高亮 [start, end] 区间的文本（用 <mark> 包裹）并滚动定位
 * 跨多个文本节点时同样可用（extractContents + appendChild，非 surroundContents）
 * 返回被高亮的文本；区间非法或容器为空时返回 ''
 */
export function highlightOffsets(container, start, end, options = {}) {
  if (!container) return '';
  const s = Number(start);
  const e = Number(end);
  if (!Number.isInteger(s) || !Number.isInteger(e) || e <= s) return '';

  const nodes = collectTextNodes(container);
  if (!nodes.length) return '';

  const startHit = nodes.find((n) => s >= n.start && s < n.end);
  const endHit = nodes.find((n) => e > n.start && e <= n.end);
  if (!startHit || !endHit) return '';

  const range = document.createRange();
  range.setStart(startHit.node, s - startHit.start);
  range.setEnd(endHit.node, e - endHit.start);

  const text = range.toString();
  if (!text) return '';

  const mark = document.createElement('mark');
  mark.className = options.className || 'htd-anchor-highlight';
  try {
    // surroundContents 在跨节点时会抛错，故统一用 extract + append
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
  } catch {
    return '';
  }

  if (options.scroll !== false && typeof mark.scrollIntoView === 'function') {
    // jsdom / 无布局环境下 scrollIntoView 可能不存在，故做防御
    mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  return text;
}

/**
 * 清除容器内所有由 highlightOffsets 生成的高亮（unwrap，保留文本）
 */
export function clearHighlights(container, className = 'htd-anchor-highlight') {
  if (!container) return 0;
  const marks = Array.from(container.querySelectorAll(`mark.${className}`));
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  return marks.length;
}

// 兼容旧 IIFE 风格页面（如 ReadingPage 无 import 的模板组件）：挂载到 window，
// 使其可以像 window.htdCharts 那样在 setup 中直接取用。
if (typeof window !== 'undefined') {
  window.htdAnchor = {
    parseAnchor,
    getRangeOffsets,
    getSelectionOffsets,
    highlightOffsets,
    clearHighlights,
  };
}

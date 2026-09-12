import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseAnchor,
  getRangeOffsets,
  highlightOffsets,
  clearHighlights,
} from '../js/utils/anchor.js';

/**
 * 构造原文容器：<p>第一段</p><p>第二段</p>
 * 纯文本为「第一段第二段」——偏移：第(0)一(1)段(2)第(3)二(4)段(5)
 */
function makeContainer() {
  const div = document.createElement('div');
  div.innerHTML = '<p>第一段</p><p>第二段</p>';
  document.body.appendChild(div);
  return div;
}

/** 取容器中第 index 个文本节点 */
function textNodeAt(container, index) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();
  for (let i = 0; i < index; i += 1) node = walker.nextNode();
  return node;
}

describe('anchor 工具（S2-4 双轨锚点）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('parseAnchor 解析合法锚点', () => {
    expect(parseAnchor('{"start":10,"end":25}')).toEqual({ start: 10, end: 25 });
  });

  it('parseAnchor 拒绝非法输入（非 JSON / end<start / 负数 / 空值）', () => {
    expect(parseAnchor('not-json')).toBeNull();
    expect(parseAnchor('{"start":30,"end":10}')).toBeNull();
    expect(parseAnchor('{"start":-1,"end":5}')).toBeNull();
    expect(parseAnchor(null)).toBeNull();
    expect(parseAnchor('')).toBeNull();
    expect(parseAnchor('"string"')).toBeNull();
  });

  it('getRangeOffsets 计算同一文本节点内的偏移', () => {
    const c = makeContainer();
    const first = textNodeAt(c, 0); // "第一段"
    const range = document.createRange();
    range.setStart(first, 1);
    range.setEnd(first, 3); // "一段"
    const r = getRangeOffsets(c, range);
    expect(r.start).toBe(1);
    expect(r.end).toBe(3);
    expect(r.text).toBe('一段');
  });

  it('getRangeOffsets 计算跨文本节点的偏移', () => {
    const c = makeContainer();
    const first = textNodeAt(c, 0); // "第一段"
    const second = textNodeAt(c, 1); // "第二段"
    const range = document.createRange();
    range.setStart(first, 2); // "段"(偏移2)
    range.setEnd(second, 1); // "第"(偏移3) → 覆盖「段第」
    const r = getRangeOffsets(c, range);
    expect(r.start).toBe(2);
    expect(r.end).toBe(4);
    expect(r.text).toBe('段第');
  });

  it('getRangeOffsets 对空容器/空 range 安全返回 null', () => {
    expect(getRangeOffsets(null, null)).toBeNull();
    const c = makeContainer();
    expect(getRangeOffsets(c, null)).toBeNull();
  });

  it('highlightOffsets 高亮指定区间并返回文本', () => {
    const c = makeContainer();
    const text = highlightOffsets(c, 1, 3, { scroll: false });
    expect(text).toBe('一段');
    const mark = c.querySelector('mark.htd-anchor-highlight');
    expect(mark).not.toBeNull();
    expect(mark.textContent).toBe('一段');
  });

  it('highlightOffsets 支持跨节点区间', () => {
    const c = makeContainer();
    const text = highlightOffsets(c, 2, 4, { scroll: false });
    expect(text).toBe('段第');
    expect(c.querySelector('mark').textContent).toBe('段第');
  });

  it('highlightOffsets 对非法区间返回空串且不产生 mark', () => {
    const c = makeContainer();
    expect(highlightOffsets(c, 3, 3, { scroll: false })).toBe('');
    expect(highlightOffsets(c, 5, 2, { scroll: false })).toBe('');
    expect(highlightOffsets(c, 0, 999, { scroll: false })).toBe('');
    expect(c.querySelector('mark')).toBeNull();
  });

  it('clearHighlights 还原文本并移除 mark（内容不丢失）', () => {
    const c = makeContainer();
    highlightOffsets(c, 1, 3, { scroll: false });
    expect(c.querySelector('mark')).not.toBeNull();

    const removed = clearHighlights(c);
    expect(removed).toBe(1);
    expect(c.querySelector('mark')).toBeNull();
    // 原文完整保留：<p>第一段</p><p>第二段</p>
    expect(c.querySelectorAll('p').length).toBe(2);
    expect(c.textContent).toBe('第一段第二段');
  });

  it('多次高亮后一次性清理，文本保持完整', () => {
    const c = makeContainer();
    highlightOffsets(c, 0, 2, { scroll: false });
    highlightOffsets(c, 3, 5, { scroll: false });
    expect(c.querySelectorAll('mark').length).toBe(2);
    expect(clearHighlights(c)).toBe(2);
    expect(c.textContent).toBe('第一段第二段');
  });
});

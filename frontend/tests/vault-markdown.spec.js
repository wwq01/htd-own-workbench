import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  extractWikiLinks,
  renderWikiLinks,
  renderMarkdown,
  references,
} from '../js/utils/markdown.js';

describe('escapeHtml', () => {
  it('转义危险字符，阻断属性注入', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).not.toContain('<img');
    expect(escapeHtml('a"b')).toBe('a&quot;b');
  });
});

describe('extractWikiLinks', () => {
  it('提取双链目标并去重', () => {
    const src = '参考 [[零信任]] 与 [[零信任]]，另见 [[渗透测试/流程]]。';
    expect(extractWikiLinks(src)).toEqual(['零信任', '渗透测试/流程']);
  });
  it('无双链返回空数组', () => {
    expect(extractWikiLinks('普通文本')).toEqual([]);
    expect(extractWikiLinks('')).toEqual([]);
    expect(extractWikiLinks(null)).toEqual([]);
  });
});

describe('renderWikiLinks', () => {
  it('目标存在渲染为可跳转锚点', () => {
    const html = renderWikiLinks('见 [[零信任]]', () => true);
    expect(html).toContain('data-wiki="零信任"');
    expect(html).toContain('class="vault-wikilink"');
    expect(html).not.toContain('--missing');
  });
  it('目标缺失标记为 missing（点击后走新建）', () => {
    const html = renderWikiLinks('见 [[未创建]]', () => false);
    expect(html).toContain('vault-wikilink--missing');
  });
});

describe('renderMarkdown', () => {
  it('强渲染：粗体 / 列表 / 标题', () => {
    const html = renderMarkdown('## 标题\n\n- 甲\n- 乙\n\n**加粗**');
    expect(html).toContain('<h2>');
    expect(html).toContain('<li>甲</li>');
    expect(html).toContain('<strong>加粗</strong>');
  });
  it('双链在渲染结果中保留为锚点（html:true 生效）', () => {
    const html = renderMarkdown('参见 [[零信任]] 方案', { exists: () => true });
    expect(html).toContain('data-wiki="零信任"');
    expect(html).not.toContain('[[零信任]]');
  });
  it('空内容返回空串', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
  });
});

describe('references（反链计算）', () => {
  it('识别引用了某主题的正文（忽略大小写）', () => {
    expect(references('延伸阅读 [[Zero Trust]]', 'zero trust')).toBe(true);
    expect(references('延伸阅读 [[别的主题]]', 'zero trust')).toBe(false);
    expect(references('', 'zero trust')).toBe(false);
  });
});

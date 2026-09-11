/**
 * markdown.js — S2-3 Vault 深化的 Markdown 工具层（ESM 纯函数，可单测）
 *
 * 职责：
 *  1) markdown-it 强渲染（表格/代码/列表/任务列表等）
 *  2) 双向链接 [[目标]] 的提取与渲染
 *
 * 安全口径：本项目为本地单人应用、内容由本人录入，故开启 html:true 以允许
 * 双链锚点内联；但所有插值（链接目标、显示文本）一律经 escape 处理，
 * 且 markdown-it 不开启 raw HTML 透传之外的额外能力（无 script 执行路径）。
 */
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true, // 允许 [[双链]] 渲染出的内联 <a>
  linkify: true,
  breaks: true,
  typographer: false,
});

const ESC_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** HTML 文本转义 */
export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

const WIKI_RE = /\[\[([^[\]\n]+)\]\]/g;

/** 提取正文中所有 [[双链]] 目标（去重、保序、去空白） */
export function extractWikiLinks(src) {
  const out = [];
  const seen = new Set();
  if (!src) return out;
  const re = new RegExp(WIKI_RE.source, 'g');
  let m = re.exec(String(src));
  while (m) {
    const t = m[1].trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    m = re.exec(String(src));
  }
  return out;
}

/**
 * 把 [[目标]] 渲染为可点击的锚点
 * @param {string} src 原始 markdown
 * @param {(target:string)=>boolean} exists 判断目标条目是否存在（不存在标红虚线）
 */
export function renderWikiLinks(src, exists) {
  if (!src) return '';
  return String(src).replace(WIKI_RE, (_full, raw) => {
    const t = raw.trim();
    if (!t) return _full;
    const ok = typeof exists === 'function' ? !!exists(t) : true;
    const cls = ok ? 'vault-wikilink' : 'vault-wikilink vault-wikilink--missing';
    const tip = ok ? `跳转到：${escapeHtml(t)}` : `尚未创建：${escapeHtml(t)}（点击新建）`;
    return `<a class="${cls}" data-wiki="${escapeHtml(t)}" title="${tip}" role="link" tabindex="0">${escapeHtml(t)}</a>`;
  });
}

/**
 * Markdown → HTML（含双链渲染）
 * @param {string} src 原始 markdown
 * @param {{ exists?: (t:string)=>boolean }} opts
 */
export function renderMarkdown(src, opts = {}) {
  if (!src) return '';
  return md.render(renderWikiLinks(src, opts.exists));
}

/** 判断正文是否引用了某个目标（反链计算用，忽略大小写） */
export function references(src, target) {
  if (!src || !target) return false;
  return extractWikiLinks(src).some((t) => t.toLowerCase() === String(target).toLowerCase());
}

export default md;

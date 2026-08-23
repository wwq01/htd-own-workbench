#!/usr/bin/env node
/**
 * visual-audit.js — 视觉契约审计（CI 门禁 · 蓝图 §3.2 / R1 / AC-26）
 *
 * 读取 frontend/css/*.css：
 *  1) 令牌完整性：所有 glass / shadow / border 前缀的设计令牌引用都必须有对应定义。
 *  2) 类名契约：当前唯一类名集合必须包含基线集合（禁止删除已有类名；新增类名允许）。
 *  3) 禁项扫描：
 *       - emoji
 *       - 紫粉渐变（gradient 中色相落在 [290,330] 紫→粉区间）
 *       - 弹跳缓动 cubic-bezier(0.68,-0.55,0.265,1.55)
 *       - 组件/页面 CSS（components.css / pages.css）新增硬编码 hex（基线外即违规；
 *         global.css 为令牌层，硬编码色允许）
 *
 * 输出 JSON 报告（visual-audit-report.json）；任一违规即非零退出。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_DIR = path.resolve(__dirname, '../../frontend/css');
const COMPONENT_CSS = ['components.css', 'pages.css']; // 组件/页面层，禁止新增硬编码色
const BASELINE_CLASS = path.resolve(__dirname, '.class-baseline.json');
const BASELINE_HEX = path.resolve(__dirname, '.hex-baseline.json');
const REPORT_PATH = path.resolve(__dirname, 'visual-audit-report.json');

const violations = [];
const warnings = [];
function fail(msg) { violations.push(msg); }

function listCss() {
  return fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css')).map((f) => path.join(CSS_DIR, f));
}

// ---- 颜色工具 ----
function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(2);
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return [r, g, b];
}

function hueOf([r, g, b]) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const mx = Math.max(...a);
  const mn = Math.min(...a);
  const d = mx - mn;
  if (d === 0) return 0;
  let hue;
  if (mx === a[0]) hue = ((a[1] - a[2]) / d) % 6;
  else if (mx === a[1]) hue = (a[2] - a[0]) / d + 2;
  else hue = (a[0] - a[1]) / d + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return Math.round(hue);
}

// ---- 1. 令牌完整性 ----
function auditTokens() {
  const defined = new Set();
  const referenced = new Set();
  for (const fp of listCss()) {
    const txt = fs.readFileSync(fp, 'utf8');
    for (const m of txt.matchAll(/--(?:glass|shadow|border)-[a-zA-Z0-9-]*\s*:/g)) {
      defined.add(m[0].replace(/\s*:$/, ''));
    }
    for (const m of txt.matchAll(/var\((--(?:glass|shadow|border)-[a-zA-Z0-9-]*)\)/g)) {
      referenced.add(m[1]);
    }
  }
  const dangling = [...referenced].filter((t) => !defined.has(t));
  for (const t of dangling) {
    fail(`令牌完整性：引用了未定义的令牌 ${t}（var(${t})）`);
  }
  return { definedCount: defined.size, referencedCount: referenced.size, dangling };
}

// ---- 2. 类名契约 ----
function collectClasses() {
  const set = new Set();
  for (const fp of listCss()) {
    const txt = fs.readFileSync(fp, 'utf8');
    for (const m of txt.matchAll(/\.[-_a-zA-Z][-_a-zA-Z0-9-]*/g)) {
      set.add(m[0].slice(1));
    }
  }
  return set;
}

function loadBaseline(file) {
  if (fs.existsSync(file)) {
    try {
      return new Set(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
      return null;
    }
  }
  return null;
}

function saveBaseline(file, set) {
  fs.writeFileSync(file, JSON.stringify([...set].sort(), null, 2));
}

// ---- 3. 禁项扫描 ----
function auditBanned() {
  // 用 RegExp 构造器以转义序列表达 emoji 码区，避免源码中出现字面 emoji
  const emojiRe = new RegExp('[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}]', 'gu');
  const PURPLE_PINK = [290, 330]; // 紫→粉色相区间（靛蓝 ~235 / 青 ~190 均不在此区间）
  let emojiHit = false;
  let bounceHit = false;

  for (const fp of listCss()) {
    const txt = fs.readFileSync(fp, 'utf8');
    if (emojiRe.test(txt)) emojiHit = true;

    const norm = txt.replace(/\s+/g, '').toLowerCase();
    if (norm.includes('cubic-bezier(0.68,-0.55,0.265,1.55)')) bounceHit = true;

    for (const g of txt.matchAll(/(?:linear|radial|conic)-gradient\(([^;)]*)\)/g)) {
      const body = g[1];
      for (const hx of body.matchAll(/#([0-9a-fA-F]{6})/g)) {
        const rgb = hexToRgb('#' + hx[1]);
        if (rgb) {
          const h = hueOf(rgb);
          if (h >= PURPLE_PINK[0] && h <= PURPLE_PINK[1]) {
            fail(`禁项：紫粉渐变色 #${hx[1]}（hue=${h}）出现在 ${path.basename(fp)}`);
          }
        }
      }
    }
  }
  if (emojiHit) fail('禁项：emoji 出现在 CSS 中');
  if (bounceHit) fail('禁项：弹跳缓动 cubic-bezier(0.68,-0.55,0.265,1.55) 出现在 CSS 中');

  // 组件/页面 CSS 新增硬编码 hex（基线外）
  const compHex = new Set();
  for (const name of COMPONENT_CSS) {
    const fp = path.join(CSS_DIR, name);
    if (!fs.existsSync(fp)) continue;
    const txt = fs.readFileSync(fp, 'utf8');
    for (const m of txt.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) compHex.add(m[0].toLowerCase());
  }
  const hexBase = loadBaseline(BASELINE_HEX);
  if (!hexBase) {
    saveBaseline(BASELINE_HEX, compHex);
    warnings.push('组件/页面 CSS 硬编码色基线已初始化（首次运行）');
  } else {
    const newHex = [...compHex].filter((h) => !hexBase.has(h));
    if (newHex.length) fail(`禁项：组件/页面 CSS 新增硬编码色 ${newHex.join(', ')}（不在基线内）`);
  }
}

function main() {
  const tokenState = auditTokens();
  const currentClasses = collectClasses();
  const classBase = loadBaseline(BASELINE_CLASS);
  let baselineCount = null;
  let removed = [];
  if (!classBase) {
    saveBaseline(BASELINE_CLASS, currentClasses);
    warnings.push('类名基线已初始化（首次运行），当前类名数 = ' + currentClasses.size);
  } else {
    baselineCount = classBase.size;
    removed = [...classBase].filter((c) => !currentClasses.has(c));
    if (removed.length) {
      fail(`类名契约被破坏：删除了 ${removed.length} 个已有类名（示例：${removed.slice(0, 12).join(', ')}）`);
    }
  }

  auditBanned();

  const report = {
    timestamp: new Date().toISOString(),
    cssDir: CSS_DIR,
    tokenIntegrity: {
      definedCount: tokenState.definedCount,
      referencedCount: tokenState.referencedCount,
      dangling: tokenState.dangling,
    },
    classContract: {
      currentCount: currentClasses.size,
      baselineCount,
      removedCount: removed.length,
      removed: removed.slice(0, 50),
    },
    status: violations.length ? 'fail' : 'pass',
    violations,
    warnings,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  if (violations.length) {
    console.error(`\n[visual-audit] 失败：${violations.length} 项违规（报告：${REPORT_PATH}）`);
    for (const v of violations) console.error('  - ' + v);
    process.exit(1);
  }
  console.log(`[visual-audit] 通过：令牌完整性 / 类名契约 / 禁项扫描 全部合格（报告：${REPORT_PATH}）`);
  process.exit(0);
}

main();

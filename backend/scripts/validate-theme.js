#!/usr/bin/env node
/**
 * validate-theme.js — 主题令牌校验（CI 门禁 · 蓝图 §3.3 / §3.4）
 *
 * 校验 frontend/themes/*.theme.json 是否符合规范：
 *  - 顶层必含字段：id / name / version / appearance / supportsDarkLight / dark / light
 *  - dark + light 双套均存在
 *  - 每套含 7 个小节：colorPalette / borderRadius / shadows / typography / motion / spacing / decorations
 *  - 圆角 borderRadius 所有数值 <= 28
 *  - 动效 motion.duration <= 400ms（且 > 0）
 *  - 动效 motion.easing 非弹跳（拒绝 cubic-bezier(0.68,-0.55,0.265,1.55)）
 *  - WCAG AA：fgPrimary / fgSecondary / fgTertiary 对 panel / bgPage 四套对比度均 >= 4.5:1
 *
 * 任一违规即打印并非零退出；全部通过则零退出。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = path.resolve(__dirname, '../../frontend/themes');

const TOP_REQUIRED = ['id', 'name', 'version', 'appearance', 'supportsDarkLight', 'dark', 'light'];
const THEME_SECTIONS = ['colorPalette', 'borderRadius', 'shadows', 'typography', 'motion', 'spacing', 'decorations'];
const FG_KEYS = ['fgPrimary', 'fgSecondary', 'fgTertiary'];
const BG_KEYS = ['panel', 'bgPage'];
const BOUNCE_EASING = 'cubic-bezier(0.68,-0.55,0.265,1.55)';

const violations = [];
function fail(msg) { violations.push(msg); }

// ---- 颜色工具 ----
function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(2); // 丢弃 alpha
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return [r, g, b];
}

function relLuminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrastRatio(c1, c2) {
  const l1 = relLuminance(c1);
  const l2 = relLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// 递归检查对象内所有数值叶子 <= max
function checkNumericLeaves(obj, pathPrefix, max, where) {
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) fail(`${where}: ${pathPrefix} 不是有限数字`);
    else if (obj > max) fail(`${where}: ${pathPrefix}=${obj} 超过上限 ${max}`);
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => checkNumericLeaves(v, `${pathPrefix}[${i}]`, max, where));
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      checkNumericLeaves(obj[k], pathPrefix ? `${pathPrefix}.${k}` : k, max, where);
    }
  }
}

function normalizeEasing(s) {
  return String(s).replace(/\s+/g, '').toLowerCase();
}

function checkMotion(motion, where) {
  if (!motion || typeof motion !== 'object') {
    fail(`${where}: motion 缺失或非对象`);
    return;
  }
  if (typeof motion.duration !== 'undefined') {
    const d = motion.duration;
    if (typeof d !== 'number' || !Number.isFinite(d)) fail(`${where}: motion.duration 非法 (${JSON.stringify(d)})`);
    else if (d <= 0) fail(`${where}: motion.duration 必须 > 0 (${d})`);
    else if (d > 400) fail(`${where}: motion.duration=${d}ms 超过 400ms 上限`);
  }
  const easing = motion.easing;
  if (typeof easing === 'string') {
    const ne = normalizeEasing(easing);
    if (ne.includes(normalizeEasing(BOUNCE_EASING))) {
      fail(`${where}: motion.easing 使用了弹跳缓动 ${easing}`);
    }
  }
}

function checkTheme(file, theme) {
  const where = `theme.json(${path.basename(file)})`;
  for (const k of TOP_REQUIRED) {
    if (!(k in theme)) fail(`${where}: 缺少顶层字段 ${k}`);
  }
  for (const sub of ['dark', 'light']) {
    if (!(sub in theme)) {
      fail(`${where}: 缺少 ${sub} 套`);
      continue;
    }
    const t = theme[sub];
    if (!t || typeof t !== 'object') {
      fail(`${where}: ${sub} 非对象`);
      continue;
    }
    for (const sec of THEME_SECTIONS) {
      if (!(sec in t)) fail(`${where}.${sub}: 缺少小节 ${sec}`);
    }
    if (t.borderRadius && typeof t.borderRadius === 'object') {
      checkNumericLeaves(t.borderRadius, 'borderRadius', 28, `${where}.${sub}`);
    }
    checkMotion(t.motion, `${where}.${sub}`);

    const cp = t.colorPalette;
    if (cp && typeof cp === 'object') {
      const missing = [...FG_KEYS, ...BG_KEYS].filter((k) => !(k in cp));
      if (missing.length) {
        fail(`${where}.${sub}.colorPalette: 缺少对比度关键色 ${missing.join(', ')}`);
      } else {
        const bg = {};
        for (const bk of BG_KEYS) {
          const rgb = hexToRgb(cp[bk]);
          if (!rgb) {
            fail(`${where}.${sub}.colorPalette.${bk}: 非法颜色 ${JSON.stringify(cp[bk])}`);
            continue;
          }
          bg[bk] = rgb;
        }
        for (const fk of FG_KEYS) {
          const rgb = hexToRgb(cp[fk]);
          if (!rgb) {
            fail(`${where}.${sub}.colorPalette.${fk}: 非法颜色 ${JSON.stringify(cp[fk])}`);
            continue;
          }
          for (const bk of BG_KEYS) {
            if (!bg[bk]) continue;
            const ratio = contrastRatio(rgb, bg[bk]);
            if (ratio < 4.5 - 1e-6) {
              fail(`${where}.${sub}: 对比度 ${fk} vs ${bk} = ${ratio.toFixed(2)}:1 < 4.5:1（WCAG AA 不达标）`);
            }
          }
        }
      }
    }
  }
}

function main() {
  if (!fs.existsSync(THEMES_DIR)) {
    fail(`主题目录不存在: ${THEMES_DIR}（前端需产出 frontend/themes/*.theme.json）`);
  } else {
    const files = fs.readdirSync(THEMES_DIR).filter((f) => f.endsWith('.theme.json'));
    if (files.length === 0) fail('未找到任何 *.theme.json（需至少一套主题，蓝图 §3.3）');
    for (const f of files) {
      const fp = path.join(THEMES_DIR, f);
      let theme;
      try {
        theme = JSON.parse(fs.readFileSync(fp, 'utf8'));
      } catch (e) {
        fail(`theme.json(${f}): JSON 解析失败 — ${e.message}`);
        continue;
      }
      checkTheme(fp, theme);
    }
  }

  if (violations.length) {
    console.error(`\n[validate-theme] 失败：${violations.length} 项违规`);
    for (const v of violations) console.error('  - ' + v);
    process.exit(1);
  }
  console.log('[validate-theme] 通过：所有 theme.json 符合蓝图 §3.3 / §3.4');
  process.exit(0);
}

main();

/**
 * 主题管理器（V1.4 · 三维主题模型）
 * ------------------------------------------------------------------
 * 启动最早执行（index.html 中置于 app.js 之前），防 FOUC。
 * 仅设置 <html> 上的三个 data 属性：
 *   data-appearance（liquid-glass | notion-flat）
 *   data-theme（dark | light）
 *   data-decoration（on | off，仅 liquid-glass 生效；notion-flat 强制 off）
 * 组件 CSS / class 名 / JS 零改动 —— 切换只改 data 属性，令牌覆盖层自动生效。
 *
 * - 从 localStorage['htd-theme'] 同步读取并立即应用（首屏防闪烁）
 * - 再从服务端 GET /api/v1/system/settings 异步对账（服务端为权威来源）
 * - 处理 prefers-reduced-motion（强制动画时长 0）
 * - 暴露 window.htdTheme：applyTheme(partial) / getCurrent()
 * - 降级：令牌缺失 / 读取失败 → 回退 Liquid Glass 默认
 *
 * 兼容：旧 settings.theme 仅有 'dark'|'light' 单轴，仍映射到 data-theme。
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'htd-theme';
  var DEFAULTS = { appearance: 'liquid-glass', theme: 'dark', decoration: 'on' };
  var API_BASE = '/api/v1';

  var motionMQ = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  function readLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') return obj;
    } catch (e) {
      /* 损坏则忽略，走默认 */
    }
    return null;
  }

  function currentAttrs() {
    var d = document.documentElement;
    return {
      appearance: d.getAttribute('data-appearance') || DEFAULTS.appearance,
      theme: d.getAttribute('data-theme') || DEFAULTS.theme,
      decoration: d.getAttribute('data-decoration') || DEFAULTS.decoration,
    };
  }

  function persist(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* 隐私模式等可能失败，不阻塞 */
    }
  }

  function applyMotionState() {
    var reduce = !!(motionMQ && motionMQ.matches);
    document.documentElement.setAttribute('data-reduced-motion', reduce ? 'true' : 'false');
  }

  /**
   * 应用三维主题 —— 仅设置 <html> 的三个 data 属性。
   * @param {object} [partial] { appearance?, theme?, decoration? }
   * @returns {object} 实际生效的状态
   */
  function applyTheme(partial) {
    partial = partial || {};
    var cur = currentAttrs();
    var appearance = partial.appearance || cur.appearance || DEFAULTS.appearance;
    var theme = partial.theme || cur.theme || DEFAULTS.theme;
    var decoration = (partial.decoration === undefined || partial.decoration === null)
      ? cur.decoration
      : partial.decoration;
    if (!decoration) decoration = DEFAULTS.decoration;

    // notion-flat 强制装饰关闭（装饰是其不适用维度）
    if (appearance === 'notion-flat') decoration = 'off';
    // 旧 settings.theme 仅单轴：非 light 一律视为 dark
    if (theme !== 'light') theme = 'dark';

    var d = document.documentElement;
    d.setAttribute('data-appearance', appearance);
    d.setAttribute('data-theme', theme);
    d.setAttribute('data-decoration', decoration);

    applyMotionState();
    persist({ appearance: appearance, theme: theme, decoration: decoration });
    return { appearance: appearance, theme: theme, decoration: decoration };
  }

  function getCurrent() {
    return currentAttrs();
  }

  // ===== 同步首屏：从 localStorage 立即应用，杜绝 FOUC =====
  var local = readLocal();
  if (local) {
    applyTheme({ appearance: local.appearance, theme: local.theme, decoration: local.decoration });
  } else {
    applyTheme(DEFAULTS);
  }

  // ===== 异步对账：服务端 settings 为权威来源（若可用） =====
  try {
    fetch(API_BASE + '/system/settings', { method: 'GET', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.code === 0 && data.data) {
          var s = data.data;
          applyTheme({
            theme: s.theme,
            appearance: s.appearance || 'liquid-glass',
            decoration: s.decoration || 'on',
          });
        }
      })
      .catch(function () {
        /* 服务未起 / 失败 → 保留 localStorage 结果（降级） */
      });
  } catch (e) {
    /* 同步异常（如 CSP）忽略 */
  }

  // 监听系统"减少动态效果"切换
  if (motionMQ && motionMQ.addEventListener) {
    motionMQ.addEventListener('change', applyMotionState);
  }

  window.htdTheme = { applyTheme: applyTheme, getCurrent: getCurrent };
})();

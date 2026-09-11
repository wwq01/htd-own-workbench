/**
 * HtpCommandPalette - 命令面板（Ctrl/Cmd+K）V1.2 P0
 * 4 类动作：入口跳转 / 新建记录 / 切主题 / 立即备份
 * 拼音首字母模糊匹配：手写 pinyinKeys（离线可用，无第三方拼音库），按命中层级排序 + 使用频率微调
 * 交互：↑↓ 切换、Enter 执行、Esc 关闭、Ctrl/Cmd+1~9 快捷选前 9 项（query 为空时）
 * 装饰：选中态走 --color-primary 半透明；prefers-reduced-motion 时由全局 CSS 降级无过渡
 * 挂载：<teleport to="body">，z-index 最高层；defineExpose({ open, close, toggle })
 */
const HtpCommandPalette = {
  name: 'HtpCommandPalette',
  expose: ['open', 'close', 'toggle'],
  setup() {
    const visible = Vue.ref(false);
    const query = Vue.ref('');
    const activeIndex = Vue.ref(0);
    const inputEl = Vue.ref(null);
    const isReduced = useReducedMotion();
    const appStore = window.useAppStore ? window.useAppStore() : null;

    // 内联语义图标（16x16，stroke=currentColor，跟随主题）
    const ICON = {
      nav: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>',
      add: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
      theme: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>',
      appearance: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>',
      backup: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-9-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
    };

    // 命令表（离线，pinyinKeys 手写）
    const COMMANDS = [
      // S1：导航命令由 registry.js 单一数据源派生（新增模块无需改本文件）
      ...((window.htdRegistry && window.htdRegistry.buildNavCommands)
        ? window.htdRegistry.buildNavCommands(ICON.nav)
        : []),
      { id: 'act-new-todo', label: '新建今日任务', type: 'nav', path: '/todo', typeLabel: '新建', iconSvg: ICON.add, pinyinKeys: ['xinjian', 'xj', 'renwu', 'rw', 'xinjianrenwu', 'xinjianjinrirenwu'] },
      { id: 'act-new-project', label: '新建项目', type: 'nav', path: '/project', typeLabel: '新建', iconSvg: ICON.add, pinyinKeys: ['xinjianxiangmu', 'xjxm', 'xinjian', 'xj'] },
      { id: 'act-new-secret', label: '新建凭据', type: 'nav', path: '/secret', typeLabel: '新建', iconSvg: ICON.add, pinyinKeys: ['xinjianpingju', 'xjpj', 'xinjian', 'xj'] },
      { id: 'act-new-memo', label: '新建备忘', type: 'action', typeLabel: '新建', iconSvg: ICON.add, handler: () => { if (window.htdRouter) window.htdRouter.navigate('/'); setTimeout(() => { const el = document.querySelector('.app-topbar__memo-input input'); if (el) el.focus(); }, 120); }, pinyinKeys: ['xinjianbeiwang', 'xjbw', 'beiwang', 'bw', 'xinjian', 'xj'] },
      { id: 'act-theme-dark', label: '切换暗色主题', type: 'theme', theme: 'dark', typeLabel: '主题', iconSvg: ICON.theme, pinyinKeys: ['andise', 'ads', 'qiehuan', 'qh', 'an', 'hei'] },
      { id: 'act-theme-light', label: '切换亮色主题', type: 'theme', theme: 'light', typeLabel: '主题', iconSvg: ICON.theme, pinyinKeys: ['liangse', 'ls', 'qiehuan', 'qh', 'liang', 'bai'] },
      { id: 'act-appearance-glass', label: '切换 Liquid Glass 外观', type: 'appearance', appearance: 'liquid-glass', typeLabel: '外观', iconSvg: ICON.appearance, pinyinKeys: ['qiehuan', 'qh', 'liquid', 'glass', 'boli', 'waiguan', 'wzg'] },
      { id: 'act-appearance-notion', label: '切换 Notion 极简平铺外观', type: 'appearance', appearance: 'notion-flat', typeLabel: '外观', iconSvg: ICON.appearance, pinyinKeys: ['qiehuan', 'qh', 'notion', 'jijian', 'pingpu', 'waiguan', 'wzg'] },
      { id: 'act-backup', label: '立即备份（手动）', type: 'backup', typeLabel: '备份', iconSvg: ICON.backup, pinyinKeys: ['beifen', 'bf', 'lijibeifen', 'shujubeifen'] },
    ];

    const USAGE_KEY = 'htd_cmd_usage';
    function loadUsage() {
      try { return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}'); } catch (e) { return {}; }
    }
    function bumpUsage(id) {
      const u = loadUsage();
      u[id] = (u[id] || 0) + 1;
      try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch (e) { /* ignore */ }
    }
    const usage = loadUsage();

    function normalize(s) { return (s || '').toLowerCase().trim(); }

    function scoreCommand(cmd, q) {
      if (!q) return 1 + (usage[cmd.id] || 0) * 0.01;
      let best = 0;
      if (cmd.label.toLowerCase().includes(q)) best = Math.max(best, 2);
      for (const key of cmd.pinyinKeys || []) {
        if (key === q) best = Math.max(best, 3);
        else if (key.startsWith(q)) best = Math.max(best, 2.5);
        else if (key.includes(q)) best = Math.max(best, 1.5);
      }
      return best;
    }

    function searchCommands(q) {
      const nq = normalize(q);
      return COMMANDS
        .map((cmd) => ({ cmd, s: nq ? scoreCommand(cmd, nq) : (1 + (usage[cmd.id] || 0) * 0.01) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => (b.s - a.s) || ((usage[b.cmd.id] || 0) - (usage[a.cmd.id] || 0)))
        .map((x) => x.cmd);
    }

    const results = Vue.computed(() => searchCommands(query.value));

    // ===== 跨模块搜索分支（V1.5 §8.2） =====
    const searchIconSvg = window.htdIcon('search', { size: 16 });
    const searchRaw = Vue.ref(null);
    const searchTotal = Vue.ref(0);
    const searchLoading = Vue.ref(false);
    const searchGroups = Vue.computed(() => {
      if (!searchRaw.value || !searchRaw.value.groups) return [];
      let idx = results.value.length;
      return searchRaw.value.groups.map((g) => ({
        module: g.module,
        label: g.label,
        route: g.route,
        items: g.items.slice(0, 5).map((it) => ({ ...it, idx: idx++ })),
      }));
    });
    const totalItems = Vue.computed(() => {
      const s = searchGroups.value.reduce((acc, g) => acc + g.items.length, 0);
      return results.value.length + s;
    });
    function navigate(route) {
      if (route && window.htdRouter) window.htdRouter.navigate(route);
      close();
    }
    function runSearch(it) {
      if (it && it.route) navigate(it.route);
      else close();
    }
    function activate() {
      const c = activeIndex.value;
      if (c < results.value.length) { run(results.value[c]); return; }
      const flat = [];
      searchGroups.value.forEach((g) => g.items.forEach((it) => flat.push(it)));
      const s = flat.find((x) => x.idx === c);
      if (s) runSearch(s);
    }
    let searchTimer = null;
    Vue.watch(query, (q) => {
      if (searchTimer) clearTimeout(searchTimer);
      const t = (q || '').trim();
      if (!t) { searchRaw.value = null; searchTotal.value = 0; searchLoading.value = false; return; }
      searchLoading.value = true;
      searchTimer = setTimeout(async () => {
        try {
          const r = await window.htdApi.get('/search', { q: t });
          searchRaw.value = r && r.groups ? r : { groups: [], total: 0 };
          searchTotal.value = (r && r.total) || 0;
        } catch (e) {
          searchRaw.value = { groups: [], total: 0 };
        } finally {
          searchLoading.value = false;
        }
      }, 250);
    });

    function open() {
      visible.value = true;
      query.value = '';
      activeIndex.value = 0;
      searchRaw.value = null;
      searchTotal.value = 0;
      searchLoading.value = false;
      Vue.nextTick(() => { if (inputEl.value) inputEl.value.focus(); });
    }
    function close() {
      visible.value = false;
    }
    function toggle() {
      visible.value ? close() : open();
    }

    function doQuickBackup() {
      if (window.htdApi) {
        window.htdApi.post('/system/backups/manual', {})
          .then((r) => { if (r && r.fileName) window.showToast(`已备份：${r.fileName}`, 'success'); })
          .catch(() => { /* api 已 toast */ });
      }
    }

    function run(cmd) {
      try {
        if (cmd.type === 'nav') {
          if (window.htdRouter) window.htdRouter.navigate(cmd.path);
        } else if (cmd.type === 'theme') {
          if (appStore) appStore.applyTheme(cmd.theme);
        } else if (cmd.type === 'appearance') {
          if (appStore) appStore.applyAppearance({ appearance: cmd.appearance });
        } else if (cmd.type === 'backup') {
          doQuickBackup();
        } else if (cmd.type === 'action' && cmd.handler) {
          cmd.handler();
        }
        bumpUsage(cmd.id);
      } catch (e) {
        console.error('[命令面板] 执行失败:', e);
      }
      close();
    }

    function onKeydown(e) {
      if (!visible.value) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex.value = Math.min(activeIndex.value + 1, totalItems.value - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex.value = Math.max(activeIndex.value - 1, 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        activate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (/^[1-9]$/.test(e.key) && query.value === '') {
        const c = results.value[Number(e.key) - 1];
        if (c) { e.preventDefault(); run(c); }
      }
    }

    Vue.watch(visible, (v) => { if (v) Vue.nextTick(() => { if (inputEl.value) inputEl.value.focus(); }); });
    Vue.watch(results, () => { activeIndex.value = 0; });
    Vue.onMounted(() => document.addEventListener('keydown', onKeydown));
    Vue.onUnmounted(() => document.removeEventListener('keydown', onKeydown));

    return { visible, query, activeIndex, results, isReduced, inputEl, open, close, toggle, run, onKeydown,
      searchIconSvg, searchRaw, searchTotal, searchLoading, searchGroups, totalItems, navigate, runSearch, activate };
  },
  template: `
    <teleport to="body">
      <div v-if="visible" class="cmd-palette-overlay" @click.self="close">
        <div class="cmd-palette" role="dialog" aria-label="命令面板">
          <div class="cmd-palette__search">
            <svg class="cmd-palette__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input
              ref="inputEl"
              v-model="query"
              class="cmd-palette__input"
              placeholder="输入命令、模块名或拼音首字母（如 xm / xiangmu / 项目）"
              @keydown="onKeydown"
            />
            <span class="cmd-palette__hint">ESC 关闭</span>
          </div>
          <ul class="cmd-palette__list" role="listbox">
            <li
              v-for="(cmd, i) in results"
              :key="cmd.id"
              class="cmd-palette__item"
              :class="{ 'cmd-palette__item--active': i === activeIndex }"
              role="option"
              :aria-selected="i === activeIndex"
              @mouseenter="activeIndex = i"
              @click="run(cmd)"
            >
              <span v-if="i < 9" class="cmd-palette__index">{{ i + 1 }}</span>
              <span class="cmd-palette__icon" v-html="cmd.iconSvg"></span>
              <span class="cmd-palette__label">{{ cmd.label }}</span>
              <span class="cmd-palette__type">{{ cmd.typeLabel }}</span>
            </li>
            <li v-if="searchLoading" class="cmd-palette__empty">搜索中…</li>
            <template v-for="g in searchGroups" :key="g.module">
              <li class="cmd-palette__group-head">
                <span class="cmd-palette__group-icon" v-html="searchIconSvg"></span>
                <span class="cmd-palette__group-label">{{ g.label }}</span>
                <span v-if="g.route" class="cmd-palette__viewall" @click="navigate(g.route)">查看全部</span>
              </li>
              <li
                v-for="it in g.items"
                :key="g.module + '-' + it.id"
                class="cmd-palette__item cmd-palette__item--search"
                :class="{ 'cmd-palette__item--active': it.idx === activeIndex }"
                role="option"
                :aria-selected="it.idx === activeIndex"
                @mouseenter="activeIndex = it.idx"
                @click="runSearch(it)"
              >
                <span class="cmd-palette__index cmd-palette__index--blank"></span>
                <span class="cmd-palette__icon cmd-palette__icon--search">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                </span>
                <span class="cmd-palette__label">
                  <span class="cmd-palette__title">{{ it.title }}</span>
                  <span v-if="it.snippet" class="cmd-palette__snippet">{{ it.snippet }}</span>
                </span>
                <span class="cmd-palette__type">搜索</span>
              </li>
            </template>
            <li v-if="results.length === 0 && !searchLoading && totalItems === 0" class="cmd-palette__empty">无匹配命令</li>
          </ul>
          <div class="cmd-palette__footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span><kbd>↵</kbd> 执行</span>
            <span><kbd>ESC</kbd> 关闭</span>
            <span class="cmd-palette__footer-right">Ctrl/Cmd + K 唤起</span>
          </div>
        </div>
      </div>
    </teleport>
  `,
};
window.HtpCommandPalette = HtpCommandPalette;

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
      backup: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-9-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
    };

    // 命令表（离线，pinyinKeys 手写）
    const COMMANDS = [
      { id: 'nav-home', label: '首页总览', type: 'nav', path: '/', typeLabel: '跳转', iconSvg: ICON.nav, pinyinKeys: ['shouye', 'sy', 'shouyezonglan'] },
      { id: 'nav-todo', label: '今日/明日计划', type: 'nav', path: '/todo', typeLabel: '跳转', iconSvg: ICON.nav, pinyinKeys: ['jinri', 'jr', 'mingri', 'mr', 'jihua', 'jh', 'jintian', 'jihua'] },
      { id: 'nav-project', label: '项目管理', type: 'nav', path: '/project', typeLabel: '跳转', iconSvg: ICON.nav, pinyinKeys: ['xiangmu', 'xm', 'xiangmuguanli'] },
      { id: 'nav-develop', label: '开发工作', type: 'nav', path: '/develop', typeLabel: '跳转', iconSvg: ICON.nav, pinyinKeys: ['kaifa', 'kf', 'kaifagongzuo'] },
      { id: 'nav-ent', label: '游戏娱乐', type: 'nav', path: '/entertainment', typeLabel: '跳转', iconSvg: ICON.nav, pinyinKeys: ['youxi', 'yx', 'yule', 'youxuyule'] },
      { id: 'nav-study', label: '充电学习', type: 'nav', path: '/study', typeLabel: '跳转', iconSvg: ICON.nav, pinyinKeys: ['xuexi', 'xx', 'chongdian', 'cd', 'chongdianxuexi'] },
      { id: 'nav-review', label: '复盘与沉淀', type: 'nav', path: '/review', typeLabel: '跳转', iconSvg: ICON.nav, pinyinKeys: ['fupan', 'fp', 'chendian', 'cds', 'fupanyuchendian'] },
      { id: 'nav-secret', label: '凭据保险箱', type: 'nav', path: '/secret', typeLabel: '跳转', iconSvg: ICON.nav, pinyinKeys: ['pingju', 'pj', 'baoxianxiang', 'bx', 'pingjubaoxianxiang'] },
      { id: 'nav-data', label: '数据与部署', type: 'nav', path: '/data', typeLabel: '跳转', iconSvg: ICON.nav, pinyinKeys: ['shuju', 'sj', 'bushu', 'bs', 'shujuheyushu'] },
      { id: 'nav-settings', label: '系统设置', type: 'nav', path: '/settings', typeLabel: '跳转', iconSvg: ICON.nav, pinyinKeys: ['shezhi', 'sz', 'xitong', 'xt', 'xitongshezhi'] },
      { id: 'act-new-todo', label: '新建今日任务', type: 'nav', path: '/todo', typeLabel: '新建', iconSvg: ICON.add, pinyinKeys: ['xinjian', 'xj', 'renwu', 'rw', 'xinjianrenwu', 'xinjianjinrirenwu'] },
      { id: 'act-new-project', label: '新建项目', type: 'nav', path: '/project', typeLabel: '新建', iconSvg: ICON.add, pinyinKeys: ['xinjianxiangmu', 'xjxm', 'xinjian', 'xj'] },
      { id: 'act-new-secret', label: '新建凭据', type: 'nav', path: '/secret', typeLabel: '新建', iconSvg: ICON.add, pinyinKeys: ['xinjianpingju', 'xjpj', 'xinjian', 'xj'] },
      { id: 'act-new-memo', label: '新建备忘', type: 'action', typeLabel: '新建', iconSvg: ICON.add, handler: () => { if (window.__htdApp) window.__htdApp.appStore && null; }, pinyinKeys: ['xinjianbeiwang', 'xjbw', 'beiwang', 'bw', 'xinjian', 'xj'] },
      { id: 'act-theme-dark', label: '切换暗色主题', type: 'theme', theme: 'dark', typeLabel: '主题', iconSvg: ICON.theme, pinyinKeys: ['andise', 'ads', 'qiehuan', 'qh', 'an', 'hei'] },
      { id: 'act-theme-light', label: '切换亮色主题', type: 'theme', theme: 'light', typeLabel: '主题', iconSvg: ICON.theme, pinyinKeys: ['liangse', 'ls', 'qiehuan', 'qh', 'liang', 'bai'] },
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

    function open() {
      visible.value = true;
      query.value = '';
      activeIndex.value = 0;
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
        activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex.value = Math.max(activeIndex.value - 1, 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const c = results.value[activeIndex.value];
        if (c) run(c);
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

    return { visible, query, activeIndex, results, isReduced, inputEl, open, close, toggle, run, onKeydown };
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
            <li v-if="results.length === 0" class="cmd-palette__empty">无匹配命令</li>
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

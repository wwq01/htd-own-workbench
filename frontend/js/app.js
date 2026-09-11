/**
 * 荒天帝工作台 - Vue 应用入口
 * 创建 Vue 实例、注册 Pinia、注册全局组件、初始化路由、挂载布局
 */

// ===== S2-6 地基组件（.vue SFC，依赖 B0 开启的 SFC 能力）=====
import HtpSkeleton from './components/HtpSkeleton.vue';
import HtpSwitch from './components/HtpSwitch.vue';
import HtpTable from './components/HtpTable.vue';
import HtpDrawer from './components/HtpDrawer.vue';
import HtpTooltip from './components/HtpTooltip.vue';
import HtpMarkdownEditor from './components/HtpMarkdownEditor.vue';

// ===== S2-2a 图表组件（.vue SFC，响应式替代 v-html）=====
import HtpBarChart from './components/HtpBarChart.vue';
import HtpDonutChart from './components/HtpDonutChart.vue';
import HtpLineChart from './components/HtpLineChart.vue';
import HtpStackedBarChart from './components/HtpStackedBarChart.vue';
import HtpTimelineChart from './components/HtpTimelineChart.vue';
import HtpChartLegend from './components/HtpChartLegend.vue';
import HtpGraphCanvas from './components/HtpGraphCanvas.vue';

// ===== 导航菜单配置 =====
// ===== 导航菜单配置（S1：由 registry.js 单一数据源派生，新增模块无需改本文件）=====
const NAV_ITEMS =
  window.htdRegistry && window.htdRegistry.buildNavItems
    ? window.htdRegistry.buildNavItems()
    : [];

// ===== 产品 Logo SVG =====
const LOGO_SVG = `<svg class="app-sidebar__logo-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 2L4 7v8c0 7 5 12 12 15 7-3 12-8 12-15V7L16 2z" fill="var(--color-primary)" fill-opacity="0.15" stroke="var(--color-primary)" stroke-width="1.5"/>
  <path d="M16 8L10 14v8h4v-4h4v4h4v-8L16 8z" fill="var(--color-primary)"/>
</svg>`;

// ===== 主应用组件 =====
const App = {
  name: 'App',
  setup() {
    const appStore = useAppStore();
    const uiStore = window.useUiStore ? window.useUiStore() : null;
    const dataStore = useDataStore();

    // 命令面板引用（Ctrl/Cmd+K 唤起）
    const paletteRef = Vue.ref(null);

    // 当前路由信息
    const currentRoute = Vue.ref(null);
    const currentParams = Vue.ref({});
    const currentPath = Vue.ref('/');

    // 快速备忘输入
    const memoInput = Vue.ref('');

    // 导航菜单
    const navItems = NAV_ITEMS;

    // 备份状态点数据源（顶栏展示，§5.1.7）
    const backupStatus = Vue.ref(null);
    const backupError = Vue.ref('');
    let backupPollTimer = null;

    // 页面组件映射
    // 页面组件映射（S1：由 registry.js 派生，延迟求值以等待全局组件变量就绪）
    const pageComponents =
      window.htdRegistry && window.htdRegistry.buildPageComponents
        ? window.htdRegistry.buildPageComponents()
        : {};

    // 当前页面组件
    const currentPage = Vue.computed(() => {
      const route = currentRoute.value;
      if (!route) return pageComponents.home;
      return pageComponents[route.module] || pageComponents.home;
    });

    // 当前页面标题
    const pageTitle = Vue.computed(() => {
      return currentRoute.value?.title || '首页总览';
    });

    // 保存状态文字（顶栏状态点标签，§5.3.2）
    const saveLabel = Vue.computed(() => {
      if (!uiStore) return '';
      const map = { idle: '', saving: '保存中', saved: '已保存', failed: '保存失败' };
      return map[uiStore.saveState] || '';
    });

    // 备份状态文字（§5.1.7）
    const backupLabel = Vue.computed(() => {
      if (!backupStatus.value) return '';
      if (backupStatus.value.autoPaused) return '备份已暂停';
      const map = { idle: '', pending: '备份中', success: '已备份', error: '备份失败', saved: '已备份' };
      return map[backupStatus.value.status] || '';
    });

    // 导航点击
    function handleNav(path) {
      htdRouter.navigate(path);
    }

    // 导航图标内联渲染：兼容裸 path d 字符串（多数项）与完整 <path> 子元素串（poc/bid/vuln/incident）
    function navIconInner(icon) {
      if (typeof icon === 'string' && icon.trim().startsWith('<')) return icon;
      return `<path stroke-linecap="round" stroke-linejoin="round" d="${icon}"></path>`;
    }

    // 命令面板唤起
    function openPalette() {
      if (paletteRef.value) paletteRef.value.open();
    }

    // 全局快捷键：Ctrl/Cmd + K 唤起命令面板
    function handleGlobalKeydown(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openPalette();
      }
    }

    // 手动保存全部草稿（§5.3.4）：广播 flush 事件，V1.3 模块接入 DraftSaver 后生效
    function manualSaveAll() {
      if (window.eventBus) window.eventBus.emit('ui:flush-all');
      showToast('已触发全部保存', 'success');
    }

    // 拉取备份运行状态（顶栏状态点）
    async function loadBackupStatus() {
      try {
        const s = await htdApi.get('/system/backups/status');
        backupStatus.value = s;
        backupError.value = s && s.error ? s.error : '';
      } catch (e) {
        // 状态查询失败不阻塞主流程
      }
    }

    // 快速备忘保存（直接调 dataStore.createMemo，已包含校验+toast+刷新）
    async function saveMemo() {
      const content = memoInput.value;
      if (!content || !content.trim()) return;
      try {
        const created = await dataStore.createMemo(content);
        if (created) memoInput.value = '';
      } catch (e) {
        // dataStore 内部已 showToast 错误提示
      }
    }

    // 一键导出
    function handleExport() {
      showToast('导出功能即将上线', 'warning');
    }

    // 监听路由变化
    Vue.onMounted(() => {
      // 先挂载路由变化回调的桥接对象，确保 initRouter 首次 renderRoute 能写入数据
      window.__htdApp = {
        get currentRoute() { return currentRoute.value; },
        set currentRoute(v) { currentRoute.value = v; },
        get currentParams() { return currentParams.value; },
        set currentParams(v) { currentParams.value = v; },
        get currentPath() { return currentPath.value; },
        set currentPath(v) {
          currentPath.value = v;
          appStore.setPath(v);
        },
      };

      // 再初始化路由（首次 renderRoute 会写入上面的桥接对象）
      htdRouter.initRouter();

      // 拉取初始数据
      dataStore.fetchStatistics();
      dataStore.fetchHomeSummary();
      appStore.refreshDataCount();
      appStore.loadSettings();

      // 命令面板全局快捷键
      window.addEventListener('keydown', handleGlobalKeydown);

      // 备份状态轮询（轻量，8s 一次）
      loadBackupStatus();
      backupPollTimer = setInterval(loadBackupStatus, 8000);
    });

    Vue.onUnmounted(() => {
      window.removeEventListener('keydown', handleGlobalKeydown);
      if (backupPollTimer) clearInterval(backupPollTimer);
    });

    return {
      appStore,
      uiStore,
      dataStore,
      navItems,
      currentPage,
      pageTitle,
      memoInput,
      LOGO_SVG,
      paletteRef,
      backupStatus,
      backupError,
      saveLabel,
      backupLabel,
      handleNav,
      navIconInner,
      saveMemo,
      handleExport,
      openPalette,
      manualSaveAll,
    };
  },
  template: `
    <div class="app-layout">
      <!-- 左侧导航栏 -->
      <aside class="app-sidebar">
        <div class="app-sidebar__logo">
          <span v-html="LOGO_SVG"></span>
          <span class="app-sidebar__logo-text">荒天帝工作台</span>
        </div>
        <nav class="app-sidebar__nav">
          <div
            v-for="item in navItems"
            :key="item.path"
            class="app-sidebar__nav-item"
            :class="{ 'app-sidebar__nav-item--active': appStore.currentPath === item.path }"
            @click="handleNav(item.path)"
          >
            <svg class="app-sidebar__nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" v-html="navIconInner(item.icon)"></svg>
            <span>{{ item.label }}</span>
          </div>
        </nav>
        <div class="app-sidebar__footer">
          <div class="app-sidebar__version">v{{ appStore.version }}</div>
          <div class="app-sidebar__stats">数据条目：{{ appStore.totalDataCount }}</div>
        </div>
      </aside>

      <!-- 右侧主区域 -->
      <main class="app-main">
        <!-- 顶部工具栏 -->
        <header class="app-topbar">
          <span class="app-topbar__title" id="page-title">{{ pageTitle }}</span>
          <div class="app-topbar__memo-input">
            <HtpInput
              v-model="memoInput"
              
              placeholder="快速备忘... 输入后按回车保存"
              @keyup.enter="saveMemo"
             />
          </div>
          <div class="app-topbar__actions">
            <button class="htp-btn htp-btn--text htp-btn--sm app-topbar__search" @click="openPalette" title="命令面板 (Ctrl/Cmd+K)">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7"></circle><path stroke-linecap="round" d="M21 21l-4.3-4.3"></path>
              </svg>
            </button>
            <status-dot
              v-if="uiStore && uiStore.saveState !== 'idle'"
              :status="uiStore.saveState"
              :label="saveLabel"
              :title="uiStore.saveError || saveLabel"
            ></status-dot>
            <status-dot
              v-if="backupStatus && (backupStatus.status !== 'idle' || backupStatus.autoPaused)"
              :status="backupStatus.autoPaused ? 'error' : (backupStatus.status === 'success' ? 'success' : backupStatus.status)"
              :label="backupLabel"
              :title="backupError || backupLabel"
            ></status-dot>
            <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="manualSaveAll" title="保存全部草稿">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
              </svg>
              保存
            </button>
            <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="handleExport">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              导出数据
            </button>
          </div>
        </header>

        <!-- 主内容区 -->
        <div class="app-content">
          <component :is="currentPage"></component>
        </div>
      </main>

      <!-- 命令面板（独立挂载，最高层） -->
      <htp-command-palette ref="paletteRef"></htp-command-palette>
    </div>
  `,
};

// ===== 创建 Vue 应用 =====
const app = Vue.createApp(App);

// 暴露统一语义图标函数给所有模板（替代 emoji，遵守 P0-1 红线）
app.config.globalProperties.htdIcon = window.htdIcon;

// 安装 Pinia
app.use(window.htdPinia);

// 注册全局组件
app.component('HtpButton', HtpButton);
app.component('HtpModal', HtpModal);
app.component('HtpCard', HtpCard);
app.component('HtpInput', HtpInput);
app.component('HtpTextarea', HtpTextarea);
app.component('HtpSelect', HtpSelect);
app.component('HtpTag', HtpTag);
app.component('HtpCheckbox', HtpCheckbox);
app.component('HtpEmpty', HtpEmpty);
app.component('StatusDot', StatusDot);
app.component('HtpCommandPalette', HtpCommandPalette);
app.component('ConfirmPermanentDelete', ConfirmPermanentDelete);

// S2-6 地基组件注册（.vue SFC）
app.component('HtpSkeleton', HtpSkeleton);
app.component('HtpSwitch', HtpSwitch);
app.component('HtpTable', HtpTable);
app.component('HtpDrawer', HtpDrawer);
app.component('HtpTooltip', HtpTooltip);
app.component('HtpMarkdownEditor', HtpMarkdownEditor);
// S2-2a 图表组件注册
app.component('HtpBarChart', HtpBarChart);
app.component('HtpDonutChart', HtpDonutChart);
app.component('HtpLineChart', HtpLineChart);
app.component('HtpStackedBarChart', HtpStackedBarChart);
app.component('HtpTimelineChart', HtpTimelineChart);
app.component('HtpChartLegend', HtpChartLegend);
app.component('HtpGraphCanvas', HtpGraphCanvas);

// 挂载应用
app.mount('#app');

console.log('荒天帝工作台前端已启动');

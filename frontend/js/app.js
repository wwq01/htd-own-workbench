/**
 * 荒天帝工作台 - Vue 应用入口
 * 创建 Vue 实例、注册 Pinia、注册全局组件、初始化路由、挂载布局
 */

// ===== 导航菜单配置 =====
const NAV_ITEMS = [
  { path: '/', label: '首页总览', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/todo', label: '今日/明日计划', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { path: '/project', label: '项目管理', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { path: '/meeting', label: '会议纪要', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 0a4 4 0 100-8 4 4 0 000 8z' },
  { path: '/develop', label: '开发工作', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  { path: '/time-block', label: '时间块/番茄钟', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/entertainment', label: '游戏娱乐', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/finance', label: '财务速记', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/study', label: '充电学习', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { path: '/habit', label: '习惯打卡', icon: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A8.003 8.003 0 0118 15c-1.657 0-3-1.343-3-3 0 1.657-1.343 3-3 3s-3-1.343-3-3c0 1.657-1.343 3-3 3a8 8 0 008 8z' },
  { path: '/review', label: '复盘与沉淀', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { path: '/vault', label: '沉淀 Vault', icon: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM2 12h20M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6' },
  { path: '/secret', label: '凭据保险箱', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { path: '/data', label: '数据与部署', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4' },
  { path: '/system/recycle-bin', label: '回收站', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  { path: '/poc', label: 'POC 跟踪', icon: '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>' },
  { path: '/bid', label: '投标档案', icon: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>' },
  { path: '/vuln', label: '漏洞跟踪库', icon: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>' },
  { path: '/incident', label: '应急响应记录', icon: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>' },
  { path: '/settings', label: '系统设置', icon: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M19.4 15a1.7 1.7 0 00.34 1.88l.06.06-1.42 1.42-.06-.06A1.7 1.7 0 0016.44 18l-.38.16a1.7 1.7 0 00-1.06 1.57V20h-2v-.27a1.7 1.7 0 00-1.06-1.57l-.38-.16a1.7 1.7 0 00-1.88.34l-.06.06-1.42-1.42.06-.06A1.7 1.7 0 008.6 15l-.16-.38a1.7 1.7 0 00-1.57-1.06H6v-2h.87a1.7 1.7 0 001.57-1.06L8.6 10a1.7 1.7 0 00-.34-1.88l-.06-.06L9.62 6.64l.06.06A1.7 1.7 0 0011.56 7l.38-.16A1.7 1.7 0 0013 5.27V5h2v.27a1.7 1.7 0 001.06 1.57l.38.16a1.7 1.7 0 001.88-.34l.06-.06 1.42 1.42-.06.06A1.7 1.7 0 0019.4 10l.16.38a1.7 1.7 0 001.57 1.06H22v2h-.87a1.7 1.7 0 00-1.57 1.06L19.4 15z' },
];

// ===== 产品 Logo SVG =====
const LOGO_SVG = `<svg class="app-sidebar__logo-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 2L4 7v8c0 7 5 12 12 15 7-3 12-8 12-15V7L16 2z" fill="#3B82F6" fill-opacity="0.15" stroke="#3B82F6" stroke-width="1.5"/>
  <path d="M16 8L10 14v8h4v-4h4v4h4v-8L16 8z" fill="#3B82F6"/>
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
    const pageComponents = {
      home: HomePage,
      todo: TodoPage,
      project: ProjectPage,
      develop: DevelopPage,
      entertainment: EntertainmentPage,
      study: StudyPage,
      review: ReviewPage,
      secret: SecretPage,
      data: DataPage,
      settings: SettingsPage,
      meeting: MeetingPage,
      habit: HabitPage,
      'time-block': TimeBlockPage,
      finance: FinancePage,
      vault: VaultPage,
      'recycle-bin': RecycleBinPage,
      poc: PocPage,
      bid: BidPage,
      vuln: VulnPage,
      incident: IncidentPage,
    };

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
            <svg class="app-sidebar__nav-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon"></path>
            </svg>
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
            <input
              v-model="memoInput"
              class="htp-input"
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

// 挂载应用
app.mount('#app');

console.log('荒天帝工作台前端已启动');

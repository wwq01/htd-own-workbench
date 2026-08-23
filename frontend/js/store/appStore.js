/**
 * 应用全局状态：导航、主题、全局配置
 */
const useAppStore = Pinia.defineStore('app', {
  state: () => ({
    // 当前导航路径
    currentPath: '/',
    // 当前页面标题
    currentTitle: '首页总览',
    // 侧边栏折叠状态（预留）
    sidebarCollapsed: false,
    // 全局快速备忘输入值
    memoInput: '',
    // 版本号
    version: '1.4.0',
    // 总数据条目数（侧边栏底部展示）
    totalDataCount: 0,
    settings: {
      theme: 'dark',
      appearance: 'liquid-glass',
      decoration: 'on',
      dataRoot: '',
      backupFrequency: 'startup',
      maxBackups: 7,
    },
  }),

  getters: {
    // 当前激活的模块
    currentModule() {
      const pathMap = {
        '/': 'home',
        '/todo': 'todo',
        '/project': 'project',
        '/develop': 'develop',
        '/entertainment': 'entertainment',
        '/study': 'study',
        '/review': 'review',
        '/secret': 'secret',
        '/data': 'data',
      };
      return pathMap[this.currentPath] || 'home';
    },
  },

  actions: {
    // 三维主题：设置 <html> 的 data-appearance / data-theme / data-decoration 三属性。
    // 优先复用 theme-manager（window.htdTheme）以保证 localStorage 同步与降级策略一致；
    // 若其尚未就绪则直接写 data 属性降级。组件 CSS / class 名零改动。
    applyAppearance(partial) {
      partial = partial || {};
      if (window.htdTheme && typeof window.htdTheme.applyTheme === 'function') {
        return window.htdTheme.applyTheme(partial);
      }
      var d = document.documentElement;
      if (partial.appearance) d.setAttribute('data-appearance', partial.appearance);
      if (partial.theme) d.setAttribute('data-theme', partial.theme === 'light' ? 'light' : 'dark');
      if (partial.decoration) d.setAttribute('data-decoration', partial.decoration);
      return {
        appearance: d.getAttribute('data-appearance') || 'liquid-glass',
        theme: d.getAttribute('data-theme') || 'dark',
        decoration: d.getAttribute('data-decoration') || 'on',
      };
    },

    // 旧版单轴主题设置器（仅切 data-theme），保留兼容既有调用方
    applyTheme(theme) {
      return this.applyAppearance({ theme: theme });
    },

    async loadSettings() {
      try {
        const data = await htdApi.get('/system/settings');
        this.settings = data;
        this.applyAppearance({
          theme: data.theme,
          appearance: data.appearance,
          decoration: data.decoration,
        });
      } catch (err) {
        this.applyTheme(this.settings.theme);
      }
    },

    async saveSettings(payload) {
      const data = await htdApi.put('/system/settings', payload);
      this.settings = data;
      this.applyAppearance({
        theme: data.theme,
        appearance: data.appearance,
        decoration: data.decoration,
      });
      return data;
    },

    // 设置当前路径
    setPath(path) {
      this.currentPath = path;
    },

    // 设置总数据条目数
    setTotalDataCount(count) {
      this.totalDataCount = count;
    },

    // 更新总数据条目数（从后端拉取）
    async refreshDataCount() {
      try {
        const data = await htdApi.get('/system/data-stats');
        this.totalDataCount = data.totalCount;
      } catch (err) {
        console.error('获取数据统计失败:', err);
      }
    },
  },
});

window.useAppStore = useAppStore;

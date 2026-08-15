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
    version: '1.2.0',
    // 总数据条目数（侧边栏底部展示）
    totalDataCount: 0,
    settings: {
      theme: 'dark',
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
    applyTheme(theme) {
      document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
    },

    async loadSettings() {
      try {
        const data = await htdApi.get('/system/settings');
        this.settings = data;
        this.applyTheme(data.theme);
      } catch (err) {
        this.applyTheme(this.settings.theme);
      }
    },

    async saveSettings(payload) {
      const data = await htdApi.put('/system/settings', payload);
      this.settings = data;
      this.applyTheme(data.theme);
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

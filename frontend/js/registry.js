/**
 * 模块注册表（单一数据源）
 *
 * S1 重构：此前新增一个业务模块需手工改 6 处（router.js registerRoute /
 * app.js NAV_ITEMS / app.js pageComponents / index.html script /
 * HtpCommandPalette COMMANDS / dataStore action），极易漂移。
 * 本文件收敛为唯一声明处，其余注册点全部派生。
 *
 * 加载顺序约束（无构建架构，全局脚本顺序敏感）：
 *   本文件必须在 router.js / app.js / HtpCommandPalette.js 之前加载。
 *   pageComponents 依赖全局组件变量，故由 app.js 在 setup 内延迟求值
 *   （通过 window[component] 动态查找），不在此处直接引用。
 *
 * 字段说明：
 *   key        模块标识，与 router 的 module 字段一致
 *   path       路由路径
 *   title      页面标题（router 用）
 *   label      导航显示名（NAV 用，缺省回退 title）
 *   icon       导航图标 SVG 内容（兼容两种格式：单 path 的 d 串 / 完整 path 子元素串）
 *   component  全局组件变量名（app.js 通过 window[component] 延迟查找）
 *   group      功能分组：work 工作 / life 生活 / knowledge 知识 / system 系统 / home 首页
 *   pinyin     命令面板拼音检索键
 *   nav        是否显示在侧边栏（默认 true）
 */
const MODULE_META = [
  {
    key: 'home',
    path: '/',
    title: '首页总览',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    component: 'HomePage',
    group: 'home',
    pinyin: ['shouye', 'sy', 'zonglan', 'zl', 'shouyezonglan'],
  },
  {
    key: 'todo',
    path: '/todo',
    title: '今日工作 / 明日计划',
    label: '今日/明日计划',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    component: 'TodoPage',
    group: 'work',
    pinyin: ['jinri', 'jr', 'mingri', 'mr', 'jihua', 'jh', 'renwu', 'rw', 'jinrigongzuo'],
  },
  {
    key: 'project',
    path: '/project',
    title: '项目管理',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    component: 'ProjectPage',
    group: 'work',
    pinyin: ['xiangmu', 'xm', 'xiangmuguanli', 'xmgl'],
  },
  {
    key: 'meeting',
    path: '/meeting',
    title: '会议纪要',
    icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 0a4 4 0 100-8 4 4 0 000 8z',
    component: 'MeetingPage',
    group: 'work',
    pinyin: ['huiyi', 'hy', 'huiyijiyao', 'hyjy', 'jiyao', 'jy'],
  },
  {
    key: 'develop',
    path: '/develop',
    title: '开发工作',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    component: 'DevelopPage',
    group: 'work',
    pinyin: ['kaifa', 'kf', 'kaifagongzuo', 'kfgz', 'daima', 'dm'],
  },
  {
    key: 'time-block',
    path: '/time-block',
    title: '时间块/番茄钟',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    component: 'TimeBlockPage',
    group: 'life',
    pinyin: ['shijiankuai', 'sjk', 'fanqiezhong', 'fqz', 'fanqie', 'fq', 'shijian', 'sj'],
  },
  {
    key: 'entertainment',
    path: '/entertainment',
    title: '游戏娱乐',
    icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    component: 'EntertainmentPage',
    group: 'life',
    pinyin: ['youxi', 'yx', 'yule', 'yl', 'youxiyule'],
  },
  {
    key: 'finance',
    path: '/finance',
    title: '财务速记',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    component: 'FinancePage',
    group: 'life',
    pinyin: ['caiwu', 'cw', 'caiwusuji', 'cwsj', 'zhangben', 'zb', 'jizhang', 'jz'],
  },
  {
    key: 'study',
    path: '/study',
    title: '充电学习',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    component: 'StudyPage',
    group: 'knowledge',
    pinyin: ['xuexi', 'xx', 'chongdian', 'cd', 'chongdianxuexi', 'cdxx'],
  },
  {
    key: 'habit',
    path: '/habit',
    title: '习惯打卡',
    icon: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A8.003 8.003 0 0118 15c-1.657 0-3-1.343-3-3 0 1.657-1.343 3-3 3s-3-1.343-3-3c0 1.657-1.343 3-3 3a8 8 0 008 8z',
    component: 'HabitPage',
    group: 'life',
    pinyin: ['xiguan', 'xg', 'daka', 'dk', 'xiguandaka', 'xgdk'],
  },
  {
    key: 'review',
    path: '/review',
    title: '复盘与沉淀',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    component: 'ReviewPage',
    group: 'knowledge',
    pinyin: ['fupan', 'fp', 'fupanyuchendian', 'fpycd', 'chendian', 'cd'],
  },
  {
    key: 'vault',
    path: '/vault',
    title: '沉淀 Vault',
    icon: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM2 12h20M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6',
    component: 'VaultPage',
    group: 'knowledge',
    pinyin: ['vault', 'chendian', 'cd', 'chenpindian', 'zhishiku', 'zsk'],
  },
  {
    key: 'secret',
    path: '/secret',
    title: '轻量凭据保险箱',
    label: '凭据保险箱',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    component: 'SecretPage',
    group: 'system',
    pinyin: ['pingju', 'pj', 'baoxianxiang', 'bxx', 'mima', 'mm', 'pingjubaoxianxiang'],
  },
  {
    key: 'data',
    path: '/data',
    title: '数据与部署',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
    component: 'DataPage',
    group: 'system',
    pinyin: ['shuju', 'sj', 'bushu', 'bs', 'shujuyubushu', 'beifen', 'bf'],
  },
  {
    key: 'recycle-bin',
    path: '/system/recycle-bin',
    title: '回收站',
    icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    component: 'RecycleBinPage',
    group: 'system',
    pinyin: ['huishouzhan', 'hsz', 'huishou', 'hs', 'lajixiang', 'ljx'],
  },
  {
    key: 'poc',
    path: '/poc',
    title: 'POC 跟踪',
    icon: '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>',
    component: 'PocPage',
    group: 'work',
    pinyin: ['poc', 'genzong', 'gz', 'pocgenzong', 'ceshi', 'cs'],
  },
  {
    key: 'bid',
    path: '/bid',
    title: '投标档案',
    icon: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    component: 'BidPage',
    group: 'work',
    pinyin: ['toubiao', 'tb', 'toubiaodangan', 'tbdang', 'dangan', 'da'],
  },
  {
    key: 'vuln',
    path: '/vuln',
    title: '漏洞跟踪库',
    icon: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    component: 'VulnPage',
    group: 'work',
    pinyin: ['loudong', 'ld', 'loudonggenzong', 'ldgk', 'loudongku'],
  },
  {
    key: 'incident',
    path: '/incident',
    title: '应急响应记录',
    icon: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    component: 'IncidentPage',
    group: 'work',
    pinyin: ['yingji', 'yj', 'yingjixiangying', 'yjxy', 'xiangying', 'xy'],
  },
  {
    key: 'reading',
    path: '/reading',
    title: '阅读资料',
    icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
    component: 'ReadingPage',
    group: 'knowledge',
    pinyin: ['yuedu', 'yd', 'yueduziliao', 'ydzl', 'ziliao', 'zl', 'wenzhang', 'wz'],
  },
  {
    key: 'settings',
    path: '/settings',
    title: '系统设置',
    icon: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M19.4 15a1.7 1.7 0 00.34 1.88l.06.06-1.42 1.42-.06-.06A1.7 1.7 0 0016.44 18l-.38.16a1.7 1.7 0 00-1.06 1.57V20h-2v-.27a1.7 1.7 0 00-1.06-1.57l-.38-.16a1.7 1.7 0 00-1.88.34l-.06.06-1.42-1.42.06-.06A1.7 1.7 0 008.6 15l-.16-.38a1.7 1.7 0 00-1.57-1.06H6v-2h.87a1.7 1.7 0 001.57-1.06L8.6 10a1.7 1.7 0 00-.34-1.88l-.06-.06L9.62 6.64l.06.06A1.7 1.7 0 0011.56 7l.38-.16A1.7 1.7 0 0013 5.27V5h2v.27a1.7 1.7 0 001.06 1.57l.38.16a1.7 1.7 0 001.88-.34l.06-.06 1.42 1.42-.06.06A1.7 1.7 0 0019.4 10l.16.38a1.7 1.7 0 001.57 1.06H22v2h-.87a1.7 1.7 0 00-1.57 1.06L19.4 15z',
    component: 'SettingsPage',
    group: 'system',
    pinyin: ['shezhi', 'sz', 'xitong', 'xt', 'xitongshezhi', 'xtsz'],
  },
];

/**
 * 派生：侧边栏导航项（保持原有顺序与视觉，不新增分组渲染）
 * @returns {Array<{path:string,label:string,icon:string}>}
 */
function buildNavItems() {
  return MODULE_META
    .filter((m) => m.nav !== false)
    .map((m) => ({ path: m.path, label: m.label || m.title, icon: m.icon }));
}

/**
 * 派生：命令面板导航命令
 * @param {object} iconSvg 命令面板的 nav 图标（SVG 字符串）
 * @returns {Array<object>}
 */
function buildNavCommands(iconSvg) {
  return MODULE_META
    .filter((m) => m.nav !== false)
    .map((m) => ({
      id: 'nav-' + m.key,
      label: m.label || m.title,
      type: 'nav',
      path: m.path,
      typeLabel: '跳转',
      iconSvg: iconSvg,
      pinyinKeys: m.pinyin || [],
    }));
}

/**
 * 派生：页面组件映射（延迟求值，依赖全局组件变量已加载）
 * @returns {object} { [moduleKey]: Component }
 */
function buildPageComponents() {
  const map = {};
  MODULE_META.forEach((m) => {
    const comp = window[m.component];
    if (comp) map[m.key] = comp;
  });
  return map;
}

if (typeof window !== 'undefined') {
  window.MODULE_META = MODULE_META;
  window.htdRegistry = {
    MODULE_META,
    buildNavItems,
    buildNavCommands,
    buildPageComponents,
  };
}

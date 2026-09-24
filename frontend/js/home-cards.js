/**
 * 首页卡片声明表（单一数据源）
 *
 * 背景：此前首页 11 张卡片 + 11 个 goXxx() 导航函数全部硬编码在 HomePage.js 模板里，
 *       新增/调整一张卡片要改 4 处，且跳转路径字符串与 registry.js 的 path 是两份独立事实
 *       （改路由若只改 registry，首页按钮静默跳 404，且无测试拦截）。
 * 本文件收敛为唯一声明处，HomePage.js 由它派生渲染。
 *
 * 加载顺序约束：须在 registry.js 之后（解析 module -> path 依赖 window.htdRegistry）、
 *               HomePage.js 之前（页面 setup 期读取）。
 *
 * 字段说明：
 *   key        卡片唯一标识
 *   column     所属栏：work 工作 / life 生活 / knowledge 知识
 *   title      卡片标题
 *   type       渲染形态：progress | stat | count | ratio | finance | list | action
 *   module     跳转目标（MODULE_META 的 key，非手写路径）；null = 整卡不可点
 *   source     数据路径（相对后端 /system/home-summary 返回结构，点分）
 *   viewAll    是否显示右上角跳转按钮
 *   viewAllText 右上角按钮文案（缺省「查看全部」）
 *   empty      list/action 空态文案
 *   accent     数值是否用强调色
 *   hint       数值下方静态后缀文案
 *   hintTpl    count 类型的文案模板，{field} 占位取自同一数据对象
 *   itemKey    list/action 行的 :key 字段（缺省 id）
 *   itemTitle  list/action 行主标题字段
 *   itemSub    list/action 行副标题（纯函数，仅在浏览器渲染时执行）
 *   itemDot    行首圆点取色字段（可选）
 *   detail     行点击是否带 ?id= 定位
 *   action     action 类型行内按钮行为：checkIn（打卡 +1）/ generate（生成沉淀）
 */

/** 三栏定义（图标名对应 utils/icons.js 的 htdIcon） */
const HOME_COLUMNS = [
  { key: 'work', title: '工作组', icon: 'building', className: 'home-col--work' },
  { key: 'life', title: '生活组', icon: 'leaf', className: 'home-col--life' },
  { key: 'knowledge', title: '知识组', icon: 'book', className: 'home-col--knowledge' },
];

/**
 * 后端 /system/home-summary 返回结构的合法数据路径白名单。
 * 门禁据此校验卡片 source，防止写错路径导致卡片静默空白。
 */
const HOME_DATA_PATHS = [
  'work.todayProgress',
  'work.tomorrowCount',
  'work.activeProjects',
  'work.recentMeetings',
  'work.expiringSecrets',
  'life.todayHabits',
  'life.maxStreak',
  'life.todayTomatoes',
  'life.financeMonth',
  'knowledge.vaultWeek',
  'knowledge.studying',
  'knowledge.recommendations',
];

/** 允许的渲染形态 */
const HOME_CARD_TYPES = ['progress', 'stat', 'count', 'ratio', 'finance', 'list', 'action'];

const HOME_CARDS = [
  // ===== 工作组 =====
  {
    key: 'todo-progress',
    column: 'work',
    title: '今日任务进度',
    type: 'progress',
    module: 'todo',
    source: 'work.todayProgress',
  },
  {
    key: 'todo-tomorrow',
    column: 'work',
    title: '明日待安排',
    type: 'stat',
    module: 'todo',
    source: 'work.tomorrowCount',
    hint: '条任务已排入明日',
    accent: true,
  },
  {
    key: 'project-active',
    column: 'work',
    title: '进行中项目',
    type: 'list',
    module: 'project',
    source: 'work.activeProjects',
    viewAll: true,
    viewAllText: '查看全部',
    empty: '暂无进行中的项目',
    itemTitle: 'name',
    itemSub: (p) => `${p.phase} · 进度 ${p.progress}%`,
    itemDot: 'phaseColor',
    detail: true,
  },
  {
    key: 'meeting-recent',
    column: 'work',
    title: '最近会议纪要',
    type: 'list',
    module: 'meeting',
    source: 'work.recentMeetings',
    viewAll: true,
    viewAllText: '查看全部',
    empty: '暂无会议纪要',
    itemTitle: 'title',
    itemSub: (m) => (window.htdDate ? window.htdDate.formatDate(m.heldAt) : ''),
    detail: true,
  },
  {
    key: 'secret-expiring',
    column: 'work',
    title: '凭据即将到期',
    type: 'stat',
    module: 'secret',
    source: 'work.expiringSecrets',
    hint: '条凭据 7 天内到期',
    accent: true,
  },

  // ===== 生活组 =====
  {
    key: 'habit-today',
    column: 'life',
    title: '今日待打卡',
    type: 'action',
    module: 'habit',
    source: 'life.todayHabits',
    viewAll: true,
    viewAllText: '查看全部',
    empty: '今日习惯已全部达标',
    itemTitle: 'name',
    itemSub: (h) => `${h.kind === 'weekly' ? '本周 ' : '今日 '}${h.current} / ${h.target}`,
    action: 'checkIn',
  },
  {
    key: 'habit-streak',
    column: 'life',
    title: '连续打卡最长',
    type: 'stat',
    module: null,
    source: 'life.maxStreak',
    hint: '天（历史纪录）',
    accent: true,
  },
  {
    key: 'tomato-today',
    column: 'life',
    title: '今日番茄钟',
    type: 'ratio',
    module: 'time-block',
    source: 'life.todayTomatoes',
    hint: '已完成专注时段',
  },
  {
    key: 'finance-month',
    column: 'life',
    title: '本月财务净流入',
    type: 'finance',
    module: 'finance',
    source: 'life.financeMonth',
  },

  // ===== 知识组 =====
  {
    key: 'vault-week',
    column: 'knowledge',
    title: '本周沉淀',
    type: 'count',
    module: 'vault',
    source: 'knowledge.vaultWeek',
    hintTpl: '草稿 {draft} · 已沉淀 {precipitated}',
    accent: true,
  },
  {
    key: 'study-pending',
    column: 'knowledge',
    title: '充电学习中',
    type: 'list',
    module: 'study',
    source: 'knowledge.studying',
    viewAll: true,
    viewAllText: '查看全部',
    empty: '暂无待学资源',
    itemTitle: 'title',
  },
  {
    key: 'vault-recommend',
    column: 'knowledge',
    title: '推荐待写沉淀',
    type: 'action',
    module: 'review',
    source: 'knowledge.recommendations',
    viewAll: true,
    viewAllText: '去复盘',
    empty: '本周暂无值得沉淀的产出',
    itemKey: 'sourceId',
    itemTitle: 'title',
    action: 'generate',
  },
];

/** 底部通栏入口卡（不属于三栏） */
const HOME_FEATURE_CARDS = [
  {
    key: 'agent-inbox',
    title: '本地 Agent 收件箱',
    type: 'feature',
    module: 'agent',
    hint: '本地确定性智能体：提交指令 → 自动匹配技能 → 本机执行，不联网',
    viewAllText: '打开 ›',
  },
];

/**
 * 安全取深层属性（路径不存在时返回 undefined，不抛错）
 * @param {object} obj 根对象
 * @param {string} path 点分路径，如 'work.todayProgress'
 */
function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, seg) => (acc == null ? undefined : acc[seg]), obj);
}

/**
 * 模板插值：'草稿 {draft} · 已沉淀 {precipitated}' + {draft:1,...}
 * @param {string} tpl
 * @param {object} obj
 */
function renderTpl(tpl, obj) {
  if (!tpl) return '';
  return String(tpl).replace(/\{(\w+)\}/g, (_, k) => (obj && obj[k] != null ? obj[k] : ''));
}

/**
 * 解析模块路由路径（依赖 registry 单一数据源，杜绝手写路径字符串）
 * @param {string} key MODULE_META 的 key
 * @returns {string|null}
 */
function resolveModulePath(key) {
  if (!key) return null;
  const meta = (typeof window !== 'undefined' && window.htdRegistry && window.htdRegistry.MODULE_META) || [];
  const found = meta.filter((m) => m.key === key)[0];
  return found ? found.path : null;
}

/**
 * 派生：按栏分组的卡片列表（含解析后的 path 与取好的 data）
 * @param {object} home 后端 home-summary 数据
 * @returns {Array<{key,title,icon,className,cards:Array}>}
 */
function buildHomeCards(home) {
  return HOME_COLUMNS.map((col) => ({
    key: col.key,
    title: col.title,
    icon: col.icon,
    className: col.className,
    cards: HOME_CARDS.filter((c) => c.column === col.key).map((c) => ({
      ...c,
      path: resolveModulePath(c.module),
      data: getByPath(home, c.source),
      items: Array.isArray(getByPath(home, c.source)) ? getByPath(home, c.source) : [],
    })),
  }));
}

/**
 * 派生：底部通栏入口卡
 * @returns {Array}
 */
function buildFeatureCards() {
  return HOME_FEATURE_CARDS.map((c) => ({ ...c, path: resolveModulePath(c.module) }));
}

if (typeof window !== 'undefined') {
  window.htdHomeCards = {
    HOME_COLUMNS,
    HOME_CARDS,
    HOME_FEATURE_CARDS,
    HOME_DATA_PATHS,
    HOME_CARD_TYPES,
    getByPath,
    renderTpl,
    resolveModulePath,
    buildHomeCards,
    buildFeatureCards,
  };
}

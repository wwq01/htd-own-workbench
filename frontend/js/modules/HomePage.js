/**
 * 首页总览页面（V1.3 三栏版 §6.1）
 * 说明：模板中不使用可选链 (?.) 语法、不直接调用 htdDate 全局对象，
 *       而是通过 setup 返回的封装函数，兼容 Vue 3 无构建运行时模板编译器
 *
 * 三栏： 工作组 /  生活组 /  知识组
 * 数据来自 dataStore.homeSummary（后端 /system/home-summary 一次聚合）
 *
 * 卡片结构由 frontend/js/home-cards.js 单一数据源驱动（本文件不再硬编码卡片与跳转路径）：
 *   新增/调整一张首页卡片 = 在 home-cards.js 改一处声明，本文件零改动。
 *   跳转目标一律走 MODULE_META 的 key 解析（杜绝手写路径漂移）。
 */
const HomePage = {
  name: 'HomePage',
  setup() {
    const appStore = useAppStore();
    const dataStore = useDataStore();

    const todayStr = htdDate.today();
    const weekday = htdDate.getWeekdayName();
    const greeting = htdDate.getGreeting();

    // 首页三栏聚合数据（computed 便于模板直接读）
    const home = Vue.computed(() => dataStore.homeSummary);

    const cardsApi = window.htdHomeCards;

    // 各类型卡片的数据兜底，保证模板取值永远安全（不出现 undefined 渲染）
    function defaultData(card) {
      const v = card.data;
      switch (card.type) {
        case 'progress':
          return v || { percent: 0, completed: 0, total: 0 };
        case 'ratio':
          return v || { completed: 0, target: 0 };
        case 'finance':
          return v || { income: 0, expense: 0, net: 0, direction: 'up' };
        case 'count':
          return v || {};
        default:
          return v == null ? 0 : v;
      }
    }

    // ===== 派生：三栏 + 卡片（数据已绑定、路径已解析） =====
    const columns = Vue.computed(() => {
      const h = dataStore.homeSummary;
      if (!h || !cardsApi) return [];
      return cardsApi.buildHomeCards(h).map((col) => ({
        key: col.key,
        title: col.title,
        icon: col.icon,
        className: col.className,
        cards: col.cards.map((c) => Object.assign({}, c, { d: defaultData(c) })),
      }));
    });

    // ===== 派生：底部通栏入口卡 =====
    const features = Vue.computed(() => (cardsApi ? cardsApi.buildFeatureCards() : []));

    // ===== 路由跳转（一律用 meta 解析出的 path，杜绝手写路径） =====
    function goPath(path) {
      if (!path) return;
      htdRouter.navigate(path);
    }

    // 整卡点击：仅数值/进度类卡片（列表类由行或「查看全部」承担，避免误跳）
    function isCardClickable(card) {
      if (!card.path) return false;
      return ['progress', 'stat', 'count', 'ratio', 'finance'].indexOf(card.type) > -1;
    }
    function onCardClick(card) {
      if (!isCardClickable(card)) return;
      goPath(card.path);
    }

    // 行点击：仅 list 类型；detail=true 时带 ?id= 定位
    function onRowClick(card, item) {
      if (card.type !== 'list') return;
      if (!card.path) return;
      if (card.detail) htdRouter.navigate(card.path + '?id=' + rowKey(card, item));
      else htdRouter.navigate(card.path);
    }

    function rowKey(card, item) {
      return item[card.itemKey || 'id'];
    }
    function rowTitle(card, item) {
      return item[card.itemTitle || 'title'];
    }
    function rowSub(card, item) {
      return typeof card.itemSub === 'function' ? card.itemSub(item) : '';
    }
    function rowDot(card, item) {
      return card.itemDot ? item[card.itemDot] : '';
    }

    // count 类型文案（'草稿 {draft} · 已沉淀 {precipitated}'）
    function hintOf(card) {
      return cardsApi ? cardsApi.renderTpl(card.hintTpl, card.d) : '';
    }

    function formatMoney(n) {
      const v = Number(n || 0);
      return v.toFixed(2);
    }

    // ===== 生活组：今日待打卡「打卡 +1」 =====
    async function quickCheckIn(h) {
      if (!h) return;
      try {
        await dataStore.checkInHabit(h.id, { date: htdDate.today(), count: 1 });
        await dataStore.fetchHomeSummary();
      } catch (e) {
        console.error('快速打卡失败:', e);
      }
    }

    // ===== 知识组：推荐「一键生成沉淀草稿」 =====
    async function genRecommend(rec) {
      if (!rec) return;
      try {
        await dataStore.autoRecommendVault(rec);
      } catch (e) {
        console.error('生成沉淀失败:', e);
      }
    }

    // action 类型行内按钮分发
    function handleAction(card, item) {
      if (card.action === 'checkIn') quickCheckIn(item);
      else if (card.action === 'generate') genRecommend(item);
    }

    // 习惯达标标记（+1 按钮禁用态）
    function habitDone(h) {
      return h && h.current >= h.target;
    }

    // ===== V1.5 图表聚合（首页 4 卡） =====
    const charts = Vue.ref(null);
    async function loadCharts() {
      try {
        charts.value = await dataStore.fetchCharts();
      } catch (e) {
        console.error('加载图表失败:', e);
      }
    }
    Vue.onMounted(loadCharts);

    // S2-2a 图表已由 Htp*Chart 响应式组件渲染，首页不再拼 SVG

    return {
      appStore, dataStore,
      todayStr, weekday, greeting,
      home,
      columns, features, charts,
      goPath, onCardClick, onRowClick, isCardClickable,
      rowKey, rowTitle, rowSub, rowDot,
      handleAction, hintOf, formatMoney, habitDone,
    };
  },
  template: `
    <div class="home-page">
      <!-- 顶部日期问候 -->
      <div class="flex items-center justify-between mb-base">
        <div>
          <div class="text-lg font-semibold text-primary">{{ greeting }}，荒天帝</div>
          <div class="text-sm text-tertiary mt-xs">{{ todayStr }} {{ weekday }}</div>
        </div>
      </div>

      <!-- 加载态 -->
      <div v-if="!home" class="home-three-col">
        <div class="home-col"><div class="home-card"><div class="home-card__empty">加载中…</div></div></div>
        <div class="home-col"><div class="home-card"><div class="home-card__empty">加载中…</div></div></div>
        <div class="home-col"><div class="home-card"><div class="home-card__empty">加载中…</div></div></div>
      </div>

      <!-- 三栏主体（卡片由 home-cards.js 声明驱动） -->
      <div v-else class="home-three-col">
        <div v-for="col in columns" :key="col.key" class="home-col" :class="col.className">
          <div class="home-col__head">
            <span class="home-col__icon" v-html="htdIcon(col.icon,{size:20})"></span>
            <span class="home-col__title">{{ col.title }}</span>
          </div>

          <div
            v-for="card in col.cards"
            :key="card.key"
            class="home-card"
            :class="{ 'home-card--clickable': isCardClickable(card) }"
            @click="onCardClick(card)"
          >
            <!-- 进度条型 -->
            <template v-if="card.type === 'progress'">
              <div class="home-card__title">{{ card.title }}</div>
              <div class="home-progress">
                <div class="home-progress__bar" :style="{ width: card.d.percent + '%' }"></div>
              </div>
              <div class="home-progress__meta">
                <span class="home-progress__percent">{{ card.d.percent }}%</span>
                <span>已完成 {{ card.d.completed }} / 共 {{ card.d.total }}</span>
              </div>
            </template>

            <!-- 纯数值型 -->
            <template v-else-if="card.type === 'stat'">
              <div class="home-card__title">{{ card.title }}</div>
              <div class="home-card__value" :class="{ 'home-card__value--accent': card.accent }">{{ card.d }}</div>
              <div class="home-card__hint">{{ card.hint }}</div>
            </template>

            <!-- 数值 + 模板文案型 -->
            <template v-else-if="card.type === 'count'">
              <div class="home-card__title">{{ card.title }}</div>
              <div class="home-card__value" :class="{ 'home-card__value--accent': card.accent }">{{ card.d.total }}</div>
              <div class="home-card__hint">{{ hintOf(card) }}</div>
            </template>

            <!-- 完成/目标 比值型 -->
            <template v-else-if="card.type === 'ratio'">
              <div class="home-card__title">{{ card.title }}</div>
              <div class="home-card__value">
                {{ card.d.completed }} <span class="home-card__hint">/ 目标 {{ card.d.target }}</span>
              </div>
              <div class="home-card__hint">{{ card.hint }}</div>
            </template>

            <!-- 财务专用型（涨跌色 + 收支明细） -->
            <template v-else-if="card.type === 'finance'">
              <div class="home-card__title">{{ card.title }}</div>
              <div
                class="home-card__value"
                :class="card.d.direction === 'up' ? 'text-success' : 'text-danger'"
              >
                {{ card.d.direction === 'up' ? '↑' : '↓' }} ¥{{ formatMoney(card.d.net) }}
              </div>
              <div class="home-card__hint">
                收 ¥{{ formatMoney(card.d.income) }} · 支 ¥{{ formatMoney(card.d.expense) }}
              </div>
            </template>

            <!-- 列表型 / 带操作按钮型 -->
            <template v-else>
              <div class="home-card__title">
                <span>{{ card.title }}</span>
                <button
                  v-if="card.viewAll"
                  class="home-card__viewall"
                  @click.stop="goPath(card.path)"
                >{{ card.viewAllText || '查看全部' }}</button>
              </div>
              <div v-if="card.items.length === 0" class="home-card__empty">{{ card.empty }}</div>
              <div v-else class="home-card__body">
                <div
                  v-for="item in card.items"
                  :key="rowKey(card, item)"
                  class="home-card__row"
                  :class="{ 'home-card--clickable': card.type === 'list' }"
                  @click="onRowClick(card, item)"
                >
                  <span
                    v-if="card.itemDot"
                    class="home-phase-dot"
                    :style="{ background: rowDot(card, item), color: rowDot(card, item) }"
                  ></span>
                  <div class="home-card__row-main">
                    <div class="home-card__row-title" :class="{ 'text-ellipsis': card.action === 'generate' }">{{ rowTitle(card, item) }}</div>
                    <div v-if="rowSub(card, item)" class="home-card__row-sub">{{ rowSub(card, item) }}</div>
                  </div>
                  <button
                    v-if="card.action === 'checkIn'"
                    class="htp-btn htp-btn--primary htp-btn--sm"
                    :disabled="habitDone(item)"
                    @click.stop="handleAction(card, item)"
                  >+1</button>
                  <button
                    v-if="card.action === 'generate'"
                    class="htp-btn htp-btn--primary htp-btn--sm"
                    @click.stop="handleAction(card, item)"
                  >生成</button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 底部通栏入口卡（同样由 home-cards.js 驱动） -->
      <div
        v-for="f in features"
        :key="f.key"
        class="home-card home-card--clickable"
        style="margin-top:var(--spacing-lg);display:flex;align-items:center;justify-content:space-between;"
        @click="goPath(f.path)"
      >
        <div>
          <div class="home-card__title">{{ f.title }}</div>
          <div class="home-card__hint">{{ f.hint }}</div>
        </div>
        <span class="home-card__viewall">{{ f.viewAllText }}</span>
      </div>

      <!-- 数据看板：V1.5 §8.1 首页统计图表（S2-2a 响应式组件化） -->
      <div v-if="charts && charts.home" class="home-charts" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:var(--spacing-lg);margin-top:var(--spacing-lg);">
        <div class="home-card">
          <div class="home-card__title">本周完成趋势</div>
          <HtpBarChart :data="charts.home.weekCompletionTrend.map(d => ({ label: d.label, value: d.completed }))" :height="150" />
        </div>
        <div class="home-card">
          <div class="home-card__title">项目阶段分布</div>
          <div style="display:flex;gap:var(--spacing-lg);align-items:center;flex-wrap:wrap;">
            <HtpDonutChart :data="charts.home.projectPhaseDistribution" :width="170" :height="170" :center-text="String(charts.home.projectPhaseDistribution.reduce((s, d) => s + (d.value || 0), 0))" />
            <HtpChartLegend :items="charts.home.projectPhaseDistribution.map(d => ({ label: d.label, color: d.color }))" />
          </div>
        </div>
        <div class="home-card">
          <div class="home-card__title">学习时长趋势（小时）</div>
          <HtpBarChart :data="charts.home.studyHours.map(d => ({ label: d.label, value: d.value }))" :height="150" color="var(--chart-series-2)" />
        </div>
        <div class="home-card">
          <div class="home-card__title">习惯完成率（%）</div>
          <HtpBarChart :data="charts.home.habitCompletionRate.map(d => ({ label: d.label, value: d.value }))" :height="150" color="var(--chart-series-3)" />
        </div>
      </div>
    </div>
  `,
};

window.HomePage = HomePage;

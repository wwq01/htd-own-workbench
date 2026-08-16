/**
 * 首页总览页面（V1.3 三栏版 §6.1）
 * 说明：模板中不使用可选链 (?.) 语法、不直接调用 htdDate 全局对象，
 *       而是通过 setup 返回的封装函数，兼容 Vue 3 无构建运行时模板编译器
 *
 * 三栏：💼 工作组 / 🌱 生活组 / 📚 知识组
 * 数据来自 dataStore.homeSummary（后端 /system/home-summary 一次聚合）
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

    // ===== 日期格式化 =====
    function fmtDate(d) {
      if (!d) return '';
      return htdDate.formatDate(d);
    }
    function relativeTime(d) {
      if (!d) return '';
      return htdDate.relativeTime(d);
    }
    function formatMoney(n) {
      const v = Number(n || 0);
      return v.toFixed(2);
    }

    // ===== 路由跳转 =====
    function goTodo()      { htdRouter.navigate('/todo'); }
    function goProject()   { htdRouter.navigate('/project'); }
    function goMeeting()   { htdRouter.navigate('/meeting'); }
    function goSecret()    { htdRouter.navigate('/secret'); }
    function goStudy()     { htdRouter.navigate('/study'); }
    function goReview()    { htdRouter.navigate('/review'); }
    function goVault()     { htdRouter.navigate('/vault'); }
    function goHabit()     { htdRouter.navigate('/habit'); }
    function goTimeBlock() { htdRouter.navigate('/time-block'); }
    function goFinance()   { htdRouter.navigate('/finance'); }

    // 会议纪要行级跳转（带 id 定位，复用哈希路由）
    function goMeetingDetail(m) {
      htdRouter.navigate('/meeting?id=' + (m && m.id));
    }
    function goProjectDetail(p) {
      htdRouter.navigate('/project?id=' + (p && p.id));
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

    // 习惯达标标记
    function habitDone(h) {
      return h && h.current >= h.target;
    }

    return {
      appStore, dataStore,
      todayStr, weekday, greeting,
      home,
      fmtDate, relativeTime, formatMoney,
      goTodo, goProject, goMeeting, goSecret, goStudy, goReview, goVault, goHabit, goTimeBlock, goFinance,
      goMeetingDetail, goProjectDetail,
      quickCheckIn, genRecommend, habitDone,
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

      <!-- 三栏主体 -->
      <div v-else class="home-three-col">
        <!-- ===== 左栏：💼 工作组 ===== -->
        <div class="home-col home-col--work">
          <div class="home-col__head">
            <span class="home-col__icon">💼</span>
            <span class="home-col__title">工作组</span>
          </div>

          <!-- 卡片1：今日任务进度 -->
          <div class="home-card home-card--clickable" @click="goTodo">
            <div class="home-card__title">今日任务进度</div>
            <div class="home-progress">
              <div class="home-progress__bar" :style="{ width: home.work.todayProgress.percent + '%' }"></div>
            </div>
            <div class="home-progress__meta">
              <span class="home-progress__percent">{{ home.work.todayProgress.percent }}%</span>
              <span>已完成 {{ home.work.todayProgress.completed }} / 共 {{ home.work.todayProgress.total }}</span>
            </div>
          </div>

          <!-- 卡片2：明日待安排 -->
          <div class="home-card home-card--clickable" @click="goTodo">
            <div class="home-card__title">明日待安排</div>
            <div class="home-card__value home-card__value--accent">{{ home.work.tomorrowCount }}</div>
            <div class="home-card__hint">条任务已排入明日</div>
          </div>

          <!-- 卡片3：进行中项目 -->
          <div class="home-card">
            <div class="home-card__title">
              <span>进行中项目</span>
              <button class="home-card__viewall" @click.stop="goProject">查看全部</button>
            </div>
            <div v-if="home.work.activeProjects.length === 0" class="home-card__empty">暂无进行中的项目</div>
            <div v-else class="home-card__body">
              <div
                v-for="p in home.work.activeProjects"
                :key="p.id"
                class="home-card__row home-card--clickable"
                @click="goProjectDetail(p)"
              >
                <span class="home-phase-dot" :style="{ background: p.phaseColor, color: p.phaseColor }"></span>
                <div class="home-card__row-main">
                  <div class="home-card__row-title">{{ p.name }}</div>
                  <div class="home-card__row-sub">{{ p.phase }} · 进度 {{ p.progress }}%</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 卡片4：最近会议纪要 -->
          <div class="home-card">
            <div class="home-card__title">
              <span>最近会议纪要</span>
              <button class="home-card__viewall" @click.stop="goMeeting">查看全部</button>
            </div>
            <div v-if="home.work.recentMeetings.length === 0" class="home-card__empty">暂无会议纪要</div>
            <div v-else class="home-card__body">
              <div
                v-for="m in home.work.recentMeetings"
                :key="m.id"
                class="home-card__row home-card--clickable"
                @click="goMeetingDetail(m)"
              >
                <div class="home-card__row-main">
                  <div class="home-card__row-title">{{ m.title }}</div>
                  <div class="home-card__row-sub">{{ fmtDate(m.heldAt) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 卡片5：凭据即将到期 -->
          <div class="home-card home-card--clickable" @click="goSecret">
            <div class="home-card__title">凭据即将到期</div>
            <div class="home-card__value home-card__value--accent">{{ home.work.expiringSecrets }}</div>
            <div class="home-card__hint">条凭据 7 天内到期</div>
          </div>
        </div>

        <!-- ===== 中栏：🌱 生活组 ===== -->
        <div class="home-col home-col--life">
          <div class="home-col__head">
            <span class="home-col__icon">🌱</span>
            <span class="home-col__title">生活组</span>
          </div>

          <!-- 卡片1：今日待打卡习惯 -->
          <div class="home-card">
            <div class="home-card__title">
              <span>今日待打卡</span>
              <button class="home-card__viewall" @click.stop="goHabit">查看全部</button>
            </div>
            <div v-if="home.life.todayHabits.length === 0" class="home-card__empty">今日习惯已全部达标 🎉</div>
            <div v-else class="home-card__body">
              <div v-for="h in home.life.todayHabits" :key="h.id" class="home-card__row">
                <div class="home-card__row-main">
                  <div class="home-card__row-title">{{ h.name }}</div>
                  <div class="home-card__row-sub">
                    {{ h.kind === 'weekly' ? '本周 ' : '今日 ' }}{{ h.current }} / {{ h.target }}
                  </div>
                </div>
                <button
                  class="htp-btn htp-btn--primary htp-btn--sm"
                  :disabled="habitDone(h)"
                  @click.stop="quickCheckIn(h)"
                >+1</button>
              </div>
            </div>
          </div>

          <!-- 卡片2：连续打卡最长 -->
          <div class="home-card">
            <div class="home-card__title">连续打卡最长</div>
            <div class="home-card__value home-card__value--accent">{{ home.life.maxStreak }}</div>
            <div class="home-card__hint">天（历史纪录）</div>
          </div>

          <!-- 卡片3：今日番茄钟 -->
          <div class="home-card home-card--clickable" @click="goTimeBlock">
            <div class="home-card__title">今日番茄钟</div>
            <div class="home-card__value">
              {{ home.life.todayTomatoes.completed }} <span class="home-card__hint">/ 目标 {{ home.life.todayTomatoes.target }}</span>
            </div>
            <div class="home-card__hint">已完成专注时段</div>
          </div>

          <!-- 卡片4：本月财务净流入 -->
          <div class="home-card home-card--clickable" @click="goFinance">
            <div class="home-card__title">本月财务净流入</div>
            <div
              class="home-card__value"
              :class="home.life.financeMonth.direction === 'up' ? 'text-success' : 'text-danger'"
            >
              {{ home.life.financeMonth.direction === 'up' ? '↑' : '↓' }} ¥{{ formatMoney(home.life.financeMonth.net) }}
            </div>
            <div class="home-card__hint">
              收 ¥{{ formatMoney(home.life.financeMonth.income) }} · 支 ¥{{ formatMoney(home.life.financeMonth.expense) }}
            </div>
          </div>
        </div>

        <!-- ===== 右栏：📚 知识组 ===== -->
        <div class="home-col home-col--knowledge">
          <div class="home-col__head">
            <span class="home-col__icon">📚</span>
            <span class="home-col__title">知识组</span>
          </div>

          <!-- 卡片1：本周沉淀 -->
          <div class="home-card home-card--clickable" @click="goVault">
            <div class="home-card__title">本周沉淀</div>
            <div class="home-card__value home-card__value--accent">{{ home.knowledge.vaultWeek.total }}</div>
            <div class="home-card__hint">
              草稿 {{ home.knowledge.vaultWeek.draft }} · 已沉淀 {{ home.knowledge.vaultWeek.precipitated }}
            </div>
          </div>

          <!-- 卡片2：充电学习中 -->
          <div class="home-card">
            <div class="home-card__title">
              <span>充电学习中</span>
              <button class="home-card__viewall" @click.stop="goStudy">查看全部</button>
            </div>
            <div v-if="home.knowledge.studying.length === 0" class="home-card__empty">暂无待学资源</div>
            <div v-else class="home-card__body">
              <div
                v-for="s in home.knowledge.studying"
                :key="s.id"
                class="home-card__row home-card--clickable"
                @click="goStudy"
              >
                <div class="home-card__row-main">
                  <div class="home-card__row-title">{{ s.title }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 卡片3：推荐待写沉淀 -->
          <div class="home-card">
            <div class="home-card__title">
              <span>推荐待写沉淀</span>
              <button class="home-card__viewall" @click.stop="goReview">去复盘</button>
            </div>
            <div v-if="home.knowledge.recommendations.length === 0" class="home-card__empty">本周暂无值得沉淀的产出</div>
            <div v-else class="home-card__body">
              <div v-for="rec in home.knowledge.recommendations" :key="rec.sourceId" class="home-card__row">
                <div class="home-card__row-main">
                  <div class="home-card__row-title text-ellipsis">{{ rec.title }}</div>
                </div>
                <button
                  class="htp-btn htp-btn--primary htp-btn--sm"
                  @click.stop="genRecommend(rec)"
                >生成</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};

window.HomePage = HomePage;

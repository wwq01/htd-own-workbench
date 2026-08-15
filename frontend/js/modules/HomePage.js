/**
 * 首页总览页面
 * 说明：模板中不使用可选链 (?.) 语法、不直接调用 htdDate 全局对象，
 *       而是通过 setup 返回的封装函数，兼容 Vue 3 无构建运行时模板编译器
 */
const HomePage = {
  name: 'HomePage',
  setup() {
    const appStore = useAppStore();
    const dataStore = useDataStore();

    const todayStr = htdDate.today();
    const weekday = htdDate.getWeekdayName();
    const greeting = htdDate.getGreeting();

    // 里程碑：安全读取关联项目名称
    function milestoneCustomer(m) {
      return (m && m.project && m.project.customerName) || '—';
    }
    // 里程碑到期提醒类型：逾期(danger) / 临期≤3天(warning) / 7天内(info)
    function milestoneTagType(m) {
      if (!m || !m.dueDate) return 'default';
      const diff = htdDate.daysBetween(htdDate.today(), m.dueDate);
      if (diff < 0) return 'danger';        // 已逾期
      if (diff <= 3) return 'warning';      // 3 天内临期
      if (diff <= 7) return 'info';         // 7 天内
      return 'default';
    }
    // 里程碑相对时间（逾期前缀）
    function milestoneDueText(m) {
      if (!m || !m.dueDate) return '';
      const diff = htdDate.daysBetween(htdDate.today(), m.dueDate);
      if (diff < 0) return `已逾期 ${Math.abs(diff)} 天`;
      return relativeTime(m.dueDate);
    }
    // 日期：相对时间描述
    function relativeTime(d) {
      return htdDate.relativeTime(d);
    }
    // 日期：完整日期时间
    function formatDateTime(d) {
      return htdDate.formatDateTime(d);
    }
    // 跳转路由
    function goProject() { htdRouter.navigate('/project'); }
    function goDevelop() { htdRouter.navigate('/develop'); }
    function goStudy()   { htdRouter.navigate('/study'); }
    function goTodo()    { htdRouter.navigate('/todo'); }
    // 待办优先级 → tag type
    function priorityTag(p) {
      return p === '高' ? 'danger' : p === '中' ? 'warning' : 'default';
    }
    // 跳转到娱乐
    function goEntertainment() { htdRouter.navigate('/entertainment'); }
    // 跳转到复盘
    function goReview() { htdRouter.navigate('/review'); }
    // 跳转到凭据保险箱
    function goSecret() { htdRouter.navigate('/secret'); }
    // 跳转到数据与部署
    function goData() { htdRouter.navigate('/data'); }
    // 娱乐推荐
    const recommend = Vue.ref(null);
    async function loadRecommend() {
      try {
        recommend.value = await dataStore.fetchEntertainmentRecommend();
      } catch (e) { /* ignore */ }
    }
    function entertainmentTypeIcon(t) {
      const map = { 游戏: 'gamepad', 番剧: 'tv', 剧集: 'film', 书籍: 'book', 其他: 'dice' };
      return window.htdIcon(map[t] || 'dice', { size: 18 });
    }
    function entertainmentWantTotal() {
      const stats = dataStore.statistics;
      return (stats.entertainmentWantCount || 0) + (stats.entertainmentPlayingCount || 0);
    }

    // 页面挂载后自动拉取一次娱乐推荐
    Vue.onMounted(() => {
      loadRecommend();
    });
    // 备忘快捷删除（二次确认）
    const confirmDelMemo = Vue.ref(null);
    function requestDeleteMemo(m) {
      if (!m) return;
      confirmDelMemo.value = m;
    }
    function cancelDeleteMemo() { confirmDelMemo.value = null; }
    async function confirmDoDeleteMemo() {
      const m = confirmDelMemo.value;
      if (!m) return;
      await dataStore.deleteMemo(m.id);
      confirmDelMemo.value = null;
    }

    return {
      appStore, dataStore,
      todayStr, weekday, greeting,
      milestoneCustomer, milestoneTagType, milestoneDueText,
      relativeTime, formatDateTime,
      goProject, goDevelop, goStudy, goTodo, goEntertainment, goReview, goSecret, goData,
      priorityTag,
      recommend, loadRecommend, entertainmentTypeIcon, entertainmentWantTotal,
      confirmDelMemo, requestDeleteMemo, cancelDeleteMemo, confirmDoDeleteMemo,
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

      <!-- 统计卡片组 -->
      <div class="stats-grid">
        <div class="stat-card" @click="goProject">
          <div class="stat-card__label">进行中项目</div>
          <div class="stat-card__value stat-card__value--brand">{{ dataStore.statistics.projectCount }}</div>
        </div>
        <div class="stat-card" @click="goDevelop">
          <div class="stat-card__label">待解决开发问题</div>
          <div class="stat-card__value stat-card__value--warning">{{ dataStore.statistics.devIssueCount }}</div>
        </div>
        <div class="stat-card" @click="goStudy">
          <div class="stat-card__label">本周学习时长(h)</div>
          <div class="stat-card__value stat-card__value--success">{{ dataStore.statistics.weekStudyHours }}</div>
        </div>
        <div class="stat-card" @click="goTodo">
          <div class="stat-card__label">今日未完成待办</div>
          <div class="stat-card__value stat-card__value--danger">{{ dataStore.statistics.todayTodoCount }}</div>
        </div>
      </div>

      <!-- 第二行统计卡片：工具箱 -->
      <div class="stats-grid">
        <div class="stat-card" @click="goSecret">
          <div class="stat-card__label">凭据总数</div>
          <div class="stat-card__value stat-card__value--brand">{{ dataStore.statistics.secretCount || 0 }}</div>
        </div>
        <div class="stat-card" @click="goData">
          <div class="stat-card__label">部署记录数</div>
          <div class="stat-card__value stat-card__value--success">{{ dataStore.statistics.deploymentCount || 0 }}</div>
        </div>
      </div>

      <!-- 信息卡片 -->
      <div class="home-grid">
        <!-- 即将到期里程碑 -->
        <htp-card title="即将到期里程碑">
          <div v-if="dataStore.statistics.upcomingMilestones.length === 0">
            <htp-empty text="暂无临近到期的里程碑"></htp-empty>
          </div>
          <div v-else>
            <div
              v-for="m in dataStore.statistics.upcomingMilestones"
              :key="m.id"
              class="htp-list-item"
              @click="goProject"
            >
              <div class="flex-1">
                <div class="text-primary text-ellipsis">{{ m.name }}</div>
                <div class="text-sm text-tertiary">{{ milestoneCustomer(m) }} · {{ milestoneDueText(m) }}</div>
              </div>
              <htp-tag :type="milestoneTagType(m)">{{ m.dueDate }}</htp-tag>
            </div>
          </div>
        </htp-card>

        <!-- 最近备忘 -->
        <htp-card title="最近备忘">
          <div v-if="dataStore.statistics.recentMemos.length === 0">
            <htp-empty text="暂无备忘记录"></htp-empty>
          </div>
          <div v-else>
            <div
              v-for="m in dataStore.statistics.recentMemos"
              :key="m.id"
              class="htp-list-item"
            >
              <span class="text-ellipsis flex-1">{{ m.content }}</span>
              <span class="text-sm text-tertiary ml-sm hidden-xs">{{ formatDateTime(m.createdAt) }}</span>
              <button
                class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm ml-sm"
                title="删除该备忘"
                @click.stop="requestDeleteMemo(m)"
              >删除</button>
            </div>
          </div>
        </htp-card>
      </div>

      <!-- 娱乐放松卡片组 -->
      <div class="home-grid mt-base">
        <!-- 娱乐统计 + 推荐 -->
        <htp-card title="娱乐放松" class="ent-home-card" @click="goEntertainment">
          <div v-if="entertainmentWantTotal() === 0">
            <htp-empty text="还没有想玩/在玩的内容，去娱乐页添加吧"></htp-empty>
          </div>
          <div v-else>
            <div class="ent-home-stats">
              <div class="ent-home-stat">
                <span class="ent-home-stat__num text-primary">{{ dataStore.statistics.entertainmentWantCount || 0 }}</span>
                <span class="ent-home-stat__label">想看</span>
              </div>
              <div class="ent-home-stat">
                <span class="ent-home-stat__num text-primary">{{ dataStore.statistics.entertainmentPlayingCount || 0 }}</span>
                <span class="ent-home-stat__label">在玩</span>
              </div>
            </div>
            <div v-if="recommend" class="ent-home-recommend">
              <span class="text-tertiary text-sm">今日推荐：</span>
              <span class="ent-home-recommend__name"><span v-html="entertainmentTypeIcon(recommend.type)"></span> {{ recommend.name }}</span>
            </div>
            <div v-else class="ent-home-recommend">
              <span class="text-tertiary text-sm">点击进入娱乐页查看随机推荐</span>
            </div>
            <button class="htp-btn htp-btn--text htp-btn--sm mt-sm" @click.stop="loadRecommend"><span v-html="htdIcon('dice',{size:16})"></span> 换一条</button>
          </div>
        </htp-card>

        <!-- 复盘中心入口 -->
        <htp-card title="复盘与沉淀" class="ent-home-card" @click="goReview">
          <div class="ent-home-review-tip">
            <div class="ent-home-review-tip__icon" v-html="htdIcon('note',{size:20})"></div>
            <div>
              <div class="text-primary font-medium">周复盘 · 项目复盘</div>
              <div class="text-sm text-tertiary mt-xs">沉淀亮点、踩坑、可复用经验，自动统计本周数据</div>
            </div>
          </div>
        </htp-card>
      </div>

      <!-- 明日计划预览 -->
      <htp-card title="明日计划预览" class="mt-base">
        <div v-if="dataStore.statistics.tomorrowTodos.length === 0">
          <htp-empty text="暂无明日计划"></htp-empty>
        </div>
        <div v-else>
          <div
            v-for="t in dataStore.statistics.tomorrowTodos"
            :key="t.id"
            class="htp-list-item"
            @click="goTodo"
          >
            <htp-tag :type="priorityTag(t.priority)">{{ t.priority }}</htp-tag>
            <span class="ml-md text-ellipsis flex-1">{{ t.title }}</span>
            <htp-tag type="info">{{ t.category }}</htp-tag>
          </div>
        </div>
      </htp-card>

      <!-- 删除备忘二次确认弹窗 -->
      <htp-modal
        v-if="confirmDelMemo"
        title="确认删除备忘？"
        :visible="!!confirmDelMemo"
        confirmText="确认删除"
        confirmType="danger"
        @confirm="confirmDoDeleteMemo"
        @cancel="cancelDeleteMemo"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下备忘吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm text-ellipsis">
            {{ confirmDelMemo.content }}
          </div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.HomePage = HomePage;

/**
 * 习惯打卡页面（V1.3 新模块）
 * 列表卡片 + 当日打卡 + 当月日历视图 + 连续天数统计
 */
const HABIT_FREQUENCY_OPTIONS = [
  { label: '每天', value: 'DAILY' },
  { label: '每周', value: 'WEEKLY' },
];

const HabitPage = {
  name: 'HabitPage',
  setup() {
    const dataStore = useDataStore();
    // ============ 数据 ============
    const habits = Vue.ref([]);
    const loading = Vue.ref(false);

    // 每个习惯的打卡映射： habitId -> { date(str) -> count }
    const checkInMap = Vue.ref({});
    // 每个习惯的统计： habitId -> { currentStreak, longestStreak }
    const statsMap = Vue.ref({});

    // 当前显示的月份（用于日历），格式 'YYYY-MM'
    const currentMonth = Vue.ref(htdDate.today().slice(0, 7));

    // ============ 加载 ============
    async function loadList() {
      loading.value = true;
      try {
        const raw = await htdApi.get('/habits');
        const arr = Array.isArray(raw) ? raw : [];
        habits.value = arr;
        // 并行加载每个习惯的当月打卡与统计
        await Promise.all(arr.map(h => Promise.all([loadCheckIns(h.id), loadStats(h.id)])));
      } catch (e) {
        console.error('加载习惯列表失败:', e);
        habits.value = [];
      } finally {
        loading.value = false;
      }
    }

    async function loadCheckIns(habitId) {
      try {
        const list = await htdApi.get(`/habits/${habitId}/checkins`, { month: currentMonth.value });
        const arr = Array.isArray(list) ? list : [];
        const map = {};
        arr.forEach(c => { map[c.date] = c.count; });
        checkInMap.value = { ...checkInMap.value, [habitId]: map };
      } catch (e) {
        console.error('加载打卡记录失败:', e);
      }
    }

    async function loadStats(habitId) {
      try {
        const stats = await htdApi.get(`/habits/${habitId}/stats`);
        statsMap.value = { ...statsMap.value, [habitId]: stats };
      } catch (e) {
        console.error('加载统计失败:', e);
      }
    }

    Vue.onMounted(loadList);

    // ============ 工具方法 ============
    function freqLabel(f) {
      return f === 'WEEKLY' ? '每周' : (f === 'DAILY' ? '每天' : f);
    }
    function getCheckInMap(habitId) {
      return checkInMap.value[habitId] || {};
    }
    function getStats(habitId) {
      return statsMap.value[habitId] || { currentStreak: 0, longestStreak: 0 };
    }
    function dayCompleted(habit, dateStr) {
      const map = getCheckInMap(habit.id);
      const cnt = map[dateStr] || 0;
      return cnt >= (habit.dailyTargetCount || 1);
    }
    function todayStr() { return htdDate.today(); }

    // 当月日历网格（含前置空白）
    const calendar = Vue.computed(() => {
      const [y, m] = currentMonth.value.split('-').map(Number);
      const firstDay = new Date(y, m - 1, 1);
      const startWeekday = firstDay.getDay(); // 0=周日
      const daysInMonth = new Date(y, m, 0).getDate();
      const cells = [];
      for (let i = 0; i < startWeekday; i++) cells.push({ empty: true });
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ empty: false, day: d, date: ds });
      }
      return cells;
    });

    function prevMonth() {
      const [y, m] = currentMonth.value.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      currentMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      refreshCheckIns();
    }
    function nextMonth() {
      const [y, m] = currentMonth.value.split('-').map(Number);
      const d = new Date(y, m, 1);
      currentMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      refreshCheckIns();
    }
    async function refreshCheckIns() {
      await Promise.all(habits.value.map(h => loadCheckIns(h.id)));
    }

    // ============ 打卡 ============
    async function handleCheckIn(habit) {
      try {
        await dataStore.checkInHabit(habit.id, { date: htdDate.today(), count: 1 });
        showToast('打卡成功 +1', 'success');
        await Promise.all([loadCheckIns(habit.id), loadStats(habit.id)]);
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 新增 / 编辑弹窗 ============
    const formModalVisible = Vue.ref(false);
    const editingHabit = Vue.ref(null);
    const formTitle = Vue.computed(() => editingHabit.value ? '编辑习惯' : '新增习惯');
    const form = Vue.reactive({
      name: '',
      frequency: 'DAILY',
      dailyTargetCount: 1,
      weeklyTargetDays: 1,
      icon: '',
      remark: '',
    });

    function openCreate() {
      editingHabit.value = null;
      Object.assign(form, {
        name: '',
        frequency: 'DAILY',
        dailyTargetCount: 1,
        weeklyTargetDays: 1,
        icon: '',
        remark: '',
      });
      formModalVisible.value = true;
    }
    function openEdit(habit) {
      editingHabit.value = habit;
      Object.assign(form, {
        name: habit.name,
        frequency: habit.frequency,
        dailyTargetCount: habit.dailyTargetCount || 1,
        weeklyTargetDays: habit.weeklyTargetDays || 1,
        icon: habit.icon || '',
        remark: habit.remark || '',
      });
      formModalVisible.value = true;
    }
    function closeForm() { formModalVisible.value = false; }
    async function submitForm() {
      const name = (form.name || '').trim();
      if (!name) { showToast('习惯名称不能为空', 'warning'); return; }
      const payload = {
        name,
        frequency: form.frequency,
        dailyTargetCount: Number(form.dailyTargetCount) || 1,
        weeklyTargetDays: form.frequency === 'WEEKLY' ? (Number(form.weeklyTargetDays) || 1) : null,
        icon: (form.icon || '').trim() || null,
        remark: (form.remark || '').trim() || null,
      };
      try {
        if (editingHabit.value) {
          await dataStore.updateHabit(editingHabit.value.id, payload);
        } else {
          await dataStore.createHabit(payload);
        }
        formModalVisible.value = false;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 删除 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(habit) { delConfirm.value = habit; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteHabit(delConfirm.value.id);
        delConfirm.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    return {
      // state
      habits, loading, checkInMap, statsMap, currentMonth,
      calendar, formModalVisible, editingHabit, formTitle, form, delConfirm,
      HABIT_FREQUENCY_OPTIONS,
      // actions
      loadList, freqLabel, getCheckInMap, getStats, dayCompleted, todayStr,
      prevMonth, nextMonth, handleCheckIn,
      openCreate, openEdit, closeForm, submitForm,
      requestDelete, cancelDelete, confirmDoDelete,
    };
  },
  template: `
    <div class="list-page habit-page">
      <!-- 顶部操作栏 -->
      <div class="htp-filter-bar">
        <div class="list-header__title">习惯打卡</div>
        <div style="margin-left:auto">
          <button class="htp-btn htp-btn--primary" @click="openCreate">+ 新增习惯</button>
        </div>
      </div>

      <!-- 列表区 -->
      <div class="list-container">
        <div v-if="loading" class="text-center py-lg text-tertiary">加载中...</div>
        <div v-else-if="habits.length === 0">
          <htp-empty text="还没有习惯，点击「新增习惯」开始打卡吧"></htp-empty>
        </div>
        <div v-else class="habit-grid">
          <div v-for="habit in habits" :key="habit.id" class="habit-card">
            <div class="habit-card__head">
              <span class="habit-card__icon">{{ habit.icon || '📌' }}</span>
              <div class="habit-card__title-wrap">
                <div class="habit-card__title">{{ habit.name }}</div>
                <div class="habit-card__meta text-sm text-tertiary">
                  <htp-tag type="info">{{ freqLabel(habit.frequency) }}</htp-tag>
                  <span>每日目标 {{ habit.dailyTargetCount || 1 }} 次</span>
                  <span v-if="habit.frequency === 'WEEKLY'">· 每周 {{ habit.weeklyTargetDays }} 天</span>
                </div>
              </div>
            </div>

            <!-- 连续天数统计 -->
            <div class="habit-card__stats">
              <div class="stat-item">
                <span class="stat-item__num text-primary">{{ getStats(habit.id).currentStreak }}</span>
                <span class="stat-item__label">当前连续(天)</span>
              </div>
              <div class="stat-item">
                <span class="stat-item__num text-success">{{ getStats(habit.id).longestStreak }}</span>
                <span class="stat-item__label">最长连续(天)</span>
              </div>
              <div class="habit-card__actions">
                <button class="htp-btn htp-btn--primary htp-btn--sm" @click="handleCheckIn(habit)">打卡 +1</button>
                <button class="htp-btn htp-btn--text htp-btn--primary htp-btn--sm" @click="openEdit(habit)">编辑</button>
                <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="requestDelete(habit)">删除</button>
              </div>
            </div>

            <!-- 当月日历 -->
            <div class="habit-calendar">
              <div class="habit-calendar__bar">
                <button class="htp-btn htp-btn--ghost htp-btn--sm" @click="prevMonth">‹</button>
                <span class="habit-calendar__month">{{ currentMonth }}</span>
                <button class="htp-btn htp-btn--ghost htp-btn--sm" @click="nextMonth">›</button>
              </div>
              <div class="habit-calendar__weekdays">
                <span v-for="w in ['日','一','二','三','四','五','六']" :key="w" class="habit-calendar__weekday">{{ w }}</span>
              </div>
              <div class="habit-calendar__grid">
                <template v-for="(cell, idx) in calendar" :key="idx">
                  <span v-if="cell.empty" class="habit-calendar__cell habit-calendar__cell--empty"></span>
                  <span
                    v-else
                    class="habit-calendar__cell"
                    :class="{
                      'habit-calendar__cell--done': dayCompleted(habit, cell.date),
                      'habit-calendar__cell--today': cell.date === todayStr()
                    }"
                    :title="cell.date"
                  >
                    <span class="habit-calendar__day">{{ cell.day }}</span>
                    <span
                      v-if="getCheckInMap(habit.id)[cell.date]"
                      class="habit-calendar__count"
                    >{{ getCheckInMap(habit.id)[cell.date] }}</span>
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新增/编辑习惯弹窗 -->
      <htp-modal
        :visible="formModalVisible"
        :title="formTitle"
        width="520px"
        confirmText="保存"
        @cancel="closeForm"
        @confirm="submitForm"
      >
        <div class="form-grid">
          <div class="form-item">
            <label class="form-item__label"><span class="text-danger">*</span> 习惯名称</label>
            <htp-input v-model="form.name" placeholder="例如：早起 / 阅读 / 健身" maxlength="100"></htp-input>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">打卡频率</label>
              <htp-select
                v-model="form.frequency"
                :options="HABIT_FREQUENCY_OPTIONS"
              ></htp-select>
            </div>
            <div class="form-item">
              <label class="form-item__label">每日目标次数</label>
              <htp-input v-model="form.dailyTargetCount" type="number" min="1" placeholder="1"></htp-input>
            </div>
          </div>
          <div class="form-item" v-if="form.frequency === 'WEEKLY'">
            <label class="form-item__label">每周目标天数</label>
            <htp-input v-model="form.weeklyTargetDays" type="number" min="1" max="7" placeholder="7"></htp-input>
          </div>
          <div class="form-item">
            <label class="form-item__label">图标（emoji）</label>
            <htp-input v-model="form.icon" placeholder="如 🏃 📚 💧（可选）" maxlength="8"></htp-input>
          </div>
          <div class="form-item">
            <label class="form-item__label">备注</label>
            <htp-textarea
              v-model="form.remark"
              :rows="3"
              placeholder="补充说明（可选）"
              maxlength="1000"
            ></htp-textarea>
          </div>
        </div>
      </htp-modal>

      <!-- 删除二次确认弹窗 -->
      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除习惯？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDelete"
        @confirm="confirmDoDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后其打卡记录一并不可恢复，确定要删除以下习惯吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">
            <span class="mr-xs">{{ delConfirm.icon || '📌' }}</span>
            <span>{{ delConfirm.name }}</span>
          </div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.HabitPage = HabitPage;

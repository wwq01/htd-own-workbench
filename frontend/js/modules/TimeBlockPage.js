/**
 * TimeBlockPage - 时间块 / 番茄钟
 * 功能：开始番茄钟（计时）、完成/放弃、历史补录、统计看板、删除
 * 模块 key: timeblock
 */
const TIME_BLOCK_TYPE_OPTIONS = [
  { label: '工作', value: 'WORK' },
  { label: '学习', value: 'STUDY' },
  { label: '休息', value: 'REST' },
  { label: '其他', value: 'OTHER' },
];
const TIME_BLOCK_TYPE_LABEL = {
  WORK: '工作',
  STUDY: '学习',
  REST: '休息',
  OTHER: '其他',
};
const PLANNED_MINUTE_OPTIONS = [
  { label: '15 分钟', value: 15 },
  { label: '25 分钟', value: 25 },
  { label: '30 分钟', value: 30 },
  { label: '45 分钟', value: 45 },
  { label: '60 分钟', value: 60 },
];

const TimeBlockPage = {
  name: 'TimeBlockPage',
  setup() {
    const dataStore = useDataStore();
    // ============ 选项 ============
    const projectOptions = Vue.ref([{ label: '不关联', value: '' }]);

    // ============ 开始番茄钟面板 ============
    const startForm = Vue.reactive({
      type: 'WORK',
      plannedMinutes: 25,
      relatedProjectId: '',
      note: '',
    });

    // ============ 计时运行态 ============
    const runningId = Vue.ref(null);
    const runningStartedAt = Vue.ref(null); // ISO 字符串
    const runningPlannedMinutes = Vue.ref(25);
    const elapsedMs = Vue.ref(0);
    let timerInterval = null;

    async function startTimer() {
      if (runningId.value) {
        showToast('已有进行中的番茄钟，请先结束', 'warning');
        return;
      }
      const payload = {
        type: startForm.type,
        plannedMinutes: Number(startForm.plannedMinutes),
        relatedProjectId: startForm.relatedProjectId || null,
        note: startForm.note || null,
      };
      try {
        const block = await dataStore.startTimeBlock(payload);
        runningId.value = block.id;
        runningStartedAt.value = block.startedAt;
        runningPlannedMinutes.value = block.plannedMinutes || 25;
        startForm.note = '';
        showToast('番茄钟已开始', 'success');
      } catch (e) { /* toast 已提示 */ }
    }

    async function stopTimer(interrupted) {
      if (!runningId.value) return;
      try {
        await dataStore.stopTimeBlock(runningId.value, { interrupted });
        runningId.value = null;
        runningStartedAt.value = null;
        runningPlannedMinutes.value = 25;
        elapsedMs.value = 0;
        showToast(interrupted ? '已放弃该番茄钟' : '已完成，干得漂亮！', 'success');
        await Promise.all([loadList(), loadStats()]);
      } catch (e) { /* toast 已提示 */ }
    }

    // 计时器：每秒刷新 elapsedMs
    Vue.onMounted(() => {
      timerInterval = setInterval(() => {
        if (runningStartedAt.value) {
          elapsedMs.value = Date.now() - new Date(runningStartedAt.value).valueOf();
        }
      }, 1000);
      loadProjectOptions();
      loadList();
      loadStats();
    });
    Vue.onUnmounted(() => {
      if (timerInterval) clearInterval(timerInterval);
    });

    // 运行态展示
    const elapsedText = Vue.computed(() => {
      const totalSec = Math.floor(elapsedMs.value / 1000);
      const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const s = String(totalSec % 60).padStart(2, '0');
      return `${m}:${s}`;
    });
    const plannedMs = Vue.computed(() => runningPlannedMinutes.value * 60000);
    const progressPct = Vue.computed(() => {
      if (!plannedMs.value) return 0;
      return Math.min(100, Math.round((elapsedMs.value / plannedMs.value) * 100));
    });
    const isOvertime = Vue.computed(() => plannedMs.value > 0 && elapsedMs.value > plannedMs.value);

    // ============ 历史列表 ============
    const list = Vue.ref([]);
    const loading = Vue.ref(false);

    async function loadList() {
      loading.value = true;
      try {
        const raw = await htdApi.get('/time-blocks');
        list.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        console.error('加载时间块失败:', e);
        list.value = [];
      } finally {
        loading.value = false;
      }
    }

    // ============ 统计 ============
    const stats = Vue.ref({ byDay: [], byType: [], totalToday: 0 });
    const typeMaxMinutes = Vue.computed(() => {
      const arr = stats.value.byType || [];
      return arr.reduce((m, t) => Math.max(m, t.minutes), 1);
    });

    async function loadStats() {
      try {
        const raw = await htdApi.get('/time-blocks/stats');
        stats.value = raw || { byDay: [], byType: [], totalToday: 0 };
      } catch (e) {
        console.error('加载统计失败:', e);
      }
    }

    function typeTagType(type) {
      if (type === 'WORK') return 'primary';
      if (type === 'STUDY') return 'info';
      if (type === 'REST') return 'success';
      return 'default';
    }

    function typeColor(type) {
      if (type === 'WORK') return 'var(--color-work)';
      if (type === 'STUDY') return 'var(--color-knowledge)';
      if (type === 'REST') return 'var(--color-life)';
      return 'var(--status-pending)';
    }

    // ============ 补录弹窗 ============
    const supplementVisible = Vue.ref(false);
    const supplementForm = Vue.reactive({
      startedAt: '',
      endedAt: '',
      type: 'WORK',
      note: '',
    });

    function openSupplement() {
      const now = new Date();
      const later = new Date(now.getTime() + 25 * 60000);
      supplementForm.startedAt = toLocalInput(now);
      supplementForm.endedAt = toLocalInput(later);
      supplementForm.type = 'WORK';
      supplementForm.note = '';
      supplementVisible.value = true;
    }
    function closeSupplement() { supplementVisible.value = false; }

    async function submitSupplement() {
      const startStr = fromLocalInput(supplementForm.startedAt);
      const endStr = fromLocalInput(supplementForm.endedAt);
      if (!startStr || !endStr) {
        showToast('请填写开始与结束时间', 'warning');
        return;
      }
      const startMs = new Date(startStr).valueOf();
      const endMs = new Date(endStr).valueOf();
      if (endMs <= startMs) {
        showToast('结束时间需晚于开始时间', 'warning');
        return;
      }
      const actualMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
      try {
        await dataStore.createTimeBlock({
          startedAt: startStr,
          endedAt: endStr,
          actualMinutes,
          type: supplementForm.type,
          note: supplementForm.note || null,
        });
        supplementVisible.value = false;
        showToast('补录成功', 'success');
        await Promise.all([loadList(), loadStats()]);
      } catch (e) { /* toast 已提示 */ }
    }

    // ============ 删除 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(block) { delConfirm.value = block; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteTimeBlock(delConfirm.value.id);
        delConfirm.value = null;
        showToast('已删除', 'success');
        await Promise.all([loadList(), loadStats()]);
      } catch (e) { /* toast 已提示 */ }
    }

    // ============ 杂项 ============
    async function loadProjectOptions() {
      try {
        const projects = await htdApi.get('/projects');
        const arr = Array.isArray(projects) ? projects : (projects.list || []);
        projectOptions.value = [
          { label: '不关联', value: '' },
          ...arr.map((p) => ({ label: p.name || '未命名项目', value: p.id })),
        ];
      } catch (e) {
        projectOptions.value = [{ label: '不关联', value: '' }];
      }
    }

    function formatDateTime(d) { return htdDate.formatDateTime(d); }
    function blockDuration(block) {
      if (block.endedAt) return block.actualMinutes;
      return null;
    }

    return {
      // state
      startForm, runningId, elapsedMs, elapsedText, progressPct, isOvertime, runningPlannedMinutes,
      list, loading, stats, typeMaxMinutes,
      supplementVisible, supplementForm, delConfirm,
      // options
      TIME_BLOCK_TYPE_OPTIONS, PLANNED_MINUTE_OPTIONS, projectOptions,
      // actions
      startTimer, stopTimer,
      openSupplement, closeSupplement, submitSupplement,
      requestDelete, cancelDelete, confirmDoDelete,
      typeTagType, typeColor, formatDateTime, blockDuration, TIME_BLOCK_TYPE_LABEL,
    };
  },
  template: `
    <div class="list-page timeblock-page">
      <!-- 顶部：开始番茄钟 + 计时运行 -->
      <div class="tb-start-panel">
        <!-- 未运行：配置面板 -->
        <div v-if="!runningId" class="tb-config">
          <div class="tb-config__title">开始番茄钟</div>
          <div class="tb-config__row">
            <div class="form-item">
              <label class="form-item__label">类型</label>
              <htp-select v-model="startForm.type" :options="TIME_BLOCK_TYPE_OPTIONS"></htp-select>
            </div>
            <div class="form-item">
              <label class="form-item__label">计划时长</label>
              <htp-select v-model="startForm.plannedMinutes" :options="PLANNED_MINUTE_OPTIONS"></htp-select>
            </div>
            <div class="form-item">
              <label class="form-item__label">关联项目</label>
              <htp-select v-model="startForm.relatedProjectId" :options="projectOptions"></htp-select>
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">备注（可选）</label>
            <htp-input v-model="startForm.note" placeholder="这次想专注做点什么？"></htp-input>
          </div>
          <button class="htp-btn htp-btn--primary" @click="startTimer">开始</button>
        </div>

        <!-- 运行中：计时器 -->
        <div v-else class="tb-timer">
          <div class="tb-timer__label">
            进行中 · {{ TIME_BLOCK_TYPE_LABEL[startForm.type] || startForm.type }}
          </div>
          <div class="tb-timer__clock" :class="{ 'tb-timer__clock--overtime': isOvertime }">
            {{ elapsedText }}
          </div>
          <div class="tb-timer__progress" style="background:#eef0f4;border-radius:8px;height:10px;overflow:hidden">
            <div class="tb-timer__progress-bar" :style="{ width: progressPct + '%', background: isOvertime ? 'var(--color-danger)' : 'var(--color-primary)', height:'100%' }"></div>
          </div>
          <div class="tb-timer__meta">
            计划 {{ runningPlannedMinutes }} 分钟 · 已进行 {{ Math.floor(elapsedMs/60000) }} 分钟
            <span v-if="isOvertime" class="text-danger">（已超时）</span>
          </div>
          <div class="tb-timer__actions">
            <button class="htp-btn htp-btn--success" @click="stopTimer(false)">完成</button>
            <button class="htp-btn htp-btn--danger" @click="stopTimer(true)">放弃</button>
          </div>
        </div>
      </div>

      <!-- 统计看板 -->
      <div class="tb-stats">
        <div class="tb-stats__today">
          <div class="tb-stats__today-num">{{ stats.totalToday }}</div>
          <div class="tb-stats__today-label">今日专注（分钟）</div>
        </div>
        <div class="tb-stats__types">
          <div class="tb-stats__types-title">各类型时长</div>
          <div v-if="stats.byType.length === 0" class="text-sm text-tertiary">暂无数据</div>
          <div v-for="t in stats.byType" :key="t.type" class="tb-type-bar">
            <span class="tb-type-bar__label">{{ TIME_BLOCK_TYPE_LABEL[t.type] || t.type }}</span>
            <div class="tb-type-bar__track" style="flex:1;background:#eef0f4;border-radius:6px;height:10px;overflow:hidden">
              <div
                class="tb-type-bar__fill"
                :style="{ width: (t.minutes / typeMaxMinutes * 100) + '%', background: typeColor(t.type), height:'100%' }"
              ></div>
            </div>
            <span class="tb-type-bar__value">{{ t.minutes }} 分钟</span>
          </div>
        </div>
      </div>

      <!-- 历史列表 -->
      <div class="list-container">
        <div class="list-header">
          <div class="list-header__title">时间块记录</div>
          <div class="list-header__meta">
            <span class="text-sm mr-md">共 {{ list.length }} 条</span>
            <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openSupplement">+ 补录</button>
          </div>
        </div>
        <div class="list-body">
          <div v-if="loading" class="text-center py-lg text-tertiary">加载中...</div>
          <div v-else-if="list.length === 0">
            <htp-empty text="还没有时间块记录，点击上方「开始」专注一会儿吧"></htp-empty>
          </div>
          <ul v-else class="tb-list">
            <li v-for="b in list" :key="b.id" class="tb-list-item">
              <div class="flex items-center flex-1 min-w-0">
                <div class="ml-md flex-1 min-w-0">
                  <div class="flex items-center flex-wrap gap-xs">
                    <htp-tag :type="typeTagType(b.type)">{{ TIME_BLOCK_TYPE_LABEL[b.type] || b.type }}</htp-tag>
                    <span v-if="b.interrupted" class="ml-xs"></span>
                    <htp-tag v-if="b.interrupted" type="danger">中断</htp-tag>
                    <span v-if="!b.endedAt" class="htp-tag htp-tag--warning">进行中</span>
                    <span class="text-sm text-tertiary">{{ formatDateTime(b.startedAt) }}</span>
                  </div>
                  <div class="text-sm text-tertiary mt-xs flex items-center flex-wrap gap-sm">
                    <span v-if="blockDuration(b) !== null">实际 {{ b.actualMinutes }} 分钟</span>
                    <span>计划 {{ b.plannedMinutes }} 分钟</span>
                    <span v-if="b.note" class="tb-list-item__note text-ellipsis">备注：{{ b.note }}</span>
                  </div>
                </div>
                <div class="ml-sm flex items-center gap-xs">
                  <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="requestDelete(b)">删除</button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- 补录弹窗 -->
      <htp-modal
        :visible="supplementVisible"
        title="补录时间块"
        width="520px"
        confirmText="保存"
        @cancel="closeSupplement"
        @confirm="submitSupplement"
      >
        <div class="form-grid">
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">开始时间</label>
              <HtpInput type="datetime-local"  v-model="supplementForm.startedAt"  />
              <div class="form-hint">年/月/日 时:分（24 小时制）</div>
            </div>
            <div class="form-item">
              <label class="form-item__label">结束时间</label>
              <HtpInput type="datetime-local"  v-model="supplementForm.endedAt"  />
              <div class="form-hint">年/月/日 时:分（24 小时制）</div>
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">类型</label>
            <htp-select v-model="supplementForm.type" :options="TIME_BLOCK_TYPE_OPTIONS"></htp-select>
          </div>
          <div class="form-item">
            <label class="form-item__label">备注（可选）</label>
            <htp-input v-model="supplementForm.note" placeholder="补充说明"></htp-input>
          </div>
        </div>
      </htp-modal>

      <!-- 删除二次确认 -->
      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除时间块？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDelete"
        @confirm="confirmDoDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下记录吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">
            <htp-tag :type="typeTagType(delConfirm.type)">{{ TIME_BLOCK_TYPE_LABEL[delConfirm.type] || delConfirm.type }}</htp-tag>
            <span class="ml-xs">{{ formatDateTime(delConfirm.startedAt) }}</span>
            <span v-if="delConfirm.note" class="ml-sm text-tertiary">备注：{{ delConfirm.note }}</span>
          </div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.TimeBlockPage = TimeBlockPage;

/**
 * 将 Date 转换为 datetime-local 输入框所需的 YYYY-MM-DDTHH:mm
 */
function toLocalInput(date) {
  const d = date instanceof Date ? date : new Date(date);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 将 datetime-local 字符串（YYYY-MM-DDTHH:mm）转换为可服务端解析的 ISO 字符串
 * 空值返回 null
 */
function fromLocalInput(str) {
  if (!str) return null;
  // 补齐秒，便于后端正则与 Date 解析
  return str.includes(':') && str.split(':').length === 2 ? `${str}:00` : str;
}

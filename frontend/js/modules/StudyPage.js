/**
 * StudyPage - 充电学习页面（阶段 3 核心）
 * 两标签切换：学习记录 / 待学清单
 */
const STUDY_TYPE_OPTIONS = [
  { label: '全部类型', value: '' },
  { label: '专业学习', value: '专业学习' },
  { label: '通用学习', value: '通用学习' },
];
const STUDY_TYPE_FORM_OPTIONS = [
  { label: '专业学习', value: '专业学习' },
  { label: '通用学习', value: '通用学习' },
];

const StudyPage = {
  name: 'StudyPage',
  setup() {
    const dataStore = useDataStore();
    const activeTab = Vue.ref('record');

    // ============ 学习统计图表（V1.5 §8.1） ============
    const C = window.htdCharts;
    const charts = Vue.ref(null);
    async function loadCharts() {
      try {
        charts.value = await dataStore.fetchCharts();
      } catch (e) { console.error(e); }
    }
    const chartPeriod = Vue.ref('monthly');
    function setChartPeriod(p) { chartPeriod.value = p; }
    const studyPeriodSvg = Vue.computed(() => {
      if (!charts.value || !charts.value.study) return '';
      const map = { daily: charts.value.study.daily, weekly: charts.value.study.weekly, monthly: charts.value.study.monthly };
      const data = map[chartPeriod.value] || [];
      return C.barChart({ data, height: 170, color: 'var(--chart-series-2)' });
    });
    const studyStackedSvg = Vue.computed(() => {
      if (!charts.value || !charts.value.study) return '';
      const ds = charts.value.study.directionStacked;
      return C.stackedBarChart({ data: ds.data, series: ds.series, height: 220 });
    });
    const studyStackedLegend = Vue.computed(() => {
      if (!charts.value || !charts.value.study) return '';
      return C.legend(charts.value.study.directionStacked.series.map(function (s) { return { label: s.label, color: s.color }; }));
    });

    // ============ 学习时长统计 ============
    const weekHours = Vue.ref(0);
    const monthHours = Vue.ref(0);

    async function loadStats() {
      try {
        const data = await htdApi.get('/study-records/stats');
        weekHours.value = data.weekHours || 0;
        monthHours.value = data.monthHours || 0;
      } catch (e) { /* ignore */ }
    }

    // ============ 学习记录 ============
    const recordList = Vue.ref([]);
    const recordLoading = Vue.ref(false);
    const filterRecordType = Vue.ref('');
    const filterRecordTechDir = Vue.ref('');

    async function loadRecords() {
      recordLoading.value = true;
      try {
        const params = {};
        if (filterRecordType.value) params.type = filterRecordType.value;
        if (filterRecordTechDir.value) params.techDirection = filterRecordTechDir.value;
        const raw = await htdApi.get('/study-records', params);
        recordList.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        recordList.value = [];
      } finally {
        recordLoading.value = false;
      }
    }
    Vue.watch([filterRecordType, filterRecordTechDir], loadRecords);

    const recordModalVisible = Vue.ref(false);
    const editingRecord = Vue.ref(null);
    const recordFormTitle = Vue.computed(() => editingRecord.value ? '编辑学习记录' : '新建学习记录');
    const recordForm = Vue.reactive({
      type: '专业学习', techDirection: '', topic: '', notes: '',
      source: '', duration: 0, studyDate: '',
    });

    function openCreateRecord() {
      editingRecord.value = null;
      Object.assign(recordForm, {
        type: '专业学习', techDirection: '', topic: '', notes: '',
        source: '', duration: 0, studyDate: htdDate.today(),
      });
      recordModalVisible.value = true;
    }
    function openEditRecord(r) {
      editingRecord.value = r;
      Object.assign(recordForm, {
        type: r.type || '专业学习',
        techDirection: r.techDirection || '',
        topic: r.topic || '',
        notes: r.notes || '',
        source: r.source || '',
        duration: r.duration || 0,
        studyDate: r.studyDate || htdDate.today(),
      });
      recordModalVisible.value = true;
    }
    async function submitRecordForm() {
      const topic = (recordForm.topic || '').trim();
      if (!topic) { showToast('学习主题不能为空', 'warning'); return; }
      if (!recordForm.studyDate) { showToast('学习日期不能为空', 'warning'); return; }
      const payload = {
        type: recordForm.type,
        techDirection: recordForm.techDirection || null,
        topic,
        notes: recordForm.notes || null,
        source: recordForm.source || null,
        duration: parseFloat(recordForm.duration) || 0,
        studyDate: recordForm.studyDate,
      };
      try {
        if (editingRecord.value) {
          await dataStore.updateStudyRecord(editingRecord.value.id, payload);
        } else {
          await dataStore.createStudyRecord(payload);
        }
        recordModalVisible.value = false;
        await loadRecords();
        await loadStats();
      } catch (e) { /* toast 已显示 */ }
    }
    const delRecordConfirm = Vue.ref(null);
    function requestDeleteRecord(r) { delRecordConfirm.value = r; }
    async function confirmDeleteRecord() {
      if (!delRecordConfirm.value) return;
      try {
        await dataStore.deleteStudyRecord(delRecordConfirm.value.id);
        delRecordConfirm.value = null;
        await loadRecords();
        await loadStats();
      } catch (e) { /* toast 已显示 */ }
    }

    function recordTypeTag(t) {
      return t === '专业学习' ? 'info' : 'default';
    }

    // ============ 待学清单 ============
    const pendingList = Vue.ref([]);
    const pendingLoading = Vue.ref(false);
    const filterPendingCompleted = Vue.ref('');

    async function loadPendings() {
      pendingLoading.value = true;
      try {
        const params = {};
        if (filterPendingCompleted.value !== '') params.completed = filterPendingCompleted.value;
        const raw = await htdApi.get('/study-pendings', params);
        pendingList.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        pendingList.value = [];
      } finally {
        pendingLoading.value = false;
      }
    }
    Vue.watch(filterPendingCompleted, loadPendings);

    const pendingModalVisible = Vue.ref(false);
    const editingPending = Vue.ref(null);
    const pendingFormTitle = Vue.computed(() => editingPending.value ? '编辑待学资源' : '新建待学资源');
    const pendingForm = Vue.reactive({
      resourceType: '', title: '', sourceLink: '', remark: '',
    });

    function openCreatePending() {
      editingPending.value = null;
      Object.assign(pendingForm, { resourceType: '', title: '', sourceLink: '', remark: '' });
      pendingModalVisible.value = true;
    }
    function openEditPending(p) {
      editingPending.value = p;
      Object.assign(pendingForm, {
        resourceType: p.resourceType || '',
        title: p.title || '',
        sourceLink: p.sourceLink || '',
        remark: p.remark || '',
      });
      pendingModalVisible.value = true;
    }
    async function submitPendingForm() {
      const title = (pendingForm.title || '').trim();
      if (!title) { showToast('资源标题不能为空', 'warning'); return; }
      const payload = {
        resourceType: pendingForm.resourceType || null,
        title,
        sourceLink: pendingForm.sourceLink || null,
        remark: pendingForm.remark || null,
      };
      try {
        if (editingPending.value) {
          await dataStore.updateStudyPending(editingPending.value.id, payload);
        } else {
          await dataStore.createStudyPending(payload);
        }
        pendingModalVisible.value = false;
        await loadPendings();
      } catch (e) { /* toast 已显示 */ }
    }
    const delPendingConfirm = Vue.ref(null);
    function requestDeletePending(p) { delPendingConfirm.value = p; }
    async function confirmDeletePending() {
      if (!delPendingConfirm.value) return;
      try {
        await dataStore.deleteStudyPending(delPendingConfirm.value.id);
        delPendingConfirm.value = null;
        await loadPendings();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 标记已学习 → 转为学习记录 ============
    const completeModalVisible = Vue.ref(false);
    const completeTarget = Vue.ref(null);
    const completeForm = Vue.reactive({
      type: '专业学习', techDirection: '', duration: 0,
      studyDate: '', notes: '',
    });
    const completeFormTitle = Vue.computed(() => {
      const t = completeTarget.value;
      return t ? `标记已学习：${t.title}` : '标记已学习';
    });

    function openCompleteModal(p) {
      completeTarget.value = p;
      Object.assign(completeForm, {
        type: '专业学习',
        techDirection: p.resourceType || '',
        duration: 0,
        studyDate: htdDate.today(),
        notes: '',
      });
      completeModalVisible.value = true;
    }
    async function submitCompleteForm() {
      if (!completeTarget.value) return;
      if (!completeForm.studyDate) { showToast('学习日期不能为空', 'warning'); return; }
      try {
        const result = await dataStore.completeStudyPending(completeTarget.value.id, {
          type: completeForm.type,
          techDirection: completeForm.techDirection || null,
          duration: parseFloat(completeForm.duration) || 0,
          studyDate: completeForm.studyDate,
          notes: completeForm.notes || null,
        });
        completeModalVisible.value = false;
        completeTarget.value = null;
        await loadPendings();
        await loadStats();
        if (activeTab.value === 'record') {
          await loadRecords();
        }
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 标签切换 ============
    function switchTab(tab) {
      activeTab.value = tab;
      if (tab === 'record' && recordList.value.length === 0) loadRecords();
      if (tab === 'pending' && pendingList.value.length === 0) loadPendings();
    }

    Vue.onMounted(() => {
      loadStats();
      loadRecords();
      loadCharts();
    });

    return {
      // 标签
      activeTab, switchTab,
      // 统计
      weekHours, monthHours, loadStats,
      // 学习记录
      recordList, recordLoading, filterRecordType, filterRecordTechDir,
      recordModalVisible, editingRecord, recordFormTitle, recordForm,
      openCreateRecord, openEditRecord, submitRecordForm,
      delRecordConfirm, requestDeleteRecord, confirmDeleteRecord,
      recordTypeTag, loadRecords,
      // 待学清单
      pendingList, pendingLoading, filterPendingCompleted,
      pendingModalVisible, editingPending, pendingFormTitle, pendingForm,
      openCreatePending, openEditPending, submitPendingForm,
      delPendingConfirm, requestDeletePending, confirmDeletePending,
      loadPendings,
      // 标记已学习
      completeModalVisible, completeTarget, completeForm, completeFormTitle,
      openCompleteModal, submitCompleteForm,
      // 选项
      STUDY_TYPE_OPTIONS, STUDY_TYPE_FORM_OPTIONS,
      // 学习统计图表
      charts, chartPeriod, setChartPeriod, studyPeriodSvg, studyStackedSvg, studyStackedLegend,
    };
  },
  template: `
    <div class="list-page">
      <!-- ===== 学习统计图表（V1.5 §8.1） ===== -->
      <div v-if="charts && charts.study" class="stats-grid" style="grid-template-columns: 1fr; gap: var(--spacing-lg);">
        <div class="stat-card" style="padding: var(--spacing-lg);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="font-weight: 600;">学习时长趋势</div>
            <div style="display: flex; gap: 8px;">
              <button class="htp-btn htp-btn--sm" :class="{ 'htp-btn--primary': chartPeriod === 'daily' }" @click="setChartPeriod('daily')">日</button>
              <button class="htp-btn htp-btn--sm" :class="{ 'htp-btn--primary': chartPeriod === 'weekly' }" @click="setChartPeriod('weekly')">周</button>
              <button class="htp-btn htp-btn--sm" :class="{ 'htp-btn--primary': chartPeriod === 'monthly' }" @click="setChartPeriod('monthly')">月</button>
            </div>
          </div>
          <div v-html="studyPeriodSvg"></div>
        </div>
        <div class="stat-card" style="padding: var(--spacing-lg);">
          <div style="font-weight: 600; margin-bottom: 12px;">按技术方向堆叠</div>
          <div v-html="studyStackedSvg"></div>
          <div v-html="studyStackedLegend" style="margin-top: 8px;"></div>
        </div>
      </div>

      <!-- 标签切换 -->
      <div class="htp-tabs">
        <button class="htp-tab" :class="{ 'htp-tab--active': activeTab === 'record' }" @click="switchTab('record')">学习记录</button>
        <button class="htp-tab" :class="{ 'htp-tab--active': activeTab === 'pending' }" @click="switchTab('pending')">待学清单</button>
      </div>

      <!-- 学习时长统计 -->
      <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
        <div class="stat-card">
          <div class="stat-card__label">本周学习时长(h)</div>
          <div class="stat-card__value stat-card__value--success">{{ weekHours }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">本月学习时长(h)</div>
          <div class="stat-card__value stat-card__value--brand">{{ monthHours }}</div>
        </div>
      </div>

      <!-- ===== 学习记录 ===== -->
      <template v-if="activeTab === 'record'">
        <div class="htp-filter-bar">
          <div class="form-row-2">
            <htp-select v-model="filterRecordType" :options="STUDY_TYPE_OPTIONS" placeholder="全部类型"></htp-select>
            <HtpInput v-model="filterRecordTechDir" placeholder="技术方向筛选"  />
          </div>
          <button class="htp-btn htp-btn--primary htp-btn--sm" @click="openCreateRecord">+ 新建记录</button>
        </div>
        <div v-if="recordList.length === 0 && !recordLoading" style="padding: 40px;">
          <htp-empty text="暂无学习记录，点击「新建记录」开始"></htp-empty>
        </div>
        <div class="list-container" v-else>
          <div class="htp-list-item" v-for="r in recordList" :key="r.id" style="flex-direction: column; align-items: stretch; padding: 12px var(--spacing-lg);">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 500;">{{ r.topic }}</span>
                <htp-tag :type="recordTypeTag(r.type)">{{ r.type }}</htp-tag>
                <htp-tag v-if="r.techDirection" type="info">{{ r.techDirection }}</htp-tag>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; color: var(--text-tertiary);">{{ r.studyDate }} · {{ r.duration }}h</span>
                <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openEditRecord(r)">编辑</button>
                <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestDeleteRecord(r)">删除</button>
              </div>
            </div>
            <div v-if="r.notes" style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">
              <span style="color: var(--text-tertiary);">笔记：</span>{{ r.notes }}
            </div>
            <div v-if="r.source" style="margin-top: 4px; font-size: 13px; color: var(--text-secondary);">
              <span style="color: var(--text-tertiary);">来源：</span>{{ r.source }}
            </div>
          </div>
        </div>
      </template>

      <!-- ===== 待学清单 ===== -->
      <template v-if="activeTab === 'pending'">
        <div class="htp-filter-bar">
          <div class="form-row-2">
            <htp-select v-model="filterPendingCompleted" :options="[{label:'全部',value:''},{label:'未学习',value:'false'},{label:'已学习',value:'true'}]" placeholder="全部"></htp-select>
          </div>
          <button class="htp-btn htp-btn--primary htp-btn--sm" @click="openCreatePending">+ 新建资源</button>
        </div>
        <div v-if="pendingList.length === 0 && !pendingLoading" style="padding: 40px;">
          <htp-empty text="暂无待学资源，点击「新建资源」开始"></htp-empty>
        </div>
        <div class="list-container" v-else>
          <div class="htp-list-item" v-for="p in pendingList" :key="p.id" style="flex-direction: column; align-items: stretch; padding: 12px var(--spacing-lg);" :class="{ 'htp-list-item--completed': p.completed }">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 500;">{{ p.title }}</span>
                <htp-tag v-if="p.resourceType" type="info">{{ p.resourceType }}</htp-tag>
                <htp-tag :type="p.completed ? 'success' : 'warning'">{{ p.completed ? '已学习' : '待学习' }}</htp-tag>
              </div>
              <div style="display: flex; gap: 8px;">
                <button v-if="!p.completed" class="htp-btn htp-btn--primary htp-btn--sm" @click="openCompleteModal(p)"><span v-html="htdIcon('check')"></span> 标记已学习</button>
                <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openEditPending(p)">编辑</button>
                <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestDeletePending(p)">删除</button>
              </div>
            </div>
            <div v-if="p.sourceLink" style="margin-top: 8px; font-size: 13px; color: var(--color-primary);">
              <span style="color: var(--text-tertiary);">来源：</span>{{ p.sourceLink }}
            </div>
            <div v-if="p.remark" style="margin-top: 4px; font-size: 13px; color: var(--text-secondary);">
              <span style="color: var(--text-tertiary);">备注：</span>{{ p.remark }}
            </div>
          </div>
        </div>
      </template>

      <!-- ===== 学习记录弹窗 ===== -->
      <htp-modal v-if="recordModalVisible" :visible="true" :title="recordFormTitle" @cancel="recordModalVisible = false" width="700px">
        <div class="form-grid">
          <div>
            <label class="form-label">学习类型</label>
            <htp-select v-model="recordForm.type" :options="STUDY_TYPE_FORM_OPTIONS" placeholder="请选择"></htp-select>
          </div>
          <div>
            <label class="form-label">技术方向</label>
            <HtpInput v-model="recordForm.techDirection" placeholder="如：前端/后端/安全"  />
          </div>
          <div class="form-grid--full">
            <label class="form-label">学习主题 *</label>
            <HtpInput v-model="recordForm.topic" placeholder="学习主题"  />
          </div>
          <div>
            <label class="form-label">学习时长(h)</label>
            <HtpInput v-model="recordForm.duration" type="number" step="0.5" min="0" placeholder="0"  />
          </div>
          <div>
            <label class="form-label">学习日期 *</label>
            <HtpInput v-model="recordForm.studyDate" type="date"  />
          </div>
          <div class="form-grid--full">
            <label class="form-label">资料来源</label>
            <HtpInput v-model="recordForm.source" placeholder="资料来源（可选）"  />
          </div>
          <div class="form-grid--full">
            <label class="form-label">核心笔记</label>
            <textarea class="htp-textarea" v-model="recordForm.notes" placeholder="核心笔记..." rows="4"></textarea>
          </div>
        </div>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="recordModalVisible = false">取消</button>
          <button class="htp-btn htp-btn--primary" @click="submitRecordForm">确认</button>
        </template>
      </htp-modal>

      <!-- ===== 待学清单弹窗 ===== -->
      <htp-modal v-if="pendingModalVisible" :visible="true" :title="pendingFormTitle" @cancel="pendingModalVisible = false">
        <div class="form-grid">
          <div class="form-grid--full">
            <label class="form-label">资源标题 *</label>
            <HtpInput v-model="pendingForm.title" placeholder="资源标题"  />
          </div>
          <div>
            <label class="form-label">资源类型</label>
            <HtpInput v-model="pendingForm.resourceType" placeholder="如：文章/视频/书籍"  />
          </div>
          <div>
            <label class="form-label">来源链接</label>
            <HtpInput v-model="pendingForm.sourceLink" placeholder="URL（可选）"  />
          </div>
          <div class="form-grid--full">
            <label class="form-label">备注</label>
            <HtpInput v-model="pendingForm.remark" placeholder="备注说明（可选）"  />
          </div>
        </div>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="pendingModalVisible = false">取消</button>
          <button class="htp-btn htp-btn--primary" @click="submitPendingForm">确认</button>
        </template>
      </htp-modal>

      <!-- ===== 标记已学习弹窗（转为学习记录） ===== -->
      <htp-modal v-if="completeModalVisible" :visible="true" :title="completeFormTitle" @cancel="completeModalVisible = false" width="700px">
        <div style="background: var(--bg-secondary); border-radius: 6px; padding: 12px; margin-bottom: 16px;">
          <div style="font-size: 13px; color: var(--text-tertiary); margin-bottom: 4px;">将从待学清单转为学习记录，以下字段已自动填充：</div>
          <div style="font-size: 14px;"><strong>主题：</strong>{{ completeTarget ? completeTarget.title : '' }}</div>
          <div v-if="completeTarget && completeTarget.sourceLink" style="font-size: 14px;"><strong>来源：</strong>{{ completeTarget.sourceLink }}</div>
        </div>
        <div class="form-grid">
          <div>
            <label class="form-label">学习类型</label>
            <htp-select v-model="completeForm.type" :options="STUDY_TYPE_FORM_OPTIONS" placeholder="请选择"></htp-select>
          </div>
          <div>
            <label class="form-label">技术方向</label>
            <HtpInput v-model="completeForm.techDirection" placeholder="技术方向"  />
          </div>
          <div>
            <label class="form-label">学习时长(h)</label>
            <HtpInput v-model="completeForm.duration" type="number" step="0.5" min="0" placeholder="0"  />
          </div>
          <div>
            <label class="form-label">学习日期 *</label>
            <HtpInput v-model="completeForm.studyDate" type="date"  />
          </div>
          <div class="form-grid--full">
            <label class="form-label">核心笔记</label>
            <textarea class="htp-textarea" v-model="completeForm.notes" placeholder="学习笔记..." rows="4"></textarea>
          </div>
        </div>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="completeModalVisible = false">取消</button>
          <button class="htp-btn htp-btn--primary" @click="submitCompleteForm">确认转为学习记录</button>
        </template>
      </htp-modal>

      <!-- ===== 删除确认弹窗 ===== -->
      <htp-modal v-if="delRecordConfirm" :visible="true" title="确认删除？" @cancel="delRecordConfirm = null">
        <p>删除后不可恢复，确认删除以下学习记录吗？</p>
        <p style="font-weight: 500; margin-top: 8px;">{{ delRecordConfirm.topic }}</p>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="delRecordConfirm = null">取消</button>
          <button class="htp-btn htp-btn--danger" @click="confirmDeleteRecord">确认删除</button>
        </template>
      </htp-modal>
      <htp-modal v-if="delPendingConfirm" :visible="true" title="确认删除？" @cancel="delPendingConfirm = null">
        <p>删除后不可恢复，确认删除以下待学资源吗？</p>
        <p style="font-weight: 500; margin-top: 8px;">{{ delPendingConfirm.title }}</p>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="delPendingConfirm = null">取消</button>
          <button class="htp-btn htp-btn--danger" @click="confirmDeletePending">确认删除</button>
        </template>
      </htp-modal>
    </div>
  `,
};
window.StudyPage = StudyPage;

/**
 * ProjectPage - 项目管理页面（阶段 2 核心）
 * 左右分栏：左侧项目列表 + 筛选；右侧项目详情（基础信息 + 里程碑 + 任务 + 备忘 + 生成复盘）
 */
const PROJECT_PHASE_OPTIONS = [
  { label: '需求沟通', value: '需求沟通' },
  { label: '方案撰写', value: '方案撰写' },
  { label: 'POC演示', value: 'POC演示' },
  { label: '投标答辩', value: '投标答辩' },
  { label: '交付跟进', value: '交付跟进' },
  { label: '项目结项', value: '项目结项' },
];
const PROJECT_PRIORITY_OPTIONS = [
  { label: '高', value: '高' },
  { label: '中', value: '中' },
  { label: '低', value: '低' },
];
const SECURITY_DOMAIN_OPTIONS = [
  { label: '传统边界安全', value: '传统边界安全' },
  { label: '数据安全', value: '数据安全' },
  { label: '等保合规', value: '等保合规' },
  { label: 'AI安全', value: 'AI安全' },
  { label: '大模型安全', value: '大模型安全' },
  { label: '智能体安全', value: '智能体安全' },
  { label: '零信任', value: '零信任' },
  { label: '其他', value: '其他' },
];

// 6 阶段状态机合法迁移（与后端 PROJECT_PHASE_TRANSITIONS 保持一致，§6.2.2）
const PROJECT_PHASE_TRANSITIONS = {
  '需求沟通': ['方案撰写', 'POC演示', '项目结项', '需求沟通'],
  '方案撰写': ['POC演示', '投标答辩', '项目结项', '方案撰写'],
  'POC演示': ['投标答辩', '交付跟进', '项目结项', 'POC演示'],
  '投标答辩': ['交付跟进', '项目结项', '投标答辩'],
  '交付跟进': ['项目结项', '交付跟进'],
  '项目结项': ['需求沟通'], // 结项后可重开
};

const ProjectPage = {
  name: 'ProjectPage',
  setup() {
    const dataStore = useDataStore();

    // ============ 列表 & 筛选 ============
    const projectList = Vue.ref([]);
    const loading = Vue.ref(false);
    const filterPhase = Vue.ref('');
    const filterPriority = Vue.ref('');
    const filterDomain = Vue.ref('');
    const filterKeyword = Vue.ref('');

    async function loadList() {
      loading.value = true;
      try {
        const params = {};
        if (filterPhase.value) params.phase = filterPhase.value;
        if (filterPriority.value) params.priority = filterPriority.value;
        if (filterDomain.value) params.securityDomain = filterDomain.value;
        if (filterKeyword.value) params.keyword = filterKeyword.value;
        const raw = await htdApi.get('/projects', params);
        projectList.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        projectList.value = [];
      } finally {
        loading.value = false;
      }
    }
    Vue.watch([filterPhase, filterPriority, filterDomain, filterKeyword], loadList);
    // §8.3：下拉项优先取配置平台的值；未配置或拉取失败时回落模块默认常量，
    // 保证「设置里新增的阶段 / 安全领域」能立刻出现在筛选与表单里。
    // 以同名键覆盖上方常量返回给模板，模板无需改动。
    const phaseOptions = Vue.computed(() => {
      const fc = dataStore.fieldConfig;
      const v = (fc && fc.dropdowns) ? fc.dropdowns['project.phase'] : null;
      const src = (Array.isArray(v) && v.length) ? v : PROJECT_PHASE_OPTIONS.map(o => o.value);
      return src.map(x => ({ label: x, value: x }));
    });
    const domainOptions = Vue.computed(() => {
      const fc = dataStore.fieldConfig;
      const v = (fc && fc.dropdowns) ? fc.dropdowns['project.securityDomain'] : null;
      const src = (Array.isArray(v) && v.length) ? v : SECURITY_DOMAIN_OPTIONS.map(o => o.value);
      return src.map(x => ({ label: x, value: x }));
    });

    Vue.onMounted(() => {
      loadList();
      dataStore.fetchFieldConfig();
    });

    function resetFilters() {
      filterPhase.value = '';
      filterPriority.value = '';
      filterDomain.value = '';
      filterKeyword.value = '';
    }

    // ============ 选中项目 & 详情 ============
    const selectedId = Vue.ref(null);
    const detail = Vue.ref(null);
    const detailLoading = Vue.ref(false);
    const projectCharts = Vue.ref(null);

    async function selectProject(p) {
      selectedId.value = p.id;
      await loadDetail();
    }
    async function loadDetail() {
      if (!selectedId.value) return;
      detailLoading.value = true;
      try {
        detail.value = await dataStore.fetchProjectDetail(selectedId.value);
        try {
          projectCharts.value = await dataStore.fetchProjectCharts(selectedId.value);
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        detail.value = null;
        projectCharts.value = null;
      } finally {
        detailLoading.value = false;
      }
    }

    // ============ 项目 CRUD 弹窗 ============
    const formModalVisible = Vue.ref(false);
    const editingProject = Vue.ref(null);
    const formTitle = Vue.computed(() => editingProject.value ? '编辑项目' : '新建项目');
    const form = Vue.reactive({
      customerName: '',
      phase: '需求沟通',
      securityDomains: [],
      priority: '中',
      background: '',
      coreRequirements: '',
      solutionVersion: '',
      contactInfo: '',
      startDate: '',
      expectedEndDate: '',
    });

    function openCreate() {
      editingProject.value = null;
      Object.assign(form, {
        customerName: '',
        phase: '需求沟通',
        securityDomains: [],
        priority: '中',
        background: '',
        coreRequirements: '',
        solutionVersion: '',
        contactInfo: '',
        startDate: '',
        expectedEndDate: '',
      });
      formModalVisible.value = true;
    }
    function openEdit(p) {
      editingProject.value = p;
      Object.assign(form, {
        customerName: p.customerName || '',
        phase: p.phase || '需求沟通',
        securityDomains: Array.isArray(p.securityDomains) ? [...p.securityDomains] : [],
        priority: p.priority || '中',
        background: p.background || '',
        coreRequirements: p.coreRequirements || '',
        solutionVersion: p.solutionVersion || '',
        contactInfo: p.contactInfo || '',
        startDate: p.startDate || '',
        expectedEndDate: p.expectedEndDate || '',
      });
      formModalVisible.value = true;
    }
    function closeForm() { formModalVisible.value = false; }
    async function submitForm() {
      const customerName = (form.customerName || '').trim();
      if (!customerName) { showToast('客户名称不能为空', 'warning'); return; }
      const payload = {
        customerName,
        phase: form.phase,
        securityDomains: form.securityDomains,
        priority: form.priority,
        background: form.background || null,
        coreRequirements: form.coreRequirements || null,
        solutionVersion: form.solutionVersion || null,
        contactInfo: form.contactInfo || null,
        startDate: form.startDate || null,
        expectedEndDate: form.expectedEndDate || null,
      };
      try {
        if (editingProject.value) {
          await dataStore.updateProject(editingProject.value.id, payload);
          formModalVisible.value = false;
          await loadList();
          await loadDetail();
        } else {
          const created = await dataStore.createProject(payload);
          formModalVisible.value = false;
          await loadList();
          if (created && created.id) {
            selectedId.value = created.id;
            await loadDetail();
          }
        }
      } catch (e) { /* toast 已显示 */ }
    }

    // 删除项目（二次确认）
    const delConfirm = Vue.ref(null);
    function requestDelete(p) { delConfirm.value = p; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteProject(delConfirm.value.id);
        if (selectedId.value === delConfirm.value.id) {
          selectedId.value = null;
          detail.value = null;
        }
        delConfirm.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 项目备忘：失焦自动保存 ============
    const memoDraft = Vue.ref('');
    let memoSaveTimer = null;
    function syncMemoDraft() {
      memoDraft.value = (detail.value && detail.value.projectMemo) || '';
    }
    Vue.watch(loadDetail, syncMemoDraft);
    Vue.watch(detail, syncMemoDraft);
    function onMemoBlur() {
      if (!detail.value) return;
      if (memoDraft.value === (detail.value.projectMemo || '')) return;
      // 防抖保存
      if (memoSaveTimer) clearTimeout(memoSaveTimer);
      memoSaveTimer = setTimeout(async () => {
        try {
          await dataStore.updateProjectMemo(detail.value.id, memoDraft.value);
          detail.value.projectMemo = memoDraft.value;
          showToast('备忘已自动保存', 'success');
        } catch (e) { /* toast 已显示 */ }
      }, 400);
    }

    // ============ 里程碑管理 ============
    const milestoneFormVisible = Vue.ref(false);
    const editingMilestone = Vue.ref(null);
    const milestoneForm = Vue.reactive({ name: '', dueDate: '' });

    function openCreateMilestone() {
      editingMilestone.value = null;
      milestoneForm.name = '';
      milestoneForm.dueDate = '';
      milestoneFormVisible.value = true;
    }
    function openEditMilestone(m) {
      editingMilestone.value = m;
      milestoneForm.name = m.name;
      milestoneForm.dueDate = m.dueDate;
      milestoneFormVisible.value = true;
    }
    function closeMilestoneForm() { milestoneFormVisible.value = false; }
    async function submitMilestoneForm() {
      const name = (milestoneForm.name || '').trim();
      if (!name) { showToast('里程碑名称不能为空', 'warning'); return; }
      if (!milestoneForm.dueDate) { showToast('截止日期不能为空', 'warning'); return; }
      try {
        if (editingMilestone.value) {
          await dataStore.updateMilestone(editingMilestone.value.id, {
            name, dueDate: milestoneForm.dueDate,
          });
        } else {
          await dataStore.createMilestone({
            projectId: selectedId.value,
            name, dueDate: milestoneForm.dueDate,
          });
        }
        milestoneFormVisible.value = false;
        await loadDetail();
      } catch (e) { /* toast 已显示 */ }
    }
    async function toggleMilestone(m) {
      try {
        await dataStore.toggleMilestone(m.id);
        await loadDetail();
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }
    const delMilestoneConfirm = Vue.ref(null);
    function requestDeleteMilestone(m) { delMilestoneConfirm.value = m; }
    function cancelDeleteMilestone() { delMilestoneConfirm.value = null; }
    async function confirmDoDeleteMilestone() {
      if (!delMilestoneConfirm.value) return;
      try {
        await dataStore.deleteMilestone(delMilestoneConfirm.value.id);
        delMilestoneConfirm.value = null;
        await loadDetail();
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // 里程碑到期高亮（同首页逻辑）
    function milestoneTagType(m) {
      if (!m || !m.dueDate) return 'default';
      if (m.completed) return 'success';
      const diff = htdDate.daysBetween(htdDate.today(), m.dueDate);
      if (diff < 0) return 'danger';
      if (diff <= 3) return 'warning';
      if (diff <= 7) return 'info';
      return 'default';
    }
    function milestoneDueText(m) {
      if (!m || !m.dueDate) return '';
      if (m.completed) return '已完成';
      const diff = htdDate.daysBetween(htdDate.today(), m.dueDate);
      if (diff < 0) return `已逾期 ${Math.abs(diff)} 天`;
      return htdDate.relativeTime(m.dueDate);
    }

    // ============ 任务管理 ============
    const newTaskName = Vue.ref('');
    async function addTask() {
      const name = (newTaskName.value || '').trim();
      if (!name) { showToast('任务名称不能为空', 'warning'); return; }
      try {
        await dataStore.createTask({ projectId: selectedId.value, name });
        newTaskName.value = '';
        await loadDetail();
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }
    async function toggleTask(t) {
      try {
        await dataStore.toggleTask(t.id);
        await loadDetail();
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }
    const delTaskConfirm = Vue.ref(null);
    function requestDeleteTask(t) { delTaskConfirm.value = t; }
    function cancelDeleteTask() { delTaskConfirm.value = null; }
    async function confirmDoDeleteTask() {
      if (!delTaskConfirm.value) return;
      try {
        await dataStore.deleteTask(delTaskConfirm.value.id);
        delTaskConfirm.value = null;
        await loadDetail();
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 一键生成项目复盘 ============
    const reviewConfirm = Vue.ref(null);
    function requestGenerateReview() {
      if (!detail.value) return;
      reviewConfirm.value = detail.value;
    }
    function cancelGenerateReview() { reviewConfirm.value = null; }
    async function confirmDoGenerateReview() {
      if (!reviewConfirm.value) return;
      try {
        const r = await dataStore.generateProjectReview(reviewConfirm.value.id);
        reviewConfirm.value = null;
        // 跳转到复盘模块（带 projectId 高亮）
        htdRouter.navigate('/review');
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 项目阶段切换（6 阶段状态机） ============
    const phaseSwitchModal = Vue.ref(false);
    const phaseForm = Vue.reactive({ phase: '', reason: '' });
    // 当前阶段可切换到的「下一阶段」（排除自身这个 no-op 选项）
    const nextPhaseOptions = Vue.computed(() => {
      if (!detail.value) return [];
      const allowed = PROJECT_PHASE_TRANSITIONS[detail.value.phase] || [];
      return allowed
        .filter(p => p !== detail.value.phase)
        .map(p => ({ label: p, value: p }));
    });
    const canSwitchPhase = Vue.computed(() => nextPhaseOptions.value.length > 0);
    const isClosingPhase = Vue.computed(() => {
      // 即将结项：交付跟进 → 项目结项 会触发自动生成复盘
      return detail.value
        && detail.value.phase === '交付跟进'
        && phaseForm.phase === '项目结项';
    });
    function openPhaseSwitch() {
      if (!detail.value) return;
      phaseForm.phase = nextPhaseOptions.value.length ? nextPhaseOptions.value[0].value : '';
      phaseForm.reason = '';
      phaseSwitchModal.value = true;
    }
    function closePhaseSwitch() { phaseSwitchModal.value = false; }
    async function confirmPhaseSwitch() {
      if (!detail.value) return;
      if (!phaseForm.phase) { showToast('请选择目标阶段', 'warning'); return; }
      try {
        await dataStore.changeProjectPhase(detail.value.id, phaseForm.phase, phaseForm.reason || null);
        phaseSwitchModal.value = false;
        await loadDetail();
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 杂项辅助 ============
    function priorityType(p) {
      return p === '高' ? 'danger' : p === '中' ? 'warning' : 'default';
    }
    function phaseTagType(phase) {
      // 阶段颜色按业务映射
      const map = {
        '需求沟通': 'default',
        '方案撰写': 'info',
        'POC演示': 'info',
        '投标答辩': 'warning',
        '交付跟进': 'info',
        '项目结项': 'success',
      };
      return map[phase] || 'default';
    }
    function domainText(domains) {
      if (!Array.isArray(domains) || !domains.length) return '—';
      return domains.join('、');
    }
    function progressColor(p) {
      if (p >= 100) return 'var(--color-success)';
      if (p >= 60) return 'var(--color-primary)';
      if (p >= 30) return 'var(--color-warning)';
      return 'var(--color-danger)';
    }
    function todayStr() { return htdDate.today(); }

    // ============ 项目图表（S2-2a 响应式组件替代 v-html）============
    const taskVelocityText = Vue.computed(() => {
      if (!projectCharts.value) return '';
      const tv = projectCharts.value.taskVelocity;
      return '任务 ' + tv.done + '/' + tv.total + ' · 完成率 ' + (tv.completionRate || 0) + '%';
    });

    return {
      // state
      projectList, loading, filterPhase, filterPriority, filterDomain, filterKeyword,
      selectedId, detail, detailLoading, memoDraft,
      formModalVisible, editingProject, formTitle, form,
      delConfirm,
      milestoneFormVisible, editingMilestone, milestoneForm, delMilestoneConfirm,
      newTaskName, delTaskConfirm, reviewConfirm,
      phaseSwitchModal, phaseForm, nextPhaseOptions, canSwitchPhase, isClosingPhase,
      // options
      PROJECT_PHASE_OPTIONS: phaseOptions, PROJECT_PRIORITY_OPTIONS,
      SECURITY_DOMAIN_OPTIONS: domainOptions, PROJECT_PHASE_TRANSITIONS,
      // actions
      loadList, resetFilters, selectProject, loadDetail,
      openCreate, openEdit, closeForm, submitForm,
      requestDelete, cancelDelete, confirmDoDelete,
      onMemoBlur,
      openCreateMilestone, openEditMilestone, closeMilestoneForm, submitMilestoneForm,
      toggleMilestone, requestDeleteMilestone, cancelDeleteMilestone, confirmDoDeleteMilestone,
      addTask, toggleTask, requestDeleteTask, cancelDeleteTask, confirmDoDeleteTask,
      requestGenerateReview, cancelGenerateReview, confirmDoGenerateReview,
      openPhaseSwitch, closePhaseSwitch, confirmPhaseSwitch,
      // helpers
      priorityType, phaseTagType, domainText, progressColor,
      milestoneTagType, milestoneDueText, todayStr,
      // charts
      projectCharts, taskVelocityText,
    };
  },
  template: `
    <div class="project-page">
      <!-- 左侧：列表区 -->
      <div class="project-list-panel">
        <div class="project-filter">
          <div class="form-row-2">
            <htp-select v-model="filterPhase" :options="PROJECT_PHASE_OPTIONS" placeholder="全部阶段" />
            <htp-select v-model="filterPriority" :options="PROJECT_PRIORITY_OPTIONS" placeholder="全部优先级" />
          </div>
          <div class="form-row-2 mt-sm">
            <htp-select v-model="filterDomain" :options="SECURITY_DOMAIN_OPTIONS" placeholder="全部安全领域" />
            <htp-input v-model="filterKeyword" placeholder="客户名称搜索" />
          </div>
          <div class="flex justify-between align-center mt-sm">
            <button class="htp-btn htp-btn--text htp-btn--sm" @click="resetFilters">重置筛选</button>
            <button class="htp-btn htp-btn--primary htp-btn--sm" @click="openCreate">+ 新建项目</button>
          </div>
        </div>

        <div v-if="loading" class="empty-state">加载中...</div>
        <div v-else-if="projectList.length === 0" class="empty-state">
          <span v-html="htdIcon('inbox',{size:18})"></span> 暂无项目，点击「新建项目」开始
        </div>
        <div v-else class="project-cards">
          <div
            v-for="p in projectList"
            :key="p.id"
            class="project-card"
            :class="{ 'project-card--active': p.id === selectedId }"
            @click="selectProject(p)"
          >
            <div class="flex justify-between align-center">
              <span class="project-card__name text-ellipsis">{{ p.customerName }}</span>
              <htp-tag :type="priorityType(p.priority)">{{ p.priority }}</htp-tag>
            </div>
            <div class="flex align-center gap-sm mt-xs">
              <htp-tag :type="phaseTagType(p.phase)">{{ p.phase }}</htp-tag>
              <span class="text-sm text-tertiary text-ellipsis flex-1">{{ domainText(p.securityDomains) }}</span>
            </div>
            <div class="project-card__progress mt-sm">
              <div class="project-card__progress-bar" :style="{ width: p.progress + '%', background: progressColor(p.progress) }"></div>
            </div>
            <div class="flex justify-between align-center mt-xs">
              <span class="text-sm text-tertiary">进度 {{ p.progress }}%</span>
              <div class="flex gap-xs">
                <button class="htp-btn htp-btn--text htp-btn--sm" @click.stop="openEdit(p)">编辑</button>
                <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click.stop="requestDelete(p)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：详情区 -->
      <div class="project-detail-panel">
        <div v-if="!selectedId" class="empty-state">
          <span class="project-detail__hint" v-html="htdIcon('arrowLeft', { size: 18 })"></span> 请从左侧选择项目查看详情
        </div>
        <div v-else-if="detailLoading" class="empty-state">加载中...</div>
        <div v-else-if="!detail" class="empty-state">项目不存在或已被删除</div>
        <div v-else class="project-detail">
          <!-- 标题区 -->
          <div class="project-detail__header">
            <div class="flex justify-between align-center">
              <div class="flex align-center gap-sm">
                <h2 class="project-detail__title">{{ detail.customerName }}</h2>
                <htp-tag :type="phaseTagType(detail.phase)">{{ detail.phase }}</htp-tag>
                <htp-tag :type="priorityType(detail.priority)">{{ detail.priority }}优</htp-tag>
              </div>
              <div class="flex gap-xs">
                <button class="htp-btn htp-btn--primary htp-btn--sm" :disabled="!canSwitchPhase" @click="openPhaseSwitch(detail)">
                  <span v-html="htdIcon('switch',{size:14})"></span> 切换阶段
                </button>
                <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openEdit(detail)">编辑</button>
                <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestDelete(detail)">删除</button>
              </div>
            </div>
            <div class="project-detail__progress mt-base">
              <div class="project-detail__progress-bar" :style="{ width: detail.progress + '%', background: progressColor(detail.progress) }"></div>
            </div>
            <div class="text-sm text-tertiary mt-xs">整体进度 {{ detail.progress }}%</div>
          </div>

          <!-- 基础信息 -->
          <htp-card title="基础信息" class="mt-base">
            <div class="info-grid">
              <div class="info-item"><span class="info-label">安全领域：</span><span class="info-value">{{ domainText(detail.securityDomains) }}</span></div>
              <div class="info-item"><span class="info-label">方案版本：</span><span class="info-value">{{ detail.solutionVersion || '—' }}</span></div>
              <div class="info-item"><span class="info-label">联系人：</span><span class="info-value">{{ detail.contactInfo || '—' }}</span></div>
              <div class="info-item"><span class="info-label">启动时间：</span><span class="info-value">{{ detail.startDate || '—' }}</span></div>
              <div class="info-item"><span class="info-label">预计结项：</span><span class="info-value">{{ detail.expectedEndDate || '—' }}</span></div>
            </div>
            <div v-if="detail.background" class="info-block mt-sm">
              <div class="info-label">项目背景</div>
              <div class="info-content">{{ detail.background }}</div>
            </div>
            <div v-if="detail.coreRequirements" class="info-block mt-sm">
              <div class="info-label">核心需求</div>
              <div class="info-content">{{ detail.coreRequirements }}</div>
            </div>
          </htp-card>

          <!-- 项目图表（V1.5 §8.1） -->
          <htp-card title="项目图表" class="mt-base" v-if="projectCharts && projectCharts.timeline">
            <div class="flex align-center gap-sm mb-sm">
              <span v-html="htdIcon('barChart',{size:16})"></span>
              <span class="font-medium">里程碑时间线</span>
            </div>
            <HtpTimelineChart v-if="projectCharts && projectCharts.timeline" :items="projectCharts.timeline" :height="130" />
            <div class="flex align-center gap-base mt-base">
              <HtpDonutChart :data="[{ label: '已完成', value: projectCharts.taskVelocity.done, color: 'var(--chart-series-3)' }, { label: '未完成', value: projectCharts.taskVelocity.pending, color: 'var(--chart-series-7)' }]" :width="160" :height="160" :center-text="(projectCharts.taskVelocity.completionRate || 0) + '%'" />
              <div class="flex-1">
                <div class="flex align-center gap-sm mb-xs">
                  <span v-html="htdIcon('barChart',{size:16})"></span>
                  <span class="font-medium">任务完成速率</span>
                </div>
                <div class="text-sm text-tertiary">{{ taskVelocityText }}</div>
              </div>
            </div>
          </htp-card>

          <!-- 里程碑 -->
          <htp-card title="项目里程碑" class="mt-base">
            <template #action>
              <button class="htp-btn htp-btn--text htp-btn--sm" @click="openCreateMilestone">+ 添加里程碑</button>
            </template>
            <div v-if="!detail.milestones || detail.milestones.length === 0" class="empty-state">
              暂无里程碑
            </div>
            <div v-else class="milestone-list">
              <div
                v-for="m in detail.milestones"
                :key="m.id"
                class="milestone-item"
                :class="{ 'milestone-item--done': m.completed }"
              >
                <htp-checkbox :modelValue="m.completed" @update:modelValue="toggleMilestone(m)" />
                <div class="flex-1 ml-sm">
                  <div class="flex align-center gap-sm">
                    <span :class="{ 'text-tertiary': m.completed, 'text-primary font-medium': !m.completed }">{{ m.name }}</span>
                    <htp-tag :type="milestoneTagType(m)">{{ milestoneDueText(m) }}</htp-tag>
                  </div>
                  <div class="text-sm text-tertiary mt-xs">截止：{{ m.dueDate }}</div>
                </div>
                <div class="flex gap-xs">
                  <button class="htp-btn htp-btn--text htp-btn--sm" @click="openEditMilestone(m)">编辑</button>
                  <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="requestDeleteMilestone(m)">删除</button>
                </div>
              </div>
            </div>
          </htp-card>

          <!-- 任务清单 -->
          <htp-card title="任务清单" class="mt-base">
            <div class="task-add flex gap-sm">
              <htp-input
                v-model="newTaskName"
                placeholder="输入任务名称，回车添加"
                @enter="addTask"
              />
              <button class="htp-btn htp-btn--primary" @click="addTask">添加</button>
            </div>
            <div v-if="!detail.tasks || detail.tasks.length === 0" class="empty-state mt-sm">
              暂无任务
            </div>
            <div v-else class="task-list mt-sm">
              <div
                v-for="t in detail.tasks"
                :key="t.id"
                class="task-item"
                :class="{ 'task-item--done': t.completed }"
              >
                <htp-checkbox :modelValue="t.completed" @update:modelValue="toggleTask(t)" />
                <span class="flex-1 ml-sm" :class="{ 'text-tertiary': t.completed }">{{ t.name }}</span>
                <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="requestDeleteTask(t)">删除</button>
              </div>
            </div>
          </htp-card>

          <!-- 项目备忘 -->
          <htp-card title="项目备忘（失焦自动保存）" class="mt-base">
            <textarea
              v-model="memoDraft"
              class="htp-textarea"
              rows="4"
              placeholder="记录项目沟通要点、关键决策、待跟进事项..."
              @blur="onMemoBlur"
            ></textarea>
          </htp-card>

          <!-- 生成项目复盘 -->
          <div class="project-detail__footer mt-base">
            <button class="htp-btn htp-btn--primary" @click="requestGenerateReview">
              <span v-html="htdIcon('note',{size:16})"></span> 一键生成项目复盘
            </button>
          </div>
        </div>
      </div>

      <!-- 新建/编辑项目弹窗 -->
      <htp-modal
        v-if="formModalVisible"
        :visible="formModalVisible"
        :title="formTitle"
        width="640px"
        @confirm="submitForm"
        @cancel="closeForm"
      >
        <div class="form-grid">
          <div class="form-item">
            <label class="form-item__label">客户名称 <span class="text-danger">*</span></label>
            <htp-input v-model="form.customerName" placeholder="客户名称" />
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">项目阶段</label>
              <htp-select v-model="form.phase" :options="PROJECT_PHASE_OPTIONS" />
            </div>
            <div class="form-item">
              <label class="form-item__label">优先级</label>
              <htp-select v-model="form.priority" :options="PROJECT_PRIORITY_OPTIONS" />
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">安全领域（多选）</label>
            <div class="checkbox-group">
              <label
                v-for="opt in SECURITY_DOMAIN_OPTIONS"
                :key="opt.value"
                class="checkbox-item"
              >
                <input
                  type="checkbox"
                  :value="opt.value"
                  v-model="form.securityDomains"
                />
                <span>{{ opt.label }}</span>
              </label>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">启动时间</label>
              <htp-input v-model="form.startDate" type="date" />
            </div>
            <div class="form-item">
              <label class="form-item__label">预计结项</label>
              <htp-input v-model="form.expectedEndDate" type="date" />
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">联系人信息</label>
            <htp-input v-model="form.contactInfo" placeholder="如：李经理 138xxxx" />
          </div>
          <div class="form-item">
            <label class="form-item__label">方案版本</label>
            <htp-input v-model="form.solutionVersion" placeholder="如：V1.0 / V2.3" />
          </div>
          <div class="form-item">
            <label class="form-item__label">项目背景</label>
            <textarea v-model="form.background" class="htp-textarea" rows="3" placeholder="项目背景说明"></textarea>
          </div>
          <div class="form-item">
            <label class="form-item__label">核心需求</label>
            <textarea v-model="form.coreRequirements" class="htp-textarea" rows="3" placeholder="客户核心需求描述"></textarea>
          </div>
        </div>
      </htp-modal>

      <!-- 里程碑新增/编辑弹窗 -->
      <htp-modal
        v-if="milestoneFormVisible"
        :visible="milestoneFormVisible"
        :title="editingMilestone ? '编辑里程碑' : '新增里程碑'"
        width="420px"
        @confirm="submitMilestoneForm"
        @cancel="closeMilestoneForm"
      >
        <div class="form-grid">
          <div class="form-item">
            <label class="form-item__label">里程碑名称 <span class="text-danger">*</span></label>
            <htp-input v-model="milestoneForm.name" placeholder="如：方案评审完成" />
          </div>
          <div class="form-item">
            <label class="form-item__label">截止日期 <span class="text-danger">*</span></label>
            <htp-input v-model="milestoneForm.dueDate" type="date" />
          </div>
        </div>
      </htp-modal>

      <!-- 删除项目二次确认 -->
      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除项目？"
        confirmText="确认删除"
        confirmType="danger"
        @confirm="confirmDoDelete"
        @cancel="cancelDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，项目下的里程碑与任务将一并删除，确认删除以下项目吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">
            {{ delConfirm.customerName }}
          </div>
        </div>
      </htp-modal>

      <!-- 删除里程碑二次确认 -->
      <htp-modal
        v-if="delMilestoneConfirm"
        :visible="!!delMilestoneConfirm"
        title="确认删除里程碑？"
        confirmText="确认删除"
        confirmType="danger"
        @confirm="confirmDoDeleteMilestone"
        @cancel="cancelDeleteMilestone"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确认删除以下里程碑吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">
            {{ delMilestoneConfirm.name }}
          </div>
        </div>
      </htp-modal>

      <!-- 删除任务二次确认 -->
      <htp-modal
        v-if="delTaskConfirm"
        :visible="!!delTaskConfirm"
        title="确认删除任务？"
        confirmText="确认删除"
        confirmType="danger"
        @confirm="confirmDoDeleteTask"
        @cancel="cancelDeleteTask"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确认删除以下任务吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">
            {{ delTaskConfirm.name }}
          </div>
        </div>
      </htp-modal>

      <!-- 生成复盘二次确认 -->
      <htp-modal
        v-if="reviewConfirm"
        :visible="!!reviewConfirm"
        title="生成项目复盘草稿？"
        confirmText="确认生成"
        @confirm="confirmDoGenerateReview"
        @cancel="cancelGenerateReview"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">将基于项目当前数据生成复盘草稿，预填以下信息：</div>
          <div class="bg-bg-tertiary rounded p-sm">
            <div>项目：{{ reviewConfirm.customerName }}</div>
            <div class="text-sm text-tertiary mt-xs">阶段：{{ reviewConfirm.phase }} · 进度：{{ reviewConfirm.progress }}%</div>
          </div>
          <div class="text-sm text-tertiary mt-sm">生成后可前往「复盘与沉淀」模块继续编辑详细内容。</div>
        </div>
      </htp-modal>

      <!-- 项目阶段切换（6 阶段状态机） -->
      <htp-modal
        v-if="phaseSwitchModal"
        :visible="phaseSwitchModal"
        title="切换项目阶段"
        width="460px"
        confirmText="确认切换"
        @confirm="confirmPhaseSwitch"
        @cancel="closePhaseSwitch"
      >
        <div class="py-sm">
          <div class="mb-sm flex align-center gap-sm">
            <span class="text-tertiary">当前阶段：</span>
            <htp-tag :type="phaseTagType(detail.phase)">{{ detail.phase }}</htp-tag>
          </div>
          <div class="form-item" v-if="canSwitchPhase">
            <label class="form-item__label">切换至 <span class="text-danger">*</span></label>
            <htp-select v-model="phaseForm.phase" :options="nextPhaseOptions" placeholder="请选择目标阶段" />
          </div>
          <div class="form-item mt-sm">
            <label class="form-item__label">变更说明（可选）</label>
            <textarea v-model="phaseForm.reason" class="htp-textarea" rows="3" placeholder="记录本阶段推进情况或切换原因..."></textarea>
          </div>
          <div v-if="isClosingPhase" class="text-sm text-warning mt-sm">
            即将结项，切换后将自动生成一份项目复盘草稿，可在「复盘与沉淀」模块继续完善。
          </div>
          <div v-if="!canSwitchPhase" class="text-sm text-tertiary mt-sm">
            当前阶段「{{ detail.phase }}」无更多可切换阶段（结项后仅可重开）。
          </div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.ProjectPage = ProjectPage;

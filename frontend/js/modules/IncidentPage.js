/**
 * IncidentPage - 应急响应记录（§4.4.4）
 * 列表 + 新建/编辑表单 + 状态切换（4 态状态机）
 * 另支持通过 POST /incidents/:id/timeline、/actions 追加时间线与处置动作
 * 注：timeline / actions 条目的 JSON 字段结构以后端标准化模板为准（此处按通用结构提交）
 */
const EMERGENCY_STATUS_TRANSITIONS = {
  open: ['contained', 'resolved', 'closed'],
  contained: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};
const EMERGENCY_STATUS_LABELS = {
  open: '未处置',
  contained: '已遏制',
  resolved: '已解决',
  closed: '已关闭',
};
const EMERGENCY_STATUS_TAG_TYPES = {
  open: 'danger',
  contained: 'warning',
  resolved: 'success',
  closed: 'info',
};
const EMERGENCY_STATUS_OPTIONS = Object.keys(EMERGENCY_STATUS_LABELS).map((k) => ({ label: EMERGENCY_STATUS_LABELS[k], value: k }));
const EMERGENCY_SEVERITY_LABELS = { low: '低', medium: '中', high: '高', critical: '严重' };
const EMERGENCY_SEVERITY_TAG_TYPES = { low: 'default', medium: 'info', high: 'warning', critical: 'danger' };
const EMERGENCY_SEVERITY_OPTIONS = Object.keys(EMERGENCY_SEVERITY_LABELS).map((k) => ({ label: EMERGENCY_SEVERITY_LABELS[k], value: k }));

const IncidentPage = {
  name: 'IncidentPage',
  setup() {
    const dataStore = useDataStore();

    const list = Vue.ref([]);
    const loading = Vue.ref(false);
    const filterStatus = Vue.ref('');

    async function loadList() {
      loading.value = true;
      try {
        const params = {};
        if (filterStatus.value) params.status = filterStatus.value;
        const raw = await dataStore.fetchIncidents(params);
        list.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        console.error('加载应急事件失败:', e);
        list.value = [];
      } finally {
        loading.value = false;
      }
    }

    Vue.watch(filterStatus, loadList);
    Vue.onMounted(loadList);

    // ============ 新增 / 编辑 ============
    const formModalVisible = Vue.ref(false);
    const editing = Vue.ref(null);
    const formTitle = Vue.computed(() => (editing.value ? '编辑应急事件' : '新增应急事件'));
    const form = Vue.reactive({
      title: '',
      severity: 'medium',
      status: 'open',
    });

    function openCreate() {
      editing.value = null;
      Object.assign(form, { title: '', severity: 'medium', status: 'open' });
      resetTimelineForm();
      formModalVisible.value = true;
    }
    function openEdit(item) {
      editing.value = item;
      Object.assign(form, {
        title: item.title || '',
        severity: item.severity || 'medium',
        status: item.status || 'open',
      });
      resetTimelineForm();
      formModalVisible.value = true;
    }
    function closeForm() { formModalVisible.value = false; }

    async function submitForm() {
      const title = (form.title || '').trim();
      if (!title) { showToast('标题(title)不能为空', 'warning'); return; }
      const payload = { title, severity: form.severity, status: form.status };
      try {
        if (editing.value) {
          await dataStore.updateIncident(editing.value.id, payload);
        } else {
          await dataStore.createIncident(payload);
        }
        formModalVisible.value = false;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 时间线 / 处置动作 追加 ============
    const timelineTime = Vue.ref('');
    const timelineDesc = Vue.ref('');
    const actionText = Vue.ref('');
    const actionOwner = Vue.ref('');
    const actionTime = Vue.ref('');
    function resetTimelineForm() {
      timelineTime.value = ''; timelineDesc.value = '';
      actionText.value = ''; actionOwner.value = ''; actionTime.value = '';
    }
    // 编辑后刷新 editing 引用，使时间线/动作预览同步最新数据
    function refreshEditing() {
      if (!editing.value) return;
      const fresh = list.value.find((i) => i.id === editing.value.id);
      if (fresh) editing.value = fresh;
    }
    async function addTimelineEntry() {
      if (!editing.value) return;
      const description = (timelineDesc.value || '').trim();
      if (!description) { showToast('时间线描述不能为空', 'warning'); return; }
      try {
        await dataStore.addIncidentTimeline(editing.value.id, {
          time: (timelineTime.value || '').trim() || null,
          description,
        });
        timelineTime.value = ''; timelineDesc.value = '';
        await loadList(); refreshEditing();
      } catch (e) { /* toast 已显示 */ }
    }
    async function addActionEntry() {
      if (!editing.value) return;
      const action = (actionText.value || '').trim();
      if (!action) { showToast('处置动作不能为空', 'warning'); return; }
      try {
        await dataStore.addIncidentAction(editing.value.id, {
          action,
          owner: (actionOwner.value || '').trim() || null,
          time: (actionTime.value || '').trim() || null,
        });
        actionText.value = ''; actionOwner.value = ''; actionTime.value = '';
        await loadList(); refreshEditing();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 状态切换 ============
    function statusOptionsFor(item) {
      const cur = item.status;
      const opts = [{ label: EMERGENCY_STATUS_LABELS[cur] + '（当前）', value: cur }];
      (EMERGENCY_STATUS_TRANSITIONS[cur] || []).forEach((s) => {
        opts.push({ label: EMERGENCY_STATUS_LABELS[s], value: s });
      });
      return opts;
    }
    async function onStatusChange(item, v) {
      if (!v || v === item.status) return;
      try {
        await dataStore.changeIncidentStatus(item.id, v);
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }
    function statusTagType(s) { return EMERGENCY_STATUS_TAG_TYPES[s] || 'default'; }
    function severityTagType(s) { return EMERGENCY_SEVERITY_TAG_TYPES[s] || 'default'; }

    // ============ 删除 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(item) { delConfirm.value = item; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteIncident(delConfirm.value.id);
        delConfirm.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    const openCount = Vue.computed(() =>
      list.value.filter((i) => ['open', 'contained'].includes(i.status)).length);

    return {
      list, loading, filterStatus,
      formModalVisible, editing, formTitle, form,
      timelineTime, timelineDesc, actionText, actionOwner, actionTime,
      delConfirm,
      EMERGENCY_STATUS_OPTIONS, EMERGENCY_STATUS_LABELS, EMERGENCY_SEVERITY_OPTIONS, EMERGENCY_SEVERITY_LABELS,
      loadList, openCreate, openEdit, closeForm, submitForm,
      addTimelineEntry, addActionEntry,
      statusOptionsFor, onStatusChange, statusTagType, severityTagType,
      requestDelete, cancelDelete, confirmDoDelete, openCount,
    };
  },
  template: `
    <div class="list-page incident-page">
      <div class="htp-filter-bar">
        <div class="htp-filter-bar__item">
          <htp-select
            v-model="filterStatus"
            :options="[{label:'全部状态',value:''}].concat(EMERGENCY_STATUS_OPTIONS)"
          ></htp-select>
        </div>
        <div style="margin-left:auto">
          <button class="htp-btn htp-btn--primary" @click="openCreate">+ 新增应急事件</button>
        </div>
      </div>

      <div class="list-container">
        <div class="list-header">
          <div class="list-header__title">
            <span v-html="htdIcon('rocket', { size: 20 })" style="margin-right:8px;display:inline-flex;vertical-align:-4px"></span>
            应急响应记录
          </div>
          <div class="list-header__meta">
            <span class="text-sm mr-md">共 {{ list.length }} 条</span>
            <htp-tag type="danger">进行中 {{ openCount }}</htp-tag>
          </div>
        </div>

        <div class="list-body">
          <div v-if="loading" class="text-center py-lg text-tertiary">加载中...</div>
          <div v-else-if="list.length === 0">
            <htp-empty text="暂无应急事件，点击「新增应急事件」开始记录"></htp-empty>
          </div>
          <ul v-else class="todo-list">
            <li v-for="item in list" :key="item.id" class="todo-list-item">
              <div class="flex-1 min-w-0">
                <div class="flex items-center flex-wrap gap-xs">
                  <htp-tag :type="severityTagType(item.severity)">{{ EMERGENCY_SEVERITY_LABELS[item.severity] || item.severity }}</htp-tag>
                  <htp-tag :type="statusTagType(item.status)">{{ EMERGENCY_STATUS_LABELS[item.status] || item.status }}</htp-tag>
                  <span class="text-primary font-medium">{{ item.title }}</span>
                </div>
                <div class="text-sm text-tertiary mt-xs flex items-center flex-wrap gap-sm">
                  <span v-if="item.review">复盘：{{ item.review }}</span>
                  <span v-if="item.eventTimeline && item.eventTimeline.length">时间线 {{ item.eventTimeline.length }} 条</span>
                  <span v-if="item.responseActions && item.responseActions.length">处置动作 {{ item.responseActions.length }} 条</span>
                </div>
              </div>
              <div class="ml-sm flex items-center gap-xs">
                <htp-select
                  :model-value="item.status"
                  :options="statusOptionsFor(item)"
                  @change="(v) => onStatusChange(item, v)"
                ></htp-select>
                <button class="htp-btn htp-btn--text htp-btn--primary htp-btn--sm" @click="openEdit(item)">编辑</button>
                <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="requestDelete(item)">删除</button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <htp-modal
        :visible="formModalVisible"
        :title="formTitle"
        width="600px"
        confirmText="保存"
        @cancel="closeForm"
        @confirm="submitForm"
      >
        <div class="form-grid">
          <div class="form-item">
            <label class="form-item__label"><span class="text-danger">*</span> 事件标题 (title)</label>
            <htp-input v-model="form.title" placeholder="例如：生产环境 Redis 未授权访问" maxlength="200"></htp-input>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">严重级别</label>
              <htp-select v-model="form.severity" :options="EMERGENCY_SEVERITY_OPTIONS"></htp-select>
            </div>
            <div class="form-item">
              <label class="form-item__label">状态</label>
              <htp-select v-model="form.status" :options="EMERGENCY_STATUS_OPTIONS"></htp-select>
            </div>
          </div>

          <template v-if="editing">
            <div class="form-item">
              <label class="form-item__label">追加时间线（POST /incidents/:id/timeline）</label>
              <div class="flex items-center gap-xs" style="margin-bottom:6px">
                <HtpInput type="datetime-local"  v-model="timelineTime" style="flex:0 0 200px"  />
                <htp-input v-model="timelineDesc" placeholder="时间线描述" style="flex:1" maxlength="500"></htp-input>
                <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="addTimelineEntry">添加</button>
              </div>
              <ul v-if="editing.eventTimeline && editing.eventTimeline.length" class="text-sm text-tertiary" style="padding-left:18px;list-style:disc">
                <li v-for="(t, i) in editing.eventTimeline" :key="i">
                  <span v-if="t.time">{{ t.time }} · </span>{{ t.description }}
                </li>
              </ul>
            </div>

            <div class="form-item">
              <label class="form-item__label">追加处置动作（POST /incidents/:id/actions）</label>
              <div class="flex items-center gap-xs" style="margin-bottom:6px">
                <htp-input v-model="actionText" placeholder="处置动作" style="flex:1" maxlength="500"></htp-input>
                <htp-input v-model="actionOwner" placeholder="负责人" style="flex:0 0 120px" maxlength="60"></htp-input>
                <HtpInput type="datetime-local"  v-model="actionTime" style="flex:0 0 180px"  />
                <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="addActionEntry">添加</button>
              </div>
              <ul v-if="editing.responseActions && editing.responseActions.length" class="text-sm text-tertiary" style="padding-left:18px;list-style:disc">
                <li v-for="(a, i) in editing.responseActions" :key="i">
                  <span v-if="a.time">{{ a.time }} · </span><span v-if="a.owner">[{{ a.owner }}] </span>{{ a.action }}
                </li>
              </ul>
            </div>
          </template>
        </div>
      </htp-modal>

      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除应急事件？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDelete"
        @confirm="confirmDoDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下应急事件吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">{{ delConfirm.title }}</div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.IncidentPage = IncidentPage;

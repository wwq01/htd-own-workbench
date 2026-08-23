/**
 * PocPage - POC 跟踪（渗透验证，§4.4.1）
 * 列表 + 新建/编辑表单 + 状态切换（6 态状态机 draft→scheduled→in_progress→success/failed）
 */
const POC_STATUS_TRANSITIONS = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['success', 'failed', 'cancelled'],
  success: [],
  failed: [],
  cancelled: [],
};
const POC_STATUS_LABELS = {
  draft: '草稿',
  scheduled: '已排期',
  in_progress: '进行中',
  success: '验证成功',
  failed: '验证失败',
  cancelled: '已取消',
};
const POC_STATUS_TAG_TYPES = {
  draft: 'default',
  scheduled: 'info',
  in_progress: 'primary',
  success: 'success',
  failed: 'danger',
  cancelled: 'warning',
};
const POC_STATUS_OPTIONS = Object.keys(POC_STATUS_LABELS).map((k) => ({ label: POC_STATUS_LABELS[k], value: k }));

const PocPage = {
  name: 'PocPage',
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
        const raw = await dataStore.fetchPocs(params);
        list.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        console.error('加载 POC 列表失败:', e);
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
    const formTitle = Vue.computed(() => (editing.value ? '编辑 POC' : '新增 POC'));
    const form = Vue.reactive({
      goal: '',
      environment: '',
      projectId: '',
      customerParticipants: '',
      result: '',
      status: 'draft',
    });

    function openCreate() {
      editing.value = null;
      Object.assign(form, {
        goal: '', environment: '', projectId: '',
        customerParticipants: '', result: '', status: 'draft',
      });
      formModalVisible.value = true;
    }
    function openEdit(item) {
      editing.value = item;
      Object.assign(form, {
        goal: item.goal || '',
        environment: item.environment || '',
        projectId: item.projectId || '',
        customerParticipants: Array.isArray(item.customerParticipants)
          ? item.customerParticipants.join('\n')
          : (item.customerParticipants || ''),
        result: item.result || '',
        status: item.status || 'draft',
      });
      formModalVisible.value = true;
    }
    function closeForm() { formModalVisible.value = false; }

    async function submitForm() {
      const goal = (form.goal || '').trim();
      if (!goal) { showToast('验证目标(goal)不能为空', 'warning'); return; }
      const participants = (form.customerParticipants || '')
        .split('\n').map((s) => s.trim()).filter(Boolean);
      const payload = {
        goal,
        environment: form.environment || null,
        projectId: form.projectId || null,
        customerParticipants: participants,
        result: form.result || null,
        status: form.status,
      };
      try {
        if (editing.value) {
          await dataStore.updatePoc(editing.value.id, payload);
        } else {
          await dataStore.createPoc(payload);
        }
        formModalVisible.value = false;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 状态切换（受 6 态状态机约束） ============
    function statusOptionsFor(item) {
      const cur = item.status;
      const opts = [{ label: POC_STATUS_LABELS[cur] + '（当前）', value: cur }];
      (POC_STATUS_TRANSITIONS[cur] || []).forEach((s) => {
        opts.push({ label: POC_STATUS_LABELS[s], value: s });
      });
      return opts;
    }
    async function onStatusChange(item, v) {
      if (!v || v === item.status) return;
      try {
        await dataStore.changePocStatus(item.id, v);
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }
    function statusTagType(s) { return POC_STATUS_TAG_TYPES[s] || 'default'; }

    // ============ 删除 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(item) { delConfirm.value = item; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deletePoc(delConfirm.value.id);
        delConfirm.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    function formatParticipants(item) {
      const arr = Array.isArray(item.customerParticipants) ? item.customerParticipants : [];
      return arr.length ? arr.join('、') : '—';
    }
    const activeCount = Vue.computed(() =>
      list.value.filter((i) => ['draft', 'scheduled', 'in_progress'].includes(i.status)).length);

    return {
      list, loading, filterStatus,
      formModalVisible, editing, formTitle, form,
      delConfirm,
      POC_STATUS_OPTIONS, POC_STATUS_LABELS,
      loadList, openCreate, openEdit, closeForm, submitForm,
      statusOptionsFor, onStatusChange, statusTagType,
      requestDelete, cancelDelete, confirmDoDelete, formatParticipants, activeCount,
    };
  },
  template: `
    <div class="list-page poc-page">
      <div class="htp-filter-bar">
        <div class="htp-filter-bar__item">
          <htp-select
            v-model="filterStatus"
            :options="[{label:'全部状态',value:''}].concat(POC_STATUS_OPTIONS)"
          ></htp-select>
        </div>
        <div style="margin-left:auto">
          <button class="htp-btn htp-btn--primary" @click="openCreate">+ 新增 POC</button>
        </div>
      </div>

      <div class="list-container">
        <div class="list-header">
          <div class="list-header__title">
            <span v-html="htdIcon('flask', { size: 20 })" style="margin-right:8px;display:inline-flex;vertical-align:-4px"></span>
            POC 跟踪
          </div>
          <div class="list-header__meta">
            <span class="text-sm mr-md">共 {{ list.length }} 条</span>
            <htp-tag type="warning">进行中 {{ activeCount }}</htp-tag>
          </div>
        </div>

        <div class="list-body">
          <div v-if="loading" class="text-center py-lg text-tertiary">加载中...</div>
          <div v-else-if="list.length === 0">
            <htp-empty text="暂无 POC 记录，点击「新增 POC」开始记录渗透验证"></htp-empty>
          </div>
          <ul v-else class="todo-list">
            <li v-for="item in list" :key="item.id" class="todo-list-item">
              <div class="flex-1 min-w-0">
                <div class="flex items-center flex-wrap gap-xs">
                  <htp-tag :type="statusTagType(item.status)">{{ POC_STATUS_LABELS[item.status] || item.status }}</htp-tag>
                  <span class="text-primary font-medium">{{ item.goal }}</span>
                </div>
                <div class="text-sm text-tertiary mt-xs flex items-center flex-wrap gap-sm">
                  <span v-if="item.environment">环境：{{ item.environment }}</span>
                  <span v-if="item.projectId">关联项目：{{ item.projectId }}</span>
                  <span>参与方：{{ formatParticipants(item) }}</span>
                  <span v-if="item.result">结论：{{ item.result }}</span>
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
        width="560px"
        confirmText="保存"
        @cancel="closeForm"
        @confirm="submitForm"
      >
        <div class="form-grid">
          <div class="form-item">
            <label class="form-item__label"><span class="text-danger">*</span> 验证目标 (goal)</label>
            <htp-input v-model="form.goal" placeholder="例如：客户A 内网横向移动验证" maxlength="200"></htp-input>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">环境 (environment)</label>
              <htp-input v-model="form.environment" placeholder="例如：测试环境 / 生产环境" maxlength="100"></htp-input>
            </div>
            <div class="form-item">
              <label class="form-item__label">关联项目 (projectId)</label>
              <htp-input v-model="form.projectId" placeholder="可选，关联项目 ID" maxlength="50"></htp-input>
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">客户参与方（每行一个）</label>
            <htp-textarea v-model="form.customerParticipants" :rows="3" placeholder="张三（安全负责人）&#10;李四（网络管理员）"></htp-textarea>
          </div>
          <div class="form-item">
            <label class="form-item__label">结果 (result)</label>
            <htp-textarea v-model="form.result" :rows="3" placeholder="验证结论（可选）" maxlength="1000"></htp-textarea>
          </div>
          <div class="form-item">
            <label class="form-item__label">状态</label>
            <htp-select v-model="form.status" :options="POC_STATUS_OPTIONS"></htp-select>
          </div>
        </div>
      </htp-modal>

      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除 POC？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDelete"
        @confirm="confirmDoDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下 POC 吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">{{ delConfirm.goal }}</div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.PocPage = PocPage;

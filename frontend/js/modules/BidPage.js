/**
 * BidPage - 投标档案（§4.4.2）
 * 列表 + 新建/编辑表单 + 状态切换（draft→submitted→archived）+ 中标结果
 * 另支持按 projectMilestoneId 软关联筛选（GET /bids?milestoneId=）
 */
const BID_STATUS_TRANSITIONS = {
  draft: ['submitted', 'archived'],
  submitted: ['archived'],
  archived: [],
};
const BID_STATUS_LABELS = {
  draft: '草稿',
  submitted: '已提交',
  archived: '已归档',
};
const BID_STATUS_TAG_TYPES = {
  draft: 'default',
  submitted: 'info',
  archived: 'warning',
};
const BID_STATUS_OPTIONS = Object.keys(BID_STATUS_LABELS).map((k) => ({ label: BID_STATUS_LABELS[k], value: k }));
const BID_RESULT_LABELS = { pending: '待定', won: '中标', lost: '未中标' };
const BID_RESULT_TAG_TYPES = { pending: 'default', won: 'success', lost: 'danger' };
const BID_RESULT_OPTIONS = Object.keys(BID_RESULT_LABELS).map((k) => ({ label: BID_RESULT_LABELS[k], value: k }));

const BidPage = {
  name: 'BidPage',
  setup() {
    const dataStore = useDataStore();

    const list = Vue.ref([]);
    const loading = Vue.ref(false);
    const filterStatus = Vue.ref('');
    const filterMilestone = Vue.ref('');

    async function loadList() {
      loading.value = true;
      try {
        const params = {};
        if (filterStatus.value) params.status = filterStatus.value;
        if (filterMilestone.value) params.milestoneId = filterMilestone.value;
        const raw = await dataStore.fetchBids(params);
        list.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        console.error('加载投标列表失败:', e);
        list.value = [];
      } finally {
        loading.value = false;
      }
    }

    Vue.watch([filterStatus, filterMilestone], loadList);
    Vue.onMounted(loadList);

    // ============ 新增 / 编辑 ============
    const formModalVisible = Vue.ref(false);
    const editing = Vue.ref(null);
    const formTitle = Vue.computed(() => (editing.value ? '编辑投标' : '新增投标'));
    const form = Vue.reactive({
      bidNo: '',
      deadline: '',
      bidVersion: '',
      projectMilestoneId: '',
      bidResult: 'pending',
      status: 'draft',
    });

    function openCreate() {
      editing.value = null;
      Object.assign(form, {
        bidNo: '', deadline: '', bidVersion: '',
        projectMilestoneId: '', bidResult: 'pending', status: 'draft',
      });
      formModalVisible.value = true;
    }
    function openEdit(item) {
      editing.value = item;
      Object.assign(form, {
        bidNo: item.bidNo || '',
        deadline: item.deadline || '',
        bidVersion: item.bidVersion || '',
        projectMilestoneId: item.projectMilestoneId || '',
        bidResult: item.bidResult || 'pending',
        status: item.status || 'draft',
      });
      formModalVisible.value = true;
    }
    function closeForm() { formModalVisible.value = false; }

    async function submitForm() {
      const bidNo = (form.bidNo || '').trim();
      if (!bidNo) { showToast('投标编号(bidNo)不能为空', 'warning'); return; }
      const payload = {
        bidNo,
        deadline: form.deadline || null,
        bidVersion: form.bidVersion || null,
        projectMilestoneId: form.projectMilestoneId || null,
        bidResult: form.bidResult,
        status: form.status,
      };
      try {
        if (editing.value) {
          await dataStore.updateBid(editing.value.id, payload);
        } else {
          await dataStore.createBid(payload);
        }
        formModalVisible.value = false;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 状态切换 ============
    function statusOptionsFor(item) {
      const cur = item.status;
      const opts = [{ label: BID_STATUS_LABELS[cur] + '（当前）', value: cur }];
      (BID_STATUS_TRANSITIONS[cur] || []).forEach((s) => {
        opts.push({ label: BID_STATUS_LABELS[s], value: s });
      });
      return opts;
    }
    async function onStatusChange(item, v) {
      if (!v || v === item.status) return;
      try {
        await dataStore.changeBidStatus(item.id, v);
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }
    function statusTagType(s) { return BID_STATUS_TAG_TYPES[s] || 'default'; }
    function resultTagType(r) { return BID_RESULT_TAG_TYPES[r] || 'default'; }

    // ============ 删除 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(item) { delConfirm.value = item; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteBid(delConfirm.value.id);
        delConfirm.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    const activeCount = Vue.computed(() =>
      list.value.filter((i) => ['draft', 'submitted'].includes(i.status)).length);

    return {
      list, loading, filterStatus, filterMilestone,
      formModalVisible, editing, formTitle, form,
      delConfirm,
      BID_STATUS_OPTIONS, BID_STATUS_LABELS, BID_RESULT_OPTIONS, BID_RESULT_LABELS,
      loadList, openCreate, openEdit, closeForm, submitForm,
      statusOptionsFor, onStatusChange, statusTagType, resultTagType,
      requestDelete, cancelDelete, confirmDoDelete, activeCount,
    };
  },
  template: `
    <div class="list-page bid-page">
      <div class="htp-filter-bar">
        <div class="htp-filter-bar__item">
          <htp-select
            v-model="filterStatus"
            :options="[{label:'全部状态',value:''}].concat(BID_STATUS_OPTIONS)"
          ></htp-select>
        </div>
        <div class="htp-filter-bar__item">
          <htp-input v-model="filterMilestone" placeholder="按里程碑 ID 筛选（可选）"></htp-input>
        </div>
        <div style="margin-left:auto">
          <button class="htp-btn htp-btn--primary" @click="openCreate">+ 新增投标</button>
        </div>
      </div>

      <div class="list-container">
        <div class="list-header">
          <div class="list-header__title">
            <span v-html="htdIcon('clipboard', { size: 20 })" style="margin-right:8px;display:inline-flex;vertical-align:-4px"></span>
            投标档案
          </div>
          <div class="list-header__meta">
            <span class="text-sm mr-md">共 {{ list.length }} 条</span>
            <htp-tag type="warning">进行中 {{ activeCount }}</htp-tag>
          </div>
        </div>

        <div class="list-body">
          <div v-if="loading" class="text-center py-lg text-tertiary">加载中...</div>
          <div v-else-if="list.length === 0">
            <htp-empty text="暂无投标记录，点击「新增投标」开始归档"></htp-empty>
          </div>
          <ul v-else class="todo-list">
            <li v-for="item in list" :key="item.id" class="todo-list-item">
              <div class="flex-1 min-w-0">
                <div class="flex items-center flex-wrap gap-xs">
                  <htp-tag :type="statusTagType(item.status)">{{ BID_STATUS_LABELS[item.status] || item.status }}</htp-tag>
                  <htp-tag :type="resultTagType(item.bidResult)">{{ BID_RESULT_LABELS[item.bidResult] || item.bidResult || '待定' }}</htp-tag>
                  <span class="text-primary font-medium">{{ item.bidNo }}</span>
                </div>
                <div class="text-sm text-tertiary mt-xs flex items-center flex-wrap gap-sm">
                  <span v-if="item.deadline">截止：{{ item.deadline }}</span>
                  <span v-if="item.bidVersion">版本：{{ item.bidVersion }}</span>
                  <span v-if="item.projectMilestoneId">里程碑：{{ item.projectMilestoneId }}</span>
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
            <label class="form-item__label"><span class="text-danger">*</span> 投标编号 (bidNo)</label>
            <htp-input v-model="form.bidNo" placeholder="唯一编号，例如：BID-2024-007" maxlength="80"></htp-input>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">截止日期 (deadline)</label>
              <input type="date" class="htp-input" v-model="form.deadline" />
            </div>
            <div class="form-item">
              <label class="form-item__label">版本 (bidVersion)</label>
              <htp-input v-model="form.bidVersion" placeholder="例如：v1.0（可选）" maxlength="40"></htp-input>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">中标结果</label>
              <htp-select v-model="form.bidResult" :options="BID_RESULT_OPTIONS"></htp-select>
            </div>
            <div class="form-item">
              <label class="form-item__label">状态</label>
              <htp-select v-model="form.status" :options="BID_STATUS_OPTIONS"></htp-select>
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">关联里程碑 (projectMilestoneId)</label>
            <htp-input v-model="form.projectMilestoneId" placeholder="可选，仅存 id 无级联" maxlength="50"></htp-input>
          </div>
        </div>
      </htp-modal>

      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除投标？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDelete"
        @confirm="confirmDoDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下投标吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">{{ delConfirm.bidNo }}</div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.BidPage = BidPage;

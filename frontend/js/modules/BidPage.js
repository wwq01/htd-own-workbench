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

// ===== S2-5 RFP 条目级应答 =====
const RFP_RESPONSE_LABELS = {
  pending: '待应答',
  full: '完全响应',
  partial: '部分响应',
  exceed: '优于要求',
  deviation: '偏离',
  non: '不响应',
};
const RFP_RESPONSE_TAG_TYPES = {
  pending: 'default',
  full: 'success',
  partial: 'warning',
  exceed: 'success',
  deviation: 'warning',
  non: 'danger',
};
const RFP_RESPONSE_OPTIONS = Object.keys(RFP_RESPONSE_LABELS).map((k) => ({
  label: RFP_RESPONSE_LABELS[k], value: k,
}));
const RFP_STATUS_LABELS = { todo: '待应答', doing: '应答中', done: '已完成' };
const RFP_STATUS_TAG_TYPES = { todo: 'default', doing: 'info', done: 'success' };
const RFP_STATUS_OPTIONS = Object.keys(RFP_STATUS_LABELS).map((k) => ({
  label: RFP_STATUS_LABELS[k], value: k,
}));
const RFP_STATUS_TRANSITIONS = {
  todo: ['doing', 'done'],
  doing: ['done', 'todo'],
  done: ['doing'],
};
// 证据来源（通用软关联，与后端 EVIDENCE_SOURCE_TYPE 对齐）
const RFP_EVIDENCE_LABELS = {
  VAULT: 'Vault 沉淀',
  POC: 'POC 验证',
  VULN: '漏洞记录',
  MEETING: '会议纪要',
  NOTE: '笔记',
  CONTRACT: '合同回款',
  DEPLOYMENT: '交付记录',
  OTHER: '其他',
};
const RFP_EVIDENCE_OPTIONS = Object.keys(RFP_EVIDENCE_LABELS).map((k) => ({
  label: RFP_EVIDENCE_LABELS[k], value: k,
}));

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

    // ============ S2-5 RFP 条目级应答 ============
    const rfpVisible = Vue.ref(false);
    const rfpBid = Vue.ref(null);
    const rfpItems = Vue.ref([]);
    const rfpLoading = Vue.ref(false);
    const rfpStats = Vue.ref(null);
    const rfpFormVisible = Vue.ref(false);
    const rfpEditing = Vue.ref(null);
    const rfpEvidence = Vue.ref([]);
    const rfpDraft = Vue.reactive({ sourceType: 'VAULT', sourceId: '', label: '' });
    const rfpDelConfirm = Vue.ref(null);
    const rfpForm = Vue.reactive({
      code: '', title: '', requirement: '', response: '',
      responseType: 'pending', status: 'todo', owner: '', remark: '', sortOrder: 0,
    });

    const rfpProgress = Vue.computed(() => {
      const s = rfpStats.value;
      return s && s.total ? s.progress : 0;
    });

    const rfpColumns = [
      { key: 'code', title: '编号', width: '84px' },
      { key: 'title', title: '条目 / 要求' },
      { key: 'response', title: '应答' },
      { key: 'responseType', title: '应答类型', width: '96px' },
      { key: 'status', title: '进度', width: '124px' },
      { key: 'evidence', title: '证据', width: '148px' },
      { key: 'actions', title: '操作', width: '118px', align: 'right' },
    ];

    async function loadRfp() {
      if (!rfpBid.value) return;
      rfpLoading.value = true;
      try {
        const params = { bidId: rfpBid.value.id };
        const raw = await dataStore.fetchRfpItems(params);
        rfpItems.value = Array.isArray(raw) ? raw : (raw.list || []);
        rfpStats.value = await dataStore.fetchRfpStats(rfpBid.value.id);
      } catch (e) {
        console.error('加载 RFP 条目失败:', e);
        rfpItems.value = [];
        rfpStats.value = null;
      } finally {
        rfpLoading.value = false;
      }
    }

    function openRfp(item) {
      rfpBid.value = item;
      rfpVisible.value = true;
      loadRfp();
    }

    function resetRfpForm() {
      Object.assign(rfpForm, {
        code: '', title: '', requirement: '', response: '',
        responseType: 'pending', status: 'todo', owner: '', remark: '', sortOrder: 0,
      });
      rfpEvidence.value = [];
      rfpDraft.sourceType = 'VAULT';
      rfpDraft.sourceId = '';
      rfpDraft.label = '';
    }

    function openRfpCreate() {
      rfpEditing.value = null;
      resetRfpForm();
      rfpFormVisible.value = true;
    }

    function openRfpEdit(row) {
      rfpEditing.value = row;
      Object.assign(rfpForm, {
        code: row.code || '',
        title: row.title || '',
        requirement: row.requirement || '',
        response: row.response || '',
        responseType: row.responseType || 'pending',
        status: row.status || 'todo',
        owner: row.owner || '',
        remark: row.remark || '',
        sortOrder: row.sortOrder || 0,
      });
      rfpEvidence.value = Array.isArray(row.evidence) ? row.evidence.slice() : [];
      rfpFormVisible.value = true;
    }

    function closeRfpForm() { rfpFormVisible.value = false; }

    function addRfpEvidence() {
      const sid = (rfpDraft.sourceId || '').trim();
      if (!sid) { showToast('请填写证据来源 ID', 'warning'); return; }
      if (rfpEvidence.value.length >= 50) { showToast('单个条目最多挂载 50 条证据', 'warning'); return; }
      const dup = rfpEvidence.value.some((e) => e.sourceType === rfpDraft.sourceType && e.sourceId === sid);
      if (dup) { showToast('该证据已挂载', 'warning'); return; }
      rfpEvidence.value.push({
        sourceType: rfpDraft.sourceType,
        sourceId: sid,
        label: (rfpDraft.label || '').trim() || null,
      });
      rfpDraft.sourceId = '';
      rfpDraft.label = '';
    }

    function removeRfpEvidence(i) { rfpEvidence.value.splice(i, 1); }

    async function submitRfp() {
      const title = (rfpForm.title || '').trim();
      if (!title) { showToast('条目标题不能为空', 'warning'); return; }
      const payload = {
        code: rfpForm.code || null,
        title,
        requirement: rfpForm.requirement || null,
        response: rfpForm.response || null,
        responseType: rfpForm.responseType,
        status: rfpForm.status,
        owner: rfpForm.owner || null,
        remark: rfpForm.remark || null,
        sortOrder: Number(rfpForm.sortOrder) || 0,
        evidence: rfpEvidence.value.slice(),
      };
      try {
        if (rfpEditing.value) {
          await dataStore.updateRfpItem(rfpEditing.value.id, payload);
        } else {
          await dataStore.createRfpItem({ bidId: rfpBid.value.id, ...payload });
        }
        rfpFormVisible.value = false;
        await loadRfp();
      } catch (e) { /* toast 已显示 */ }
    }

    function rfpStatusOptionsFor(row) {
      const cur = row.status || 'todo';
      const opts = [{ label: RFP_STATUS_LABELS[cur] + '（当前）', value: cur }];
      (RFP_STATUS_TRANSITIONS[cur] || []).forEach((s) => {
        opts.push({ label: RFP_STATUS_LABELS[s], value: s });
      });
      return opts;
    }

    async function onRfpStatusChange(row, v) {
      if (!v || v === row.status) return;
      try {
        await dataStore.changeRfpItemStatus(row.id, v);
        await loadRfp();
      } catch (e) { /* toast 已显示 */ }
    }

    function requestDeleteRfp(row) { rfpDelConfirm.value = row; }
    function cancelDeleteRfp() { rfpDelConfirm.value = null; }
    async function confirmDeleteRfp() {
      if (!rfpDelConfirm.value) return;
      try {
        await dataStore.deleteRfpItem(rfpDelConfirm.value.id);
        rfpDelConfirm.value = null;
        await loadRfp();
      } catch (e) { /* toast 已显示 */ }
    }

    function responseTagType(t) { return RFP_RESPONSE_TAG_TYPES[t] || 'default'; }
    function rfpStatusTagType(s) { return RFP_STATUS_TAG_TYPES[s] || 'default'; }
    function evidenceLabel(t) { return RFP_EVIDENCE_LABELS[t] || t; }

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
      rfpVisible, rfpBid, rfpItems, rfpLoading, rfpStats, rfpProgress, rfpColumns,
      rfpFormVisible, rfpEditing, rfpForm, rfpEvidence, rfpDraft, rfpDelConfirm,
      RFP_RESPONSE_OPTIONS, RFP_RESPONSE_LABELS, RFP_STATUS_LABELS, RFP_STATUS_OPTIONS, RFP_EVIDENCE_OPTIONS,
      openRfp, loadRfp, openRfpCreate, openRfpEdit, closeRfpForm, submitRfp,
      addRfpEvidence, removeRfpEvidence, rfpStatusOptionsFor, onRfpStatusChange,
      requestDeleteRfp, cancelDeleteRfp, confirmDeleteRfp,
      responseTagType, rfpStatusTagType, evidenceLabel,
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
                <button class="htp-btn htp-btn--text htp-btn--sm" @click="openRfp(item)">RFP 应答</button>
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
              <HtpInput type="date"  v-model="form.deadline"  />
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

      <!-- S2-5 RFP 条目级应答抽屉 -->
      <htp-drawer
        v-model="rfpVisible"
        :title="rfpBid ? 'RFP 逐条应答 · ' + rfpBid.bidNo : 'RFP 逐条应答'"
        width="1080px"
      >
        <div v-if="rfpBid" class="rfp">
          <div class="rfp__summary">
            <div class="rfp__summary-main">
              <div class="rfp__progress">
                <div class="rfp__progress-bar">
                  <div class="rfp__progress-fill" :style="{ width: rfpProgress + '%' }"></div>
                </div>
                <span class="rfp__progress-text">{{ rfpProgress }}%</span>
              </div>
              <div class="rfp__meta">
                <span v-if="rfpStats">
                  共 {{ rfpStats.total }} 条 · 已完成 {{ rfpStats.byStatus ? rfpStats.byStatus.done : 0 }} · 待应答 {{ rfpStats.pendingCount }} · 证据 {{ rfpStats.evidenceCount }}
                </span>
                <span v-else>统计加载中...</span>
              </div>
            </div>
            <button class="htp-btn htp-btn--primary htp-btn--sm" @click="openRfpCreate">+ 新增条目</button>
          </div>

          <htp-table
            :columns="rfpColumns"
            :rows="rfpItems"
            :loading="rfpLoading"
            emptyText="暂无 RFP 条目，点击「新增条目」开始逐条应答"
          >
            <template #code="{ row }">
              <span class="rfp__code">{{ row.code || '-' }}</span>
            </template>
            <template #title="{ row }">
              <div class="rfp__title">{{ row.title }}</div>
              <div v-if="row.requirement" class="rfp__req">{{ row.requirement }}</div>
            </template>
            <template #response="{ row }">
              <div class="rfp__resp">{{ row.response || '-' }}</div>
              <div v-if="row.owner" class="rfp__owner">负责人：{{ row.owner }}</div>
            </template>
            <template #responseType="{ row }">
              <htp-tag :type="responseTagType(row.responseType)">{{ RFP_RESPONSE_LABELS[row.responseType] || row.responseType }}</htp-tag>
            </template>
            <template #status="{ row }">
              <htp-select
                :model-value="row.status"
                :options="rfpStatusOptionsFor(row)"
                @change="(v) => onRfpStatusChange(row, v)"
              ></htp-select>
            </template>
            <template #evidence="{ row }">
              <div v-if="!row.evidence || row.evidence.length === 0" class="rfp__evidence-empty">未挂载</div>
              <ul v-else class="rfp__evidence">
                <li v-for="(ev, idx) in row.evidence" :key="idx" class="rfp__evidence-item">
                  <htp-tag type="info">{{ evidenceLabel(ev.sourceType) }}</htp-tag>
                  <span class="rfp__evidence-id">{{ ev.sourceId }}</span>
                  <span v-if="ev.label" class="rfp__evidence-label">{{ ev.label }}</span>
                </li>
              </ul>
            </template>
            <template #actions="{ row }">
              <div class="rfp__actions">
                <button class="htp-btn htp-btn--text htp-btn--primary htp-btn--sm" @click="openRfpEdit(row)">编辑</button>
                <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="requestDeleteRfp(row)">删除</button>
              </div>
            </template>
          </htp-table>
        </div>
      </htp-drawer>

      <htp-modal
        :visible="rfpFormVisible"
        :title="rfpEditing ? '编辑 RFP 条目' : '新增 RFP 条目'"
        width="720px"
        confirmText="保存"
        @cancel="closeRfpForm"
        @confirm="submitRfp"
      >
        <div class="form-grid">
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">条目编号</label>
              <htp-input v-model="rfpForm.code" placeholder="例如：3.2.1（可选）" maxlength="50"></htp-input>
            </div>
            <div class="form-item">
              <label class="form-item__label">排序</label>
              <htp-input v-model="rfpForm.sortOrder" type="number" min="0" step="1"></htp-input>
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label"><span class="text-danger">*</span> 条目标题</label>
            <htp-input v-model="rfpForm.title" placeholder="例如：等保三级资质要求" maxlength="200"></htp-input>
          </div>
          <div class="form-item">
            <label class="form-item__label">RFP 原文要求</label>
            <textarea v-model="rfpForm.requirement" class="rfp__textarea" rows="3" placeholder="粘贴招标方原文要求（可选）"></textarea>
          </div>
          <div class="form-item">
            <label class="form-item__label">应答内容</label>
            <textarea v-model="rfpForm.response" class="rfp__textarea" rows="4" placeholder="填写我方应答口径（可选）"></textarea>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">应答类型</label>
              <htp-select v-model="rfpForm.responseType" :options="RFP_RESPONSE_OPTIONS"></htp-select>
            </div>
            <div class="form-item">
              <label class="form-item__label">应答进度</label>
              <htp-select v-model="rfpForm.status" :options="RFP_STATUS_OPTIONS"></htp-select>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">负责人</label>
              <htp-input v-model="rfpForm.owner" placeholder="可选" maxlength="50"></htp-input>
            </div>
            <div class="form-item">
              <label class="form-item__label">备注</label>
              <htp-input v-model="rfpForm.remark" placeholder="可选" maxlength="200"></htp-input>
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">证据挂载（通用软关联，仅存来源 ID）</label>
            <div class="rfp__evidence-form">
              <htp-select v-model="rfpDraft.sourceType" :options="RFP_EVIDENCE_OPTIONS"></htp-select>
              <htp-input v-model="rfpDraft.sourceId" placeholder="来源记录 ID" maxlength="100"></htp-input>
              <htp-input v-model="rfpDraft.label" placeholder="证据说明（可选）" maxlength="200"></htp-input>
              <button class="htp-btn htp-btn--sm" @click="addRfpEvidence">添加</button>
            </div>
            <ul v-if="rfpEvidence.length" class="rfp__evidence rfp__evidence--edit">
              <li v-for="(ev, idx) in rfpEvidence" :key="idx" class="rfp__evidence-item">
                <htp-tag type="info">{{ evidenceLabel(ev.sourceType) }}</htp-tag>
                <span class="rfp__evidence-id">{{ ev.sourceId }}</span>
                <span v-if="ev.label" class="rfp__evidence-label">{{ ev.label }}</span>
                <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="removeRfpEvidence(idx)">移除</button>
              </li>
            </ul>
            <div v-else class="text-sm text-tertiary mt-xs">暂无证据。可引用 Vault / POC / 漏洞 / 会议 / 笔记 / 合同 / 交付记录作为佐证</div>
          </div>
        </div>
      </htp-modal>

      <htp-modal
        v-if="rfpDelConfirm"
        :visible="!!rfpDelConfirm"
        title="确认删除 RFP 条目？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDeleteRfp"
        @confirm="confirmDeleteRfp"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下条目吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">{{ rfpDelConfirm.title }}</div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.BidPage = BidPage;

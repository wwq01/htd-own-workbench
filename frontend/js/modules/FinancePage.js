/**
 * FinancePage - 财务速记（收支记录 + 合同回款）
 * 标签：收支记录 / 合同回款
 */
const FINANCE_TYPE_OPTIONS = [
  { label: '收入', value: 'INCOME' },
  { label: '支出', value: 'EXPENSE' },
];
const FINANCE_CATEGORY_OPTIONS = [
  { label: '餐饮', value: 'FOOD' },
  { label: '居住', value: 'HOUSING' },
  { label: '交通', value: 'TRANSPORT' },
  { label: '工资', value: 'SALARY' },
  { label: '报销', value: 'REIMBURSEMENT' },
  { label: '其他', value: 'OTHER' },
];
const FINANCE_TYPE_LABEL = { INCOME: '收入', EXPENSE: '支出' };
const FINANCE_CATEGORY_LABEL = {
  FOOD: '餐饮', HOUSING: '居住', TRANSPORT: '交通',
  SALARY: '工资', REIMBURSEMENT: '报销', OTHER: '其他',
};
const AMOUNT_THRESHOLD = 50000;

const FinancePage = {
  name: 'FinancePage',
  setup() {
    const dataStore = useDataStore();
    // ============ 标签 ============
    const activeTab = Vue.ref('finance'); // finance / contract

    // ============ 收支记录 ============
    const currentMonth = () => htdDate.today().slice(0, 7); // YYYY-MM
    const financeMonth = Vue.ref(currentMonth());
    const summary = Vue.ref(null);
    const filterType = Vue.ref('');
    const filterCategory = Vue.ref('');
    const financeList = Vue.ref([]);
    const loadingFinance = Vue.ref(false);

    async function loadFinance() {
      loadingFinance.value = true;
      try {
        const params = { month: financeMonth.value };
        if (filterType.value) params.type = filterType.value;
        if (filterCategory.value) params.category = filterCategory.value;
        const raw = await htdApi.get('/finances', params);
        financeList.value = Array.isArray(raw) ? raw : [];
      } catch (e) {
        financeList.value = [];
      } finally {
        loadingFinance.value = false;
      }
    }
    async function loadSummary() {
      try {
        summary.value = await htdApi.get('/finances/summary', { month: financeMonth.value });
      } catch (e) {
        summary.value = null;
      }
    }

    // ============ 合同回款 ============
    const contractList = Vue.ref([]);
    const loadingContract = Vue.ref(false);
    const expanded = Vue.reactive({}); // contractId -> bool
    const nodeInputs = Vue.reactive({}); // `${contractId}-${idx}` -> 输入值
    const nodeSaving = Vue.reactive({}); // `${contractId}-${idx}` -> bool

    async function loadContracts() {
      loadingContract.value = true;
      try {
        const raw = await htdApi.get('/finance-contracts', {});
        contractList.value = Array.isArray(raw) ? raw : [];
      } catch (e) {
        contractList.value = [];
      } finally {
        loadingContract.value = false;
      }
    }

    // ============ 图表数据（V1.5 §8.1 财务统计页） ============
    const charts = Vue.ref(null);
    async function loadCharts() {
      try {
        charts.value = await dataStore.fetchCharts();
      } catch (e) {
        console.error(e);
      }
    }

    // ============ 统一加载 ============
    function loadList() {
      if (activeTab.value === 'finance') {
        loadFinance();
        loadSummary();
      } else {
        loadContracts();
      }
    }
    Vue.watch([activeTab, financeMonth, filterType, filterCategory], loadList);
    Vue.onMounted(() => { loadList(); loadCharts(); });

    // ============ 收支记录：新增/编辑 ============
    const formModalVisible = Vue.ref(false);
    const editingFinance = Vue.ref(null);
    const formTitle = Vue.computed(() => (editingFinance.value ? '编辑收支' : '新增收支'));
    const form = Vue.reactive({
      date: htdDate.today(),
      type: 'INCOME',
      amount: '',
      category: 'FOOD',
      subCategory: '',
      tags: '',
      remark: '',
    });
    const confirmed = Vue.ref(false);
    const amountLarge = Vue.computed(() => Number(form.amount) >= AMOUNT_THRESHOLD);

    function openCreateFinance() {
      editingFinance.value = null;
      confirmed.value = false;
      Object.assign(form, {
        date: htdDate.today(),
        type: 'INCOME',
        amount: '',
        category: 'FOOD',
        subCategory: '',
        tags: '',
        remark: '',
      });
      formModalVisible.value = true;
    }
    function openEditFinance(item) {
      editingFinance.value = item;
      confirmed.value = true; // 编辑旧数据视为已确认
      Object.assign(form, {
        date: (item.date || htdDate.today()).slice(0, 10),
        type: item.type,
        amount: item.amount,
        category: item.category,
        subCategory: item.subCategory || '',
        tags: parseTags(item.tags).join(','),
        remark: item.remark || '',
      });
      formModalVisible.value = true;
    }
    function closeForm() {
      formModalVisible.value = false;
    }
    async function submitFinance() {
      const amount = Number(form.amount);
      if (!form.date) { showToast('请选择日期', 'warning'); return; }
      if (!(amount > 0)) { showToast('金额必须为正数', 'warning'); return; }
      if (amountLarge.value && !confirmed.value) { showToast('金额较大，请先勾选确认', 'warning'); return; }
      const payload = {
        date: form.date,
        type: form.type,
        amount,
        category: form.category,
        subCategory: form.subCategory || null,
        tags: (form.tags || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        remark: form.remark || null,
      };
      try {
        if (editingFinance.value) {
          await dataStore.updateFinance(editingFinance.value.id, payload);
          showToast('更新成功', 'success');
        } else {
          await dataStore.createFinance(payload);
          showToast('创建成功', 'success');
        }
        formModalVisible.value = false;
        loadFinance();
        loadSummary();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 收支记录：删除 ============
    const delConfirm = Vue.ref(null);
    function requestDeleteFinance(item) { delConfirm.value = item; }
    function cancelDeleteFinance() { delConfirm.value = null; }
    async function confirmDeleteFinance() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteFinance(delConfirm.value.id);
        delConfirm.value = null;
        showToast('删除成功', 'success');
        loadFinance();
        loadSummary();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 合同回款：新增/编辑 ============
    const contractModalVisible = Vue.ref(false);
    const editingContract = Vue.ref(null);
    const contractFormTitle = Vue.computed(() => (editingContract.value ? '编辑合同' : '新增合同'));
    const contractForm = Vue.reactive({
      contractNo: '',
      contractAmount: '',
      clientName: '',
      remark: '',
    });

    function openCreateContract() {
      editingContract.value = null;
      Object.assign(contractForm, { contractNo: '', contractAmount: '', clientName: '', remark: '' });
      contractModalVisible.value = true;
    }
    function openEditContract(item) {
      editingContract.value = item;
      Object.assign(contractForm, {
        contractNo: item.contractNo,
        contractAmount: item.contractAmount,
        clientName: item.clientName || '',
        remark: item.remark || '',
      });
      contractModalVisible.value = true;
    }
    function closeContractForm() { contractModalVisible.value = false; }
    async function submitContract() {
      const amount = Number(contractForm.contractAmount);
      if (!contractForm.contractNo.trim()) { showToast('请输入合同编号', 'warning'); return; }
      if (!(amount > 0)) { showToast('合同金额必须为正数', 'warning'); return; }
      const payload = {
        contractNo: contractForm.contractNo.trim(),
        contractAmount: amount,
        clientName: contractForm.clientName || null,
        remark: contractForm.remark || null,
      };
      try {
        if (editingContract.value) {
          await dataStore.updateFinanceContract(editingContract.value.id, payload);
          showToast('更新成功', 'success');
        } else {
          await dataStore.createFinanceContract(payload);
          showToast('创建成功', 'success');
        }
        contractModalVisible.value = false;
        loadContracts();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 合同回款：节点展开 / 更新回款 ============
    function toggleExpand(contract) {
      const key = contract.id;
      expanded[key] = !expanded[key];
      if (expanded[key]) {
        const nodes = parseNodes(contract.nodes);
        nodes.forEach((n, idx) => {
          const k = `${contract.id}-${idx}`;
          if (nodeInputs[k] === undefined) nodeInputs[k] = n.receivedAmount;
        });
      }
    }
    async function updateNode(contract, idx, node) {
      const key = `${contract.id}-${idx}`;
      const val = Number(nodeInputs[key]);
      if (!(val >= 0)) { showToast('已回款金额不能为负数', 'warning'); return; }
      nodeSaving[key] = true;
      try {
        await dataStore.updateContractNode(contract.id, idx, {
          receivedAmount: val,
          receivedAt: htdDate.today(),
        });
        showToast('回款已更新', 'success');
        await loadContracts();
        if (expanded[contract.id]) {
          const refreshed = contractList.value.find((c) => c.id === contract.id);
          const nodes = refreshed ? parseNodes(refreshed.nodes) : [];
          nodes.forEach((n, i) => { nodeInputs[`${contract.id}-${i}`] = n.receivedAmount; });
        }
      } catch (e) { /* toast 已显示 */ }
      finally {
        nodeSaving[key] = false;
      }
    }

    // ============ 合同回款：删除 ============
    const delContractConfirm = Vue.ref(null);
    function requestDeleteContract(item) { delContractConfirm.value = item; }
    function cancelDeleteContract() { delContractConfirm.value = null; }
    async function confirmDeleteContract() {
      if (!delContractConfirm.value) return;
      try {
        await dataStore.deleteFinanceContract(delContractConfirm.value.id);
        delContractConfirm.value = null;
        showToast('删除成功', 'success');
        loadContracts();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 工具 ============
    function parseTags(tags) {
      if (!tags) return [];
      try {
        const arr = typeof tags === 'string' ? JSON.parse(tags) : tags;
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    }
    function parseNodes(nodes) {
      if (!nodes) return [];
      try {
        const arr = typeof nodes === 'string' ? JSON.parse(nodes) : nodes;
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    }
    function formatAmount(n) {
      const v = Number(n);
      return Number.isFinite(v) ? v.toFixed(2) : '0.00';
    }
    function formatDateOnly(d) {
      if (!d) return '';
      return String(d).slice(0, 10);
    }
    function typeArrow(t) {
      return t === 'INCOME' ? '↑' : '↓';
    }
    function contractProgress(contract) {
      const amt = Number(contract.contractAmount) || 0;
      if (amt <= 0) return 0;
      const pct = (Number(contract.totalReceived) / amt) * 100;
      return Math.min(100, Math.round(pct));
    }
    function isOverdue(node) {
      if (!node.dueDate) return false;
      const today = htdDate.today();
      return node.dueDate < today && Number(node.receivedAmount || 0) < Number(node.expectedAmount || 0);
    }

    // ============ 图表（S2-2a 已由 Htp*Chart 响应式组件渲染，此处不再拼 SVG）============

    return {
      // 标签
      activeTab,
      // 收支记录
      financeMonth, summary, filterType, filterCategory, financeList, loadingFinance,
      formModalVisible, editingFinance, formTitle, form, confirmed, amountLarge,
      delConfirm,
      FINANCE_TYPE_OPTIONS, FINANCE_CATEGORY_OPTIONS,
      loadSummary,
      openCreateFinance, openEditFinance, closeForm, submitFinance,
      requestDeleteFinance, cancelDeleteFinance, confirmDeleteFinance,
      // 合同回款
      contractList, loadingContract, expanded, nodeInputs, nodeSaving,
      contractModalVisible, editingContract, contractFormTitle, contractForm,
      delContractConfirm,
      openCreateContract, openEditContract, closeContractForm, submitContract,
      toggleExpand, updateNode,
      requestDeleteContract, cancelDeleteContract, confirmDeleteContract,
      // 工具
      parseTags, parseNodes, formatAmount, formatDateOnly,
      typeArrow, contractProgress, isOverdue,
      FINANCE_TYPE_LABEL, FINANCE_CATEGORY_LABEL,
      // 图表（S2-2a Htp*Chart 组件消费）
      charts,
    };
  },
  template: `
    <div class="list-page finance-page">
      <!-- 标签页 -->
      <div class="htp-tabs">
        <button class="htp-tab" :class="{ 'htp-tab--active': activeTab === 'finance' }" @click="activeTab = 'finance'">收支记录</button>
        <button class="htp-tab" :class="{ 'htp-tab--active': activeTab === 'contract' }" @click="activeTab = 'contract'">合同回款</button>
      </div>

      <!-- ================= 收支记录 ================= -->
      <div v-if="activeTab === 'finance'">
        <!-- 月度汇总卡片 -->
        <div class="finance-summary">
          <div class="finance-summary__card">
            <div class="finance-summary__label">收入</div>
            <div class="finance-summary__value text-success">¥ {{ summary ? formatAmount(summary.income) : '0.00' }}</div>
          </div>
          <div class="finance-summary__card">
            <div class="finance-summary__label">支出</div>
            <div class="finance-summary__value text-danger">¥ {{ summary ? formatAmount(summary.expense) : '0.00' }}</div>
          </div>
          <div class="finance-summary__card">
            <div class="finance-summary__label">净流入</div>
            <div
              class="finance-summary__value"
              :class="summary && summary.net >= 0 ? 'text-success' : 'text-danger'"
            >¥ {{ summary ? formatAmount(summary.net) : '0.00' }}</div>
          </div>
          <div class="finance-summary__month">
            <label class="text-sm text-tertiary">统计月份</label>
            <HtpInput type="month"  v-model="financeMonth"  />
          </div>
        </div>

        <!-- ============ 图表区（V1.5 §8.1 财务统计页，S2-2a 响应式组件） ============ -->
        <div v-if="charts && charts.finance" class="htd-chart-grid">
          <div class="htd-chart-card">
            <div class="htd-chart-card__title">
              <span v-html="htdIcon('barChart', { size: 16 })" style="margin-right:6px;display:inline-flex;vertical-align:-3px"></span> 月度收支趋势
            </div>
            <div class="text-sm text-tertiary">收入</div>
            <HtpBarChart :data="charts.finance.monthlyIncomeExpense.map(d => ({ label: d.label, value: d.income }))" :height="170" color="var(--chart-series-3)" />
            <div class="text-sm text-tertiary">支出</div>
            <HtpBarChart :data="charts.finance.monthlyIncomeExpense.map(d => ({ label: d.label, value: d.expense }))" :height="170" color="var(--chart-series-6)" />
          </div>

          <div class="htd-chart-card">
            <div class="htd-chart-card__title">
              <span v-html="htdIcon('pieChart', { size: 16 })" style="margin-right:6px;display:inline-flex;vertical-align:-3px"></span> 分类支出占比
            </div>
            <div class="htd-chart-card__body">
              <HtpDonutChart :data="charts.finance.categoryPie" :width="200" :height="200" />
              <HtpChartLegend :items="charts.finance.categoryPie.map(c => ({ label: c.label, color: c.color }))" />
            </div>
          </div>

          <div class="htd-chart-card">
            <div class="htd-chart-card__title">
              <span v-html="htdIcon('barChart', { size: 16 })" style="margin-right:6px;display:inline-flex;vertical-align:-3px"></span> 合同回款进度（已回款）
            </div>
            <HtpBarChart :data="charts.finance.contractProgress.map(c => ({ label: c.label, value: c.received }))" :height="170" color="var(--chart-series-1)" />
          </div>

          <div class="htd-chart-card">
            <div class="htd-chart-card__title">月度净收支趋势（收入 − 支出）</div>
            <HtpLineChart :data="charts.finance.monthlyIncomeExpense.map(d => ({ label: d.label, value: d.income - d.expense }))" :height="170" color="var(--chart-series-5)" />
          </div>
        </div>

        <!-- 筛选栏 -->
        <div class="htp-filter-bar">
          <div class="htp-filter-bar__item">
            <htp-select v-model="filterType" :options="[{label:'全部类型',value:''}].concat(FINANCE_TYPE_OPTIONS)"></htp-select>
          </div>
          <div class="htp-filter-bar__item">
            <htp-select v-model="filterCategory" :options="[{label:'全部分类',value:''}].concat(FINANCE_CATEGORY_OPTIONS)"></htp-select>
          </div>
          <div style="margin-left:auto">
            <button class="htp-btn htp-btn--primary" @click="openCreateFinance">+ 新增收支</button>
          </div>
        </div>

        <!-- 列表 -->
        <div class="list-container">
          <div class="list-body">
            <div v-if="loadingFinance" class="text-center py-lg text-tertiary">加载中...</div>
            <div v-else-if="financeList.length === 0">
              <htp-empty text="暂无收支记录，点击「新增收支」开始记账"></htp-empty>
            </div>
            <ul v-else class="finance-list">
              <li v-for="item in financeList" :key="item.id" class="finance-list-item">
                <div class="finance-list-item__main">
                  <div class="finance-list-item__amount" :class="item.type === 'INCOME' ? 'text-success' : 'text-danger'">
                    {{ typeArrow(item.type) }} ¥{{ formatAmount(item.amount) }}
                  </div>
                  <div class="finance-list-item__meta">
                    <span>{{ formatDateOnly(item.date) }}</span>
                    <htp-tag :type="item.type === 'INCOME' ? 'success' : 'danger'">{{ FINANCE_TYPE_LABEL[item.type] }}</htp-tag>
                    <htp-tag type="info">{{ FINANCE_CATEGORY_LABEL[item.category] || item.category }}</htp-tag>
                    <htp-tag v-for="t in parseTags(item.tags)" :key="t" type="default">{{ t }}</htp-tag>
                  </div>
                  <div v-if="item.remark" class="finance-list-item__remark text-sm text-tertiary">{{ item.remark }}</div>
                </div>
                <div class="finance-list-item__actions">
                  <button class="htp-btn htp-btn--text htp-btn--primary htp-btn--sm" @click="openEditFinance(item)">编辑</button>
                  <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="requestDeleteFinance(item)">删除</button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- 新增/编辑收支弹窗 -->
        <htp-modal
          :visible="formModalVisible"
          :title="formTitle"
          width="540px"
          @cancel="closeForm"
        >
          <template #footer>
            <button class="htp-btn htp-btn--secondary" @click="closeForm">取消</button>
            <button
              class="htp-btn htp-btn--primary"
              :disabled="amountLarge && !confirmed"
              @click="submitFinance"
            >保存</button>
          </template>
          <div class="form-grid">
            <div class="form-row-2">
              <div class="form-item">
                <label class="form-item__label"><span class="text-danger">*</span> 日期</label>
                <HtpInput type="date"  v-model="form.date"  />
              </div>
              <div class="form-item">
                <label class="form-item__label"><span class="text-danger">*</span> 类型</label>
                <htp-select v-model="form.type" :options="FINANCE_TYPE_OPTIONS"></htp-select>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-item">
                <label class="form-item__label"><span class="text-danger">*</span> 金额</label>
                <htp-input v-model="form.amount" type="number" placeholder="0.00"></htp-input>
              </div>
              <div class="form-item">
                <label class="form-item__label"><span class="text-danger">*</span> 分类</label>
                <htp-select v-model="form.category" :options="FINANCE_CATEGORY_OPTIONS"></htp-select>
              </div>
            </div>
            <div class="form-item">
              <label class="form-item__label">子分类</label>
              <htp-input v-model="form.subCategory" placeholder="可选，如：午餐 / 房租"></htp-input>
            </div>
            <div class="form-item">
              <label class="form-item__label">标签</label>
              <htp-input v-model="form.tags" placeholder="多个标签用逗号分隔，如：差旅,项目A"></htp-input>
            </div>
            <div class="form-item">
              <label class="form-item__label">备注</label>
              <htp-textarea v-model="form.remark" :rows="3" placeholder="补充说明（可选）" maxlength="1000"></htp-textarea>
            </div>
            <div v-if="amountLarge" class="finance-amount-warn">
              <span class="text-danger">金额较大，请确认</span>
              <htp-checkbox v-model="confirmed" label="我已确认金额无误"></htp-checkbox>
            </div>
          </div>
        </htp-modal>

        <!-- 删除确认 -->
        <htp-modal
          v-if="delConfirm"
          :visible="!!delConfirm"
          title="确认删除收支记录？"
          confirmText="确认删除"
          confirmType="danger"
          @cancel="cancelDeleteFinance"
          @confirm="confirmDeleteFinance"
        >
          <div class="py-sm">
            <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除这条记录吗？</div>
            <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">
              {{ typeArrow(delConfirm.type) }} ¥{{ formatAmount(delConfirm.amount) }}
              （{{ formatDateOnly(delConfirm.date) }} · {{ FINANCE_CATEGORY_LABEL[delConfirm.category] }}）
            </div>
          </div>
        </htp-modal>
      </div>

      <!-- ================= 合同回款 ================= -->
      <div v-else>
        <div class="htp-filter-bar">
          <div style="margin-left:auto">
            <button class="htp-btn htp-btn--primary" @click="openCreateContract">+ 新增合同</button>
          </div>
        </div>

        <div class="list-container">
          <div class="list-body">
            <div v-if="loadingContract" class="text-center py-lg text-tertiary">加载中...</div>
            <div v-else-if="contractList.length === 0">
              <htp-empty text="暂无合同回款记录，点击「新增合同」开始登记"></htp-empty>
            </div>
            <ul v-else class="contract-list">
              <li v-for="contract in contractList" :key="contract.id" class="contract-card">
                <div class="contract-card__header" @click="toggleExpand(contract)">
                  <div class="contract-card__info">
                    <div class="contract-card__title">
                      <span class="font-medium">{{ contract.contractNo }}</span>
                      <span v-if="contract.clientName" class="text-tertiary text-sm ml-sm">{{ contract.clientName }}</span>
                    </div>
                    <div class="contract-card__meta text-sm text-tertiary">
                      <span>合同额 ¥{{ formatAmount(contract.contractAmount) }}</span>
                      <span class="ml-sm">已回款 ¥{{ formatAmount(contract.totalReceived) }}</span>
                      <span class="ml-sm">待回款 ¥{{ formatAmount(contract.totalPending) }}</span>
                    </div>
                    <div class="contract-progress mt-xs">
                      <div class="contract-progress__bar" :style="{ width: contractProgress(contract) + '%' }"></div>
                    </div>
                  </div>
                  <div class="contract-card__actions">
                    <button class="htp-btn htp-btn--text htp-btn--primary htp-btn--sm" @click.stop="openEditContract(contract)">编辑</button>
                    <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click.stop="requestDeleteContract(contract)">删除</button>
                    <span class="contract-card__toggle">{{ expanded[contract.id] ? '收起 ▲' : '展开 ▼' }}</span>
                  </div>
                </div>

                <div v-if="expanded[contract.id]" class="contract-card__nodes">
                  <div v-if="parseNodes(contract.nodes).length === 0" class="text-tertiary text-sm py-sm">暂无回款节点</div>
                  <div v-for="(node, idx) in parseNodes(contract.nodes)" :key="idx" class="contract-node">
                    <div class="contract-node__info">
                      <div class="contract-node__name">
                        {{ node.nodeName || ('节点 ' + (idx + 1)) }}
                        <status-dot v-if="isOverdue(node)" status="error" label="逾期"></status-dot>
                      </div>
                      <div class="contract-node__meta text-sm text-tertiary">
                        <span v-if="node.dueDate">应回款日 {{ formatDateOnly(node.dueDate) }}</span>
                        <span class="ml-sm">应收 ¥{{ formatAmount(node.expectedAmount) }}</span>
                        <span class="ml-sm">已收 ¥{{ formatAmount(node.receivedAmount) }}</span>
                        <span v-if="node.receivedAt" class="ml-sm">回款日 {{ formatDateOnly(node.receivedAt) }}</span>
                      </div>
                    </div>
                    <div class="contract-node__update">
                      <htp-input
                        v-model="nodeInputs[contract.id + '-' + idx]"
                        type="number"
                        placeholder="本次已回款"
                        class="contract-node__input"
                      ></htp-input>
                      <button
                        class="htp-btn htp-btn--secondary htp-btn--sm"
                        :disabled="nodeSaving[contract.id + '-' + idx]"
                        @click="updateNode(contract, idx, node)"
                      >更新已回款</button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- 新增/编辑合同弹窗 -->
        <htp-modal
          :visible="contractModalVisible"
          :title="contractFormTitle"
          width="520px"
          confirmText="保存"
          @cancel="closeContractForm"
          @confirm="submitContract"
        >
          <div class="form-grid">
            <div class="form-item">
              <label class="form-item__label"><span class="text-danger">*</span> 合同编号</label>
              <htp-input v-model="contractForm.contractNo" placeholder="如：HT-2026-001"></htp-input>
            </div>
            <div class="form-row-2">
              <div class="form-item">
                <label class="form-item__label"><span class="text-danger">*</span> 合同金额</label>
                <htp-input v-model="contractForm.contractAmount" type="number" placeholder="0.00"></htp-input>
              </div>
              <div class="form-item">
                <label class="form-item__label">客户名称</label>
                <htp-input v-model="contractForm.clientName" placeholder="可选"></htp-input>
              </div>
            </div>
            <div class="form-item">
              <label class="form-item__label">备注</label>
              <htp-textarea v-model="contractForm.remark" :rows="3" placeholder="补充说明（可选）" maxlength="1000"></htp-textarea>
            </div>
          </div>
        </htp-modal>

        <!-- 删除确认 -->
        <htp-modal
          v-if="delContractConfirm"
          :visible="!!delContractConfirm"
          title="确认删除合同回款记录？"
          confirmText="确认删除"
          confirmType="danger"
          @cancel="cancelDeleteContract"
          @confirm="confirmDeleteContract"
        >
          <div class="py-sm">
            <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下合同吗？</div>
            <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">
              {{ delContractConfirm.contractNo }}
              <span v-if="delContractConfirm.clientName" class="text-tertiary">（{{ delContractConfirm.clientName }}）</span>
            </div>
          </div>
        </htp-modal>
      </div>
    </div>
  `,
};

window.FinancePage = FinancePage;

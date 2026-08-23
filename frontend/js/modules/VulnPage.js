/**
 * VulnPage - 漏洞跟踪库（资产组隔离，§4.4.3）
 * 列表 + 新建/编辑表单 + 状态切换（5 态修复状态机）
 * 隔离维度 assetGroup：列表必带 ?assetGroup=（前端分组切换即切该参数）
 */
const VULN_GROUPS_KEY = 'htd-vuln-groups';
const VULN_FIX_STATUS_TRANSITIONS = {
  open: ['fixing', 'wont_fix', 'closed'],
  fixing: ['fixed', 'wont_fix', 'closed'],
  fixed: ['closed'],
  wont_fix: ['closed'],
  closed: [],
};
const VULN_FIX_STATUS_LABELS = {
  open: '待修复',
  fixing: '修复中',
  fixed: '已修复',
  wont_fix: '暂不修复',
  closed: '已关闭',
};
const VULN_FIX_STATUS_TAG_TYPES = {
  open: 'danger',
  fixing: 'warning',
  fixed: 'success',
  wont_fix: 'default',
  closed: 'info',
};
const VULN_FIX_STATUS_OPTIONS = Object.keys(VULN_FIX_STATUS_LABELS).map((k) => ({ label: VULN_FIX_STATUS_LABELS[k], value: k }));
const VULN_SEVERITY_LABELS = { low: '低', medium: '中', high: '高', critical: '严重' };
const VULN_SEVERITY_TAG_TYPES = { low: 'default', medium: 'info', high: 'warning', critical: 'danger' };
const VULN_SEVERITY_OPTIONS = Object.keys(VULN_SEVERITY_LABELS).map((k) => ({ label: VULN_SEVERITY_LABELS[k], value: k }));

const VulnPage = {
  name: 'VulnPage',
  setup() {
    const dataStore = useDataStore();

    const list = Vue.ref([]);
    const loading = Vue.ref(false);
    const currentGroup = Vue.ref('');
    const newGroupInput = Vue.ref('');
    const knownGroups = Vue.ref([]);

    function loadGroups() {
      try { knownGroups.value = JSON.parse(localStorage.getItem(VULN_GROUPS_KEY) || '[]'); }
      catch (e) { knownGroups.value = []; }
      if (knownGroups.value.length) currentGroup.value = knownGroups.value[0];
    }
    function persistGroups() {
      try { localStorage.setItem(VULN_GROUPS_KEY, JSON.stringify(knownGroups.value)); } catch (e) { /* ignore */ }
    }
    const groupOptions = Vue.computed(() => knownGroups.value.map((g) => ({ label: g, value: g })));
    const hasGroup = Vue.computed(() => currentGroup.value !== '');

    function onGroupChange(v) {
      if (v) { currentGroup.value = v; loadList(); }
    }
    function applyNewGroup() {
      const g = (newGroupInput.value || '').trim();
      if (!g) return;
      if (!knownGroups.value.includes(g)) knownGroups.value.push(g);
      persistGroups();
      currentGroup.value = g;
      newGroupInput.value = '';
      loadList();
    }

    async function loadList() {
      if (!currentGroup.value) { list.value = []; loading.value = false; return; }
      loading.value = true;
      try {
        const raw = await dataStore.fetchVulns({ assetGroup: currentGroup.value });
        list.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        console.error('加载漏洞列表失败:', e);
        list.value = [];
      } finally {
        loading.value = false;
      }
    }

    Vue.watch(currentGroup, loadList);
    Vue.onMounted(() => { loadGroups(); loadList(); });

    // ============ 新增 / 编辑 ============
    const formModalVisible = Vue.ref(false);
    const editing = Vue.ref(null);
    const formTitle = Vue.computed(() => (editing.value ? '编辑漏洞' : '新增漏洞'));
    const form = Vue.reactive({
      assetGroup: '',
      vulnId: '',
      affectedProduct: '',
      exploitMethod: '',
      reproduction: '',
      severity: 'medium',
      fixStatus: 'open',
    });

    function openCreate() {
      editing.value = null;
      Object.assign(form, {
        assetGroup: currentGroup.value,
        vulnId: '', affectedProduct: '', exploitMethod: '', reproduction: '',
        severity: 'medium', fixStatus: 'open',
      });
      formModalVisible.value = true;
    }
    function openEdit(item) {
      editing.value = item;
      Object.assign(form, {
        assetGroup: item.assetGroup || '',
        vulnId: item.vulnId || '',
        affectedProduct: item.affectedProduct || '',
        exploitMethod: item.exploitMethod || '',
        reproduction: item.reproduction || '',
        severity: item.severity || 'medium',
        fixStatus: item.fixStatus || 'open',
      });
      formModalVisible.value = true;
    }
    function closeForm() { formModalVisible.value = false; }

    async function submitForm() {
      const vulnId = (form.vulnId || '').trim();
      const assetGroup = (form.assetGroup || '').trim();
      if (!assetGroup) { showToast('资产组(assetGroup)不能为空', 'warning'); return; }
      if (!vulnId) { showToast('漏洞编号(vulnId)不能为空', 'warning'); return; }
      const payload = {
        assetGroup,
        vulnId,
        affectedProduct: form.affectedProduct || null,
        exploitMethod: form.exploitMethod || null,
        reproduction: form.reproduction || null,
        severity: form.severity,
        fixStatus: form.fixStatus,
      };
      try {
        if (editing.value) {
          await dataStore.updateVuln(editing.value.id, payload);
        } else {
          await dataStore.createVuln(payload);
          if (!knownGroups.value.includes(assetGroup)) knownGroups.value.push(assetGroup);
          persistGroups();
          currentGroup.value = assetGroup;
        }
        formModalVisible.value = false;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 状态切换 ============
    function statusOptionsFor(item) {
      const cur = item.fixStatus;
      const opts = [{ label: VULN_FIX_STATUS_LABELS[cur] + '（当前）', value: cur }];
      (VULN_FIX_STATUS_TRANSITIONS[cur] || []).forEach((s) => {
        opts.push({ label: VULN_FIX_STATUS_LABELS[s], value: s });
      });
      return opts;
    }
    async function onStatusChange(item, v) {
      if (!v || v === item.fixStatus) return;
      try {
        await dataStore.changeVulnStatus(item.id, v);
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }
    function fixStatusTagType(s) { return VULN_FIX_STATUS_TAG_TYPES[s] || 'default'; }
    function severityTagType(s) { return VULN_SEVERITY_TAG_TYPES[s] || 'default'; }

    // ============ 删除 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(item) { delConfirm.value = item; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteVuln(delConfirm.value.id);
        delConfirm.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    const openCount = Vue.computed(() =>
      list.value.filter((i) => ['open', 'fixing'].includes(i.fixStatus)).length);

    return {
      list, loading, currentGroup, newGroupInput, groupOptions, hasGroup,
      formModalVisible, editing, formTitle, form,
      delConfirm,
      VULN_FIX_STATUS_OPTIONS, VULN_FIX_STATUS_LABELS, VULN_SEVERITY_OPTIONS, VULN_SEVERITY_LABELS,
      loadList, onGroupChange, applyNewGroup, openCreate, openEdit, closeForm, submitForm,
      statusOptionsFor, onStatusChange, fixStatusTagType, severityTagType,
      requestDelete, cancelDelete, confirmDoDelete, openCount,
    };
  },
  template: `
    <div class="list-page vuln-page">
      <div class="htp-filter-bar">
        <div class="htp-filter-bar__item" style="min-width:200px">
          <htp-select
            :model-value="currentGroup"
            :options="groupOptions"
            placeholder="选择资产组"
            @change="onGroupChange"
          ></htp-select>
        </div>
        <div class="htp-filter-bar__item">
          <htp-input v-model="newGroupInput" placeholder="新建 / 切换资产组" @keyup.enter="applyNewGroup"></htp-input>
        </div>
        <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="applyNewGroup">确定</button>
        <div style="margin-left:auto">
          <button class="htp-btn htp-btn--primary" :disabled="!hasGroup" @click="openCreate">+ 新增漏洞</button>
        </div>
      </div>

      <div class="list-container">
        <div class="list-header">
          <div class="list-header__title">
            <span v-html="htdIcon('warning', { size: 20 })" style="margin-right:8px;display:inline-flex;vertical-align:-4px"></span>
            漏洞跟踪库
            <span v-if="hasGroup" class="text-sm text-tertiary ml-sm">· {{ currentGroup }}</span>
          </div>
          <div class="list-header__meta">
            <span class="text-sm mr-md">共 {{ list.length }} 条</span>
            <htp-tag type="danger">待处理 {{ openCount }}</htp-tag>
          </div>
        </div>

        <div class="list-body">
          <div v-if="loading" class="text-center py-lg text-tertiary">加载中...</div>
          <div v-else-if="!hasGroup">
            <htp-empty text="请先选择或新建一个资产组，再查看对应漏洞"></htp-empty>
          </div>
          <div v-else-if="list.length === 0">
            <htp-empty text="该资产组暂无漏洞记录，点击「新增漏洞」开始登记"></htp-empty>
          </div>
          <ul v-else class="todo-list">
            <li v-for="item in list" :key="item.id" class="todo-list-item">
              <div class="flex-1 min-w-0">
                <div class="flex items-center flex-wrap gap-xs">
                  <htp-tag :type="severityTagType(item.severity)">{{ VULN_SEVERITY_LABELS[item.severity] || item.severity }}</htp-tag>
                  <htp-tag :type="fixStatusTagType(item.fixStatus)">{{ VULN_FIX_STATUS_LABELS[item.fixStatus] || item.fixStatus }}</htp-tag>
                  <span class="text-primary font-medium">{{ item.vulnId }}</span>
                </div>
                <div class="text-sm text-tertiary mt-xs flex items-center flex-wrap gap-sm">
                  <span v-if="item.affectedProduct">影响：{{ item.affectedProduct }}</span>
                  <span v-if="item.exploitMethod">利用：{{ item.exploitMethod }}</span>
                  <span v-if="item.reproduction">复现：{{ item.reproduction }}</span>
                </div>
              </div>
              <div class="ml-sm flex items-center gap-xs">
                <htp-select
                  :model-value="item.fixStatus"
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
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label"><span class="text-danger">*</span> 资产组 (assetGroup)</label>
              <htp-input v-model="form.assetGroup" placeholder="隔离维度，例如：DMZ / 内网" maxlength="60"></htp-input>
            </div>
            <div class="form-item">
              <label class="form-item__label"><span class="text-danger">*</span> 漏洞编号 (vulnId)</label>
              <htp-input v-model="form.vulnId" placeholder="例如：CVE-2024-1234" maxlength="80"></htp-input>
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">影响产品 (affectedProduct)</label>
            <htp-input v-model="form.affectedProduct" placeholder="例如：Apache 2.4（可选）" maxlength="120"></htp-input>
          </div>
          <div class="form-item">
            <label class="form-item__label">利用方式 (exploitMethod)</label>
            <htp-textarea v-model="form.exploitMethod" :rows="2" placeholder="利用方法简述（可选）" maxlength="1000"></htp-textarea>
          </div>
          <div class="form-item">
            <label class="form-item__label">复现步骤 (reproduction)</label>
            <htp-textarea v-model="form.reproduction" :rows="2" placeholder="复现步骤（可选）" maxlength="1000"></htp-textarea>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">严重级别</label>
              <htp-select v-model="form.severity" :options="VULN_SEVERITY_OPTIONS"></htp-select>
            </div>
            <div class="form-item">
              <label class="form-item__label">修复状态</label>
              <htp-select v-model="form.fixStatus" :options="VULN_FIX_STATUS_OPTIONS"></htp-select>
            </div>
          </div>
        </div>
      </htp-modal>

      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除漏洞？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDelete"
        @confirm="confirmDoDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下漏洞吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">{{ delConfirm.vulnId }}</div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.VulnPage = VulnPage;

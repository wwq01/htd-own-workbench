/**
 * ReadingPage - 阅读 / 资料模块（V1.5 §8.4）
 * 列表 + 筛选（类型 / 状态 / 标签 / 关键词）+ 新建 / 编辑 + 阅读 4 态状态机切换
 * + 一键转 Vault 沉淀 + 删除 + 自定义扩展字段（key-value 编辑器）
 * 遵循 VulnPage 范式：SVG 语义图标（htdIcon）、禁 emoji、禁紫粉渐变。
 */
const READING_TYPE = { ARTICLE: '文章', WECHAT: '公众号', CVE: 'CVE', PAPER: '论文' };
const READING_STATUS = { UNREAD: 'unread', READING: 'reading', PRECIPITATED: 'precipitated', ARCHIVED: 'archived' };
const READING_STATUS_LABELS = { unread: '未读', reading: '在读', precipitated: '已沉淀', archived: '已归档' };
const READING_STATUS_TAG_TYPES = { unread: 'default', reading: 'info', precipitated: 'success', archived: 'warning' };
const READING_TYPE_TAG_TYPES = { '文章': 'default', '公众号': 'info', 'CVE': 'danger', '论文': 'warning' };
// 阅读 4 态状态机（与后端 READING_STATUS_TRANSITIONS 保持一致）
const READING_STATUS_TRANSITIONS = {
  unread: ['reading', 'archived'],
  reading: ['precipitated', 'archived', 'unread'],
  precipitated: ['archived', 'reading'],
  archived: ['unread'],
};

const READING_TYPE_OPTIONS = Object.values(READING_TYPE).map((v) => ({ label: v, value: v }));
const READING_STATUS_OPTIONS = Object.values(READING_STATUS).map((v) => ({ label: READING_STATUS_LABELS[v], value: v }));

const ReadingPage = {
  name: 'ReadingPage',
  setup() {
    const dataStore = useDataStore();

    const list = Vue.ref([]);
    const loading = Vue.ref(false);

    // 筛选条件
    const filterType = Vue.ref('');
    const filterStatus = Vue.ref('');
    const filterTag = Vue.ref('');
    const filterKeyword = Vue.ref('');

    // §8.3：下拉项优先取配置平台的值；未配置或拉取失败时回落到模块默认常量，
    // 保证「设置里新增的类型 / 状态」能立刻出现在筛选与表单里。
    const cfgTypeValues = Vue.computed(() => {
      const fc = dataStore.fieldConfig;
      const v = (fc && fc.dropdowns) ? fc.dropdowns['reading.type'] : null;
      return (Array.isArray(v) && v.length) ? v : Object.values(READING_TYPE);
    });
    const cfgStatusValues = Vue.computed(() => {
      const fc = dataStore.fieldConfig;
      const sm = (fc && fc.stateMachines) ? fc.stateMachines['reading.status'] : null;
      const v = (sm && sm.states) ? sm.states : null;
      return (Array.isArray(v) && v.length) ? v : Object.values(READING_STATUS);
    });
    const cfgStatusLabels = Vue.computed(() => {
      const out = {};
      cfgStatusValues.value.forEach((s) => { out[s] = READING_STATUS_LABELS[s] || s; });
      return out;
    });

    const formTypeOptions = Vue.computed(() => cfgTypeValues.value.map((v) => ({ label: v, value: v })));
    const formStatusOptions = Vue.computed(() =>
      cfgStatusValues.value.map((v) => ({ label: cfgStatusLabels.value[v], value: v })));

    const typeOptions = Vue.computed(() => [{ label: '全部类型', value: '' }].concat(formTypeOptions.value));
    const statusOptions = Vue.computed(() => [{ label: '全部状态', value: '' }].concat(formStatusOptions.value));

    async function loadList() {
      loading.value = true;
      try {
        const query = {};
        if (filterType.value) query.type = filterType.value;
        if (filterStatus.value) query.readingStatus = filterStatus.value;
        if (filterTag.value.trim()) query.tags = filterTag.value.trim();
        if (filterKeyword.value.trim()) query.q = filterKeyword.value.trim();
        const raw = await dataStore.fetchReadings(query);
        list.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        console.error('加载阅读资料失败:', e);
        list.value = [];
      } finally {
        loading.value = false;
      }
    }

    Vue.onMounted(() => {
      loadList();
      dataStore.fetchFieldConfig();
    });

    // ============ 状态标签辅助 ============
    function statusLabel(s) { return READING_STATUS_LABELS[s] || s; }
    function statusTagType(s) { return READING_STATUS_TAG_TYPES[s] || 'default'; }
    function typeTagType(t) { return READING_TYPE_TAG_TYPES[t] || 'default'; }
    function hasCustomFields(item) {
      const cf = item.customFields;
      return cf && typeof cf === 'object' && Object.keys(cf).length > 0;
    }

    // ============ 状态切换 ============
    function statusOptionsFor(item) {
      const cur = item.readingStatus;
      const opts = [{ label: statusLabel(cur) + '（当前）', value: cur }];
      (READING_STATUS_TRANSITIONS[cur] || []).forEach((s) => {
        opts.push({ label: statusLabel(s), value: s });
      });
      return opts;
    }
    async function onStatusChange(item, v) {
      if (!v || v === item.readingStatus) return;
      try {
        await dataStore.changeReadingStatus(item.id, v);
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 新增 / 编辑 ============
    const formModalVisible = Vue.ref(false);
    const editing = Vue.ref(null);
    const formTitle = Vue.computed(() => (editing.value ? '编辑阅读资料' : '新增阅读资料'));
    const form = Vue.reactive({
      title: '',
      sourceUrl: '',
      type: READING_TYPE.ARTICLE,
      readingStatus: READING_STATUS.UNREAD,
      tags: '',
      notes: '',
      customFields: [], // [{ key, value }]
    });

    function resetForm() {
      Object.assign(form, {
        title: '', sourceUrl: '', type: READING_TYPE.ARTICLE, readingStatus: READING_STATUS.UNREAD,
        tags: '', notes: '', customFields: [],
      });
    }
    function openCreate() {
      editing.value = null;
      resetForm();
      formModalVisible.value = true;
    }
    function openEdit(item) {
      editing.value = item;
      const cf = item.customFields && typeof item.customFields === 'object' ? item.customFields : {};
      const cfRows = Object.keys(cf).map((k) => ({ key: k, value: cf[k] == null ? '' : String(cf[k]) }));
      Object.assign(form, {
        title: item.title || '',
        sourceUrl: item.sourceUrl || '',
        type: item.type || READING_TYPE.ARTICLE,
        readingStatus: item.readingStatus || READING_STATUS.UNREAD,
        tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
        notes: item.notes || '',
        customFields: cfRows,
      });
      formModalVisible.value = true;
    }
    function closeForm() { formModalVisible.value = false; }

    function addCustomField() { form.customFields.push({ key: '', value: '' }); }
    function removeCustomField(i) { form.customFields.splice(i, 1); }

    function buildCustomFields() {
      const obj = {};
      form.customFields.forEach((row) => {
        const k = (row.key || '').trim();
        if (k) obj[k] = row.value;
      });
      return obj;
    }

    async function submitForm() {
      const title = (form.title || '').trim();
      if (!title) { showToast('标题不能为空', 'warning'); return; }
      const tags = (form.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
      const payload = {
        title,
        sourceUrl: (form.sourceUrl || '').trim() || null,
        type: form.type,
        readingStatus: form.readingStatus,
        tags,
        notes: (form.notes || '').trim() || null,
        customFields: buildCustomFields(),
      };
      try {
        if (editing.value) {
          await dataStore.updateReading(editing.value.id, payload);
        } else {
          await dataStore.createReading(payload);
        }
        formModalVisible.value = false;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 转 Vault 沉淀 ============
    async function onConvert(item) {
      try {
        await dataStore.convertReadingToVault(item.id);
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 删除 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(item) { delConfirm.value = item; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteReading(delConfirm.value.id);
        delConfirm.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    const unreadCount = Vue.computed(() =>
      list.value.filter((i) => i.readingStatus === READING_STATUS.UNREAD).length);
    const precipitatedCount = Vue.computed(() =>
      list.value.filter((i) => i.readingStatus === READING_STATUS.PRECIPITATED).length);

    return {
      list, loading,
      filterType, filterStatus, filterTag, filterKeyword,
      typeOptions, statusOptions, formTypeOptions, formStatusOptions,
      formModalVisible, editing, formTitle, form,
      delConfirm,
      READING_TYPE_OPTIONS, READING_STATUS_OPTIONS, READING_STATUS_LABELS,
      loadList, statusLabel, statusTagType, typeTagType, hasCustomFields,
      statusOptionsFor, onStatusChange,
      openCreate, openEdit, closeForm, submitForm,
      addCustomField, removeCustomField,
      onConvert,
      requestDelete, cancelDelete, confirmDoDelete,
      unreadCount, precipitatedCount,
    };
  },
  template: `
    <div class="list-page reading-page">
      <div class="htp-filter-bar">
        <div class="htp-filter-bar__item" style="min-width:150px">
          <htp-select :model-value="filterType" :options="typeOptions" placeholder="类型" @change="(v) => { filterType = v; loadList(); }"></htp-select>
        </div>
        <div class="htp-filter-bar__item" style="min-width:150px">
          <htp-select :model-value="filterStatus" :options="statusOptions" placeholder="状态" @change="(v) => { filterStatus = v; loadList(); }"></htp-select>
        </div>
        <div class="htp-filter-bar__item">
          <htp-input v-model="filterTag" placeholder="标签筛选（如 AI）" @keyup.enter="loadList"></htp-input>
        </div>
        <div class="htp-filter-bar__item" style="flex:1;min-width:160px">
          <htp-input v-model="filterKeyword" placeholder="关键词搜索标题/笔记" @keyup.enter="loadList"></htp-input>
        </div>
        <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="loadList">查询</button>
        <div style="margin-left:auto">
          <button class="htp-btn htp-btn--primary" @click="openCreate">+ 新增阅读</button>
        </div>
      </div>

      <div class="list-container">
        <div class="list-header">
          <div class="list-header__title">
            <span v-html="htdIcon('book', { size: 20 })" style="margin-right:8px;display:inline-flex;vertical-align:-4px"></span>
            阅读资料库
          </div>
          <div class="list-header__meta">
            <span class="text-sm mr-md">共 {{ list.length }} 条</span>
            <htp-tag type="default">未读 {{ unreadCount }}</htp-tag>
            <htp-tag type="success">已沉淀 {{ precipitatedCount }}</htp-tag>
          </div>
        </div>

        <div class="list-body">
          <div v-if="loading" class="text-center py-lg text-tertiary">加载中...</div>
          <div v-else-if="list.length === 0">
            <htp-empty text="暂无阅读资料，点击「新增阅读」登记文章 / 公众号 / CVE / 论文"></htp-empty>
          </div>
          <ul v-else class="todo-list">
            <li v-for="item in list" :key="item.id" class="todo-list-item">
              <div class="flex-1 min-w-0">
                <div class="flex items-center flex-wrap gap-xs">
                  <htp-tag :type="typeTagType(item.type)">{{ item.type }}</htp-tag>
                  <htp-tag :type="statusTagType(item.readingStatus)">{{ statusLabel(item.readingStatus) }}</htp-tag>
                  <span class="text-primary font-medium">{{ item.title }}</span>
                </div>
                <div class="text-sm text-tertiary mt-xs flex items-center flex-wrap gap-sm">
                  <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener" class="text-link" @click.stop>来源链接</a>
                  <span v-for="t in (item.tags || [])" :key="t" class="tag-chip">{{ t }}</span>
                  <span v-if="hasCustomFields(item)" class="text-sm text-tertiary">· 扩展字段 {{ Object.keys(item.customFields).length }} 项</span>
                </div>
                <div v-if="item.notes" class="text-sm text-tertiary mt-xs line-clamp-2">{{ item.notes }}</div>
              </div>
              <div class="ml-sm flex items-center gap-xs flex-wrap">
                <htp-select
                  :model-value="item.readingStatus"
                  :options="statusOptionsFor(item)"
                  @change="(v) => onStatusChange(item, v)"
                ></htp-select>
                <button class="htp-btn htp-btn--text htp-btn--primary htp-btn--sm" @click="onConvert(item)" title="转化为 Vault 沉淀">沉淀</button>
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
            <label class="form-item__label"><span class="text-danger">*</span> 标题</label>
            <htp-input v-model="form.title" placeholder="如：关于零信任架构的实践" maxlength="200"></htp-input>
          </div>
          <div class="form-item">
            <label class="form-item__label">来源链接 (sourceUrl)</label>
            <htp-input v-model="form.sourceUrl" placeholder="https://...（可选）" maxlength="500"></htp-input>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">类型</label>
              <htp-select v-model="form.type" :options="formTypeOptions"></htp-select>
            </div>
            <div class="form-item">
              <label class="form-item__label">阅读状态</label>
              <htp-select v-model="form.readingStatus" :options="formStatusOptions"></htp-select>
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">标签（逗号分隔）</label>
            <htp-input v-model="form.tags" placeholder="如：AI安全, 零信任" maxlength="200"></htp-input>
          </div>
          <div class="form-item">
            <label class="form-item__label">笔记 / 摘要 (Markdown)</label>
            <htp-textarea v-model="form.notes" :rows="4" placeholder="阅读笔记、要点摘录（可选）" maxlength="20000"></htp-textarea>
          </div>
          <div class="form-item">
            <label class="form-item__label">自定义扩展字段</label>
            <div class="custom-field-editor">
              <div v-for="(row, i) in form.customFields" :key="i" class="custom-field-row">
                <htp-input v-model="row.key" placeholder="字段名" class="cf-key"></htp-input>
                <htp-input v-model="row.value" placeholder="字段值" class="cf-value"></htp-input>
                <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="removeCustomField(i)">移除</button>
              </div>
              <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="addCustomField">+ 添加字段</button>
            </div>
          </div>
        </div>
      </htp-modal>

      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除阅读资料？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDelete"
        @confirm="confirmDoDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下阅读资料吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">{{ delConfirm.title }}</div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.ReadingPage = ReadingPage;

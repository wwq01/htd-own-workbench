/**
 * VaultPage - 沉淀 Vault 页面（V1.3 新模块）
 * 沉淀项（VaultItem）的增删改查 + 详情查看
 */

// ===== 沉淀状态选项 =====
const VAULT_STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '已沉淀', value: 'PRECIPITATED' },
  { label: '已归档', value: 'ARCHIVED' },
];

// 状态 → 标签色
function statusTagType(status) {
  if (status === 'PRECIPITATED') return 'success';
  if (status === 'ARCHIVED') return 'default';
  return 'warning'; // DRAFT / 未知
}

function statusLabel(status) {
  if (status === 'DRAFT') return '草稿';
  if (status === 'PRECIPITATED') return '已沉淀';
  if (status === 'ARCHIVED') return '已归档';
  return status || '草稿';
}

// ===== 沉淀来源类型选项 =====
const VAULT_SOURCE_TYPE_OPTIONS = [
  { label: '手动录入', value: 'MANUAL' },
  { label: '周复盘', value: 'WEEKLY_REVIEW' },
  { label: '项目复盘', value: 'PROJECT_REVIEW' },
  { label: '会议复盘', value: 'MEETING_REVIEW' },
  { label: '凭据备注', value: 'CREDENTIAL_NOTE' },
  { label: '部署备注', value: 'DEPLOY_NOTE' },
];

function sourceTypeLabel(sourceType) {
  const found = VAULT_SOURCE_TYPE_OPTIONS.find(o => o.value === sourceType);
  return found ? found.label : (sourceType || '手动录入');
}

// 逗号分隔文本 → 标签数组
function splitTags(str) {
  if (!str) return [];
  return String(str)
    .split(/[,，]/)
    .map(s => s.trim())
    .filter(Boolean);
}

// 安全解析后端 tags（JSON 字符串）
function parseTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (!tags) return [];
  try {
    const arr = JSON.parse(tags);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

const VaultPage = {
  name: 'VaultPage',
  setup() {
    const dataStore = useDataStore();
    // ============ 筛选 ============
    const filterStatus = Vue.ref('');
    const filterTag = Vue.ref('');

    // ============ 列表数据 ============
    const list = Vue.ref([]);
    const loading = Vue.ref(false);

    function loadList() {
      loading.value = true;
      const params = {};
      if (filterStatus.value) params.status = filterStatus.value;
      if (filterTag.value && filterTag.value.trim()) params.tag = filterTag.value.trim();
      return htdApi.get('/vaults', params)
        .then((raw) => {
          const arr = Array.isArray(raw) ? raw : (raw.list || []);
          list.value = arr.map((v) => ({ ...v, tagsArray: parseTags(v.tags) }));
        })
        .catch((e) => {
          console.error('加载沉淀列表失败:', e);
          list.value = [];
        })
        .finally(() => {
          loading.value = false;
        });
    }

    Vue.watch([filterStatus, filterTag], loadList);
    Vue.onMounted(loadList);

    // ============ 新增 / 编辑弹窗 ============
    const formModalVisible = Vue.ref(false);
    const editingItem = Vue.ref(null);
    const formTitle = Vue.computed(() => (editingItem.value ? '编辑沉淀' : '新增沉淀'));
    const form = Vue.reactive({
      topic: '',
      content: '',
      tags: '',
      status: 'DRAFT',
      sourceType: 'MANUAL',
      sourceId: '',
      sourceUrl: '',
    });

    function resetForm() {
      Object.assign(form, {
        topic: '',
        content: '',
        tags: '',
        status: 'DRAFT',
        sourceType: 'MANUAL',
        sourceId: '',
        sourceUrl: '',
      });
    }

    function openCreate() {
      editingItem.value = null;
      resetForm();
      formModalVisible.value = true;
    }
    function openEdit(item) {
      editingItem.value = item;
      Object.assign(form, {
        topic: item.topic,
        content: item.content || '',
        tags: parseTags(item.tags).join(', '),
        status: item.status || 'DRAFT',
        sourceType: item.sourceType || 'MANUAL',
        sourceId: item.sourceId || '',
        sourceUrl: item.sourceUrl || '',
      });
      formModalVisible.value = true;
    }
    function closeForm() {
      formModalVisible.value = false;
    }
    async function submitForm() {
      const topic = (form.topic || '').trim();
      if (!topic) { showToast('主题不能为空', 'warning'); return; }
      const payload = {
        topic,
        content: form.content || '',
        tags: splitTags(form.tags),
        status: form.status,
        sourceType: form.sourceType,
        sourceId: form.sourceId || null,
        sourceUrl: form.sourceUrl || null,
      };
      try {
        if (editingItem.value) {
          await dataStore.updateVaultItem(editingItem.value.id, payload);
        } else {
          await dataStore.createVaultItem(payload);
        }
        formModalVisible.value = false;
        showToast('保存成功', 'success');
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 详情弹窗 ============
    const detailVisible = Vue.ref(false);
    const detailItem = Vue.ref(null);
    const detailTags = Vue.computed(() => parseTags(detailItem.value ? detailItem.value.tags : null));
    function openDetail(item) {
      detailItem.value = item;
      detailVisible.value = true;
    }
    function closeDetail() {
      detailVisible.value = false;
    }

    // ============ 删除 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(item) { delConfirm.value = item; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteVaultItem(delConfirm.value.id);
        delConfirm.value = null;
        showToast('删除成功', 'success');
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 杂项 ============
    function formatDateTime(d) { return htdDate.formatDateTime(d); }

    return {
      // state
      filterStatus, filterTag,
      list, loading,
      formModalVisible, editingItem, formTitle, form,
      detailVisible, detailItem, detailTags,
      delConfirm,
      // options
      VAULT_STATUS_OPTIONS, VAULT_SOURCE_TYPE_OPTIONS,
      // actions
      loadList,
      openCreate, openEdit, closeForm, submitForm,
      openDetail, closeDetail,
      requestDelete, cancelDelete, confirmDoDelete,
      statusTagType, statusLabel, sourceTypeLabel, formatDateTime,
    };
  },
  template: `
    <div class="list-page vault-page">
      <!-- 筛选栏 -->
      <div class="htp-filter-bar">
        <div class="htp-filter-bar__item">
          <htp-select
            v-model="filterStatus"
            :options="VAULT_STATUS_OPTIONS"
          ></htp-select>
        </div>
        <div class="htp-filter-bar__item">
          <htp-input
            v-model="filterTag"
            placeholder="按标签筛选（如：安全、复盘）"
          ></htp-input>
        </div>
        <div style="margin-left:auto">
          <button class="htp-btn htp-btn--primary" @click="openCreate">+ 新增沉淀</button>
        </div>
      </div>

      <!-- 列表区 -->
      <div class="list-container">
        <div class="list-header">
          <div class="list-header__title">沉淀 Vault</div>
          <div class="list-header__meta">
            <span class="text-sm mr-md">共 {{ list.length }} 条</span>
          </div>
        </div>

        <div class="list-body">
          <div v-if="loading" class="text-center py-lg text-tertiary">加载中...</div>
          <div v-else-if="list.length === 0">
            <htp-empty text="暂无沉淀记录，点击「新增沉淀」开始记录"></htp-empty>
          </div>
          <div v-else class="vault-card-grid">
            <div
              v-for="item in list"
              :key="item.id"
              class="vault-card"
              @click="openDetail(item)"
            >
              <div class="vault-card__head">
                <span class="vault-card__topic" :title="item.topic">{{ item.topic }}</span>
                <htp-tag :type="statusTagType(item.status)">{{ statusLabel(item.status) }}</htp-tag>
              </div>
              <div class="vault-card__meta text-sm text-tertiary">
                <span>来源：{{ sourceTypeLabel(item.sourceType) }}</span>
                <span class="ml-sm">更新：{{ formatDateTime(item.updatedAt) }}</span>
              </div>
              <div v-if="item.tagsArray && item.tagsArray.length" class="vault-card__tags">
                <htp-tag
                  v-for="t in item.tagsArray"
                  :key="t"
                  type="info"
                  class="mr-xs mb-xs"
                >{{ t }}</htp-tag>
              </div>
              <div class="vault-card__actions" @click.stop>
                <button class="htp-btn htp-btn--text htp-btn--primary htp-btn--sm" @click="openEdit(item)">编辑</button>
                <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="requestDelete(item)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新增/编辑弹窗 -->
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
            <label class="form-item__label"><span class="text-danger">*</span> 主题</label>
            <htp-input v-model="form.topic" placeholder="请输入沉淀主题（最多 200 字）" maxlength="200"></htp-input>
          </div>
          <div class="form-item">
            <label class="form-item__label">内容（支持 Markdown）</label>
            <htp-textarea
              v-model="form.content"
              :rows="8"
              placeholder="记录沉淀内容，支持 Markdown 文本"
            ></htp-textarea>
          </div>
          <div class="form-item">
            <label class="form-item__label">标签</label>
            <htp-input v-model="form.tags" placeholder="多个标签用逗号分隔，如：安全, 复盘, 方案"></htp-input>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">状态</label>
              <htp-select
                v-model="form.status"
                :options="VAULT_STATUS_OPTIONS.filter(o => o.value)"
              ></htp-select>
            </div>
            <div class="form-item">
              <label class="form-item__label">来源类型</label>
              <htp-select
                v-model="form.sourceType"
                :options="VAULT_SOURCE_TYPE_OPTIONS"
              ></htp-select>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">来源ID</label>
              <htp-input v-model="form.sourceId" placeholder="关联来源记录ID（可选）"></htp-input>
            </div>
            <div class="form-item">
              <label class="form-item__label">来源链接</label>
              <htp-input v-model="form.sourceUrl" placeholder="来源链接（可选）"></htp-input>
            </div>
          </div>
        </div>
      </htp-modal>

      <!-- 详情弹窗 -->
      <htp-modal
        v-if="detailItem"
        :visible="detailVisible"
        title="沉淀详情"
        :showConfirm="false"
        cancelText="关闭"
        @cancel="closeDetail"
      >
        <div class="vault-detail">
          <div class="vault-detail__head">
            <span class="vault-detail__topic">{{ detailItem.topic }}</span>
            <htp-tag :type="statusTagType(detailItem.status)">{{ statusLabel(detailItem.status) }}</htp-tag>
          </div>
          <div class="vault-detail__meta text-sm text-tertiary mb-sm">
            <span>来源：{{ sourceTypeLabel(detailItem.sourceType) }}</span>
            <span v-if="detailItem.sourceId" class="ml-sm">来源ID：{{ detailItem.sourceId }}</span>
            <span v-if="detailItem.sourceUrl" class="ml-sm">
              链接：<a :href="detailItem.sourceUrl" target="_blank" class="text-primary">{{ detailItem.sourceUrl }}</a>
            </span>
          </div>
          <div v-if="detailTags.length" class="vault-detail__tags mb-sm">
            <htp-tag
              v-for="t in detailTags"
              :key="t"
              type="info"
              class="mr-xs mb-xs"
            >{{ t }}</htp-tag>
          </div>
          <div class="vault-detail__content" style="white-space:pre-wrap; word-break:break-word; line-height:1.7; background:var(--bg-tertiary, #f5f7fa); border-radius:8px; padding:12px; font-size:14px; color:#1f2937;">{{ detailItem.content }}</div>
          <div class="vault-detail__footer text-xs text-tertiary mt-sm">
            创建：{{ formatDateTime(detailItem.createdAt) }} · 更新：{{ formatDateTime(detailItem.updatedAt) }}
          </div>
        </div>
      </htp-modal>

      <!-- 删除二次确认弹窗 -->
      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除沉淀？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDelete"
        @confirm="confirmDoDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下沉淀吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">
            <htp-tag :type="statusTagType(delConfirm.status)" class="mr-xs">{{ statusLabel(delConfirm.status) }}</htp-tag>
            <span>{{ delConfirm.topic }}</span>
          </div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.VaultPage = VaultPage;

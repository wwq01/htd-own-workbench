/**
 * SecretPage - 轻量凭据保险箱页面（阶段 5）
 * 功能：CRUD + 类型筛选 + 关键字搜索 + 口令显示/隐藏 + 一键复制
 */
const SECRET_TYPE_OPTIONS = [
  { label: '环境账号', value: '环境账号' },
  { label: '平台账号', value: '平台账号' },
  { label: 'API密钥', value: 'API密钥' },
  { label: '授权码', value: '授权码' },
  { label: '其他', value: '其他' },
];
const SECRET_TYPE_FILTER = [{ label: '全部类型', value: '' }, ...SECRET_TYPE_OPTIONS];

const SecretPage = {
  name: 'SecretPage',
  setup() {
    const dataStore = useDataStore();

    // ============ 列表 & 筛选 ============
    const list = Vue.ref([]);
    const loading = Vue.ref(false);
    const filterType = Vue.ref('');
    const filterKeyword = Vue.ref('');

    async function loadList() {
      loading.value = true;
      try {
        const params = {};
        if (filterType.value) params.type = filterType.value;
        if (filterKeyword.value) params.keyword = filterKeyword.value;
        const raw = await htdApi.get('/secrets', params);
        list.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        list.value = [];
      } finally {
        loading.value = false;
      }
    }
    Vue.watch([filterType, filterKeyword], loadList);
    Vue.onMounted(loadList);

    // ============ 口令显示/隐藏 ============
    const visibleIds = Vue.ref({});
    function toggleVisible(id) {
      visibleIds.value[id] = !visibleIds.value[id];
    }
    function maskContent(content) {
      if (!content) return '';
      const len = content.length;
      if (len <= 4) return '••••';
      return content.substring(0, 2) + '•'.repeat(Math.min(len - 4, 20)) + content.substring(len - 2);
    }

    // ============ 一键复制 ============
    async function copyContent(text, name) {
      if (!text) { showToast('内容为空', 'warning'); return; }
      const ok = await htdCopy.copyToClipboard(text);
      showToast(ok ? `已复制：${name}` : '复制失败', ok ? 'success' : 'error');
    }

    // ============ 类型统计 ============
    const typeStats = Vue.ref({});
    async function loadTypeStats() {
      try {
        typeStats.value = await htdApi.get('/secrets/type-stats');
      } catch (e) { /* ignore */ }
    }
    Vue.onMounted(loadTypeStats);

    // ============ CRUD 弹窗 ============
    const modalVisible = Vue.ref(false);
    const editing = Vue.ref(null);
    const formTitle = Vue.computed(() => editing.value ? '编辑凭据' : '新增凭据');
    const form = Vue.reactive({
      name: '', type: '其他', content: '',
      usageScenario: '', remark: '', expiryDate: '',
    });

    function openCreate() {
      editing.value = null;
      Object.assign(form, { name: '', type: '其他', content: '', usageScenario: '', remark: '', expiryDate: '' });
      modalVisible.value = true;
    }
    function openEdit(item) {
      editing.value = item;
      Object.assign(form, {
        name: item.name || '',
        type: item.type || '其他',
        content: item.content || '',
        usageScenario: item.usageScenario || '',
        remark: item.remark || '',
        expiryDate: item.expiryDate || '',
      });
      modalVisible.value = true;
    }
    async function submitForm() {
      const name = (form.name || '').trim();
      const content = (form.content || '').trim();
      if (!name) { showToast('凭据名称不能为空', 'warning'); return; }
      if (!content) { showToast('凭据内容不能为空', 'warning'); return; }
      const payload = {
        name,
        type: form.type,
        content,
        usageScenario: form.usageScenario || null,
        remark: form.remark || null,
        expiryDate: form.expiryDate || null,
      };
      try {
        if (editing.value) {
          await dataStore.updateSecret(editing.value.id, payload);
        } else {
          await dataStore.createSecret(payload);
        }
        modalVisible.value = false;
        await loadList();
        await loadTypeStats();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 删除二次确认 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(item) { delConfirm.value = item; }
    async function confirmDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteSecret(delConfirm.value.id);
        delConfirm.value = null;
        await loadList();
        await loadTypeStats();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 辅助 ============
    function typeIcon(t) {
      const map = { '环境账号': '🖥️', '平台账号': '🏢', 'API密钥': '🔑', '授权码': '📋', '其他': '📦' };
      return map[t] || '📦';
    }
    function isExpiringSoon(dateStr) {
      if (!dateStr) return false;
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + 7);
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      return dateStr >= nowStr && dateStr <= futureStr;
    }

    return {
      list, loading,
      filterType, filterKeyword,
      loadList, loadTypeStats, typeStats,
      modalVisible, editing, formTitle, form,
      openCreate, openEdit, submitForm,
      delConfirm, requestDelete, confirmDelete,
      visibleIds, toggleVisible, maskContent, copyContent,
      typeIcon, isExpiringSoon,
      SECRET_TYPE_FILTER, SECRET_TYPE_OPTIONS,
    };
  },
  template: `
    <div class="list-page">
      <!-- 安全提示 -->
      <div class="secret-notice">
        <span>⚠ 注意：第一版为明文存储，请勿存放极高敏感信息（如银行密码等）</span>
      </div>

      <!-- 顶部：类型统计 -->
      <div class="secret-topbar">
        <div class="secret-stats">
          <span class="secret-stat-item" v-for="(count, key) in typeStats" :key="key">
            <htp-tag type="info">{{ typeIcon(key) }} {{ key }}</htp-tag>
            <span class="secret-stat-num">{{ count }}</span>
          </span>
        </div>
      </div>

      <!-- 筛选条 -->
      <div class="htp-filter-bar">
        <div class="htp-filter-bar__item">
          <htp-select v-model="filterType" :options="SECRET_TYPE_FILTER" placeholder="全部类型"></htp-select>
        </div>
        <div class="htp-filter-bar__item" style="flex:1">
          <input class="htp-input" v-model="filterKeyword" placeholder="名称/场景/备注关键字搜索" />
        </div>
        <button class="htp-btn htp-btn--primary htp-btn--sm" @click="openCreate">+ 新增凭据</button>
      </div>

      <!-- 空状态 -->
      <div v-if="list.length === 0 && !loading" style="padding: 40px;">
        <htp-empty text="暂无凭据记录，点击「新增」开始"></htp-empty>
      </div>

      <!-- 卡片网格 -->
      <div v-else class="secret-grid">
        <div class="secret-card" v-for="item in list" :key="item.id">
          <div class="secret-card__header">
            <span class="secret-card__icon">{{ typeIcon(item.type) }}</span>
            <span class="secret-card__name">{{ item.name }}</span>
            <htp-tag v-if="isExpiringSoon(item.expiryDate)" type="danger">即将过期</htp-tag>
          </div>
          <div class="secret-card__meta">
            <htp-tag type="info">{{ item.type }}</htp-tag>
            <span v-if="item.expiryDate" class="secret-card__expiry">
              <span class="text-tertiary">有效期：</span>{{ item.expiryDate }}
            </span>
          </div>
          <div class="secret-card__content">
            <span class="text-tertiary">口令：</span>
            <code class="secret-card__code">{{ visibleIds[item.id] ? item.content : maskContent(item.content) }}</code>
            <button class="htp-btn htp-btn--text htp-btn--sm" @click="toggleVisible(item.id)">
              {{ visibleIds[item.id] ? '隐藏' : '显示' }}
            </button>
            <button class="htp-btn htp-btn--text htp-btn--sm" @click="copyContent(item.content, item.name)">复制</button>
          </div>
          <div v-if="item.usageScenario" class="secret-card__scenario">
            <span class="text-tertiary">场景：</span>{{ item.usageScenario }}
          </div>
          <div v-if="item.remark" class="secret-card__remark">
            <span class="text-tertiary">备注：</span>{{ item.remark }}
          </div>
          <div class="secret-card__actions">
            <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openEdit(item)">编辑</button>
            <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestDelete(item)">删除</button>
          </div>
        </div>
      </div>

      <!-- 新增/编辑弹窗 -->
      <htp-modal v-if="modalVisible" :visible="true" :title="formTitle" @cancel="modalVisible = false" width="600px">
        <div class="form-grid">
          <div class="form-grid--full">
            <label class="form-label">凭据名称 *</label>
            <input class="htp-input" v-model="form.name" placeholder="如：测试环境-管理员账号" />
          </div>
          <div>
            <label class="form-label">类型</label>
            <htp-select v-model="form.type" :options="SECRET_TYPE_OPTIONS" placeholder="请选择"></htp-select>
          </div>
          <div>
            <label class="form-label">有效期</label>
            <input class="htp-input" v-model="form.expiryDate" type="date" />
          </div>
          <div class="form-grid--full">
            <label class="form-label">口令/内容 *</label>
            <textarea class="htp-textarea" v-model="form.content" placeholder="账号/密码/密钥/授权码..." rows="3"></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">使用场景</label>
            <input class="htp-input" v-model="form.usageScenario" placeholder="如：XX系统测试环境登录" />
          </div>
          <div class="form-grid--full">
            <label class="form-label">备注</label>
            <textarea class="htp-textarea" v-model="form.remark" placeholder="补充说明..." rows="2"></textarea>
          </div>
        </div>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="modalVisible = false">取消</button>
          <button class="htp-btn htp-btn--primary" @click="submitForm">确认</button>
        </template>
      </htp-modal>

      <!-- 删除确认 -->
      <htp-modal v-if="delConfirm" :visible="true" title="确认删除？" @cancel="delConfirm = null">
        <p>删除后不可恢复，确认删除以下凭据吗？</p>
        <p style="font-weight: 500; margin-top: 8px;">{{ delConfirm.name }}</p>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="delConfirm = null">取消</button>
          <button class="htp-btn htp-btn--danger" @click="confirmDelete">确认删除</button>
        </template>
      </htp-modal>
    </div>
  `,
};
window.SecretPage = SecretPage;

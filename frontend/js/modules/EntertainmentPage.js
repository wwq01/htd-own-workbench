/**
 * EntertainmentPage - 游戏娱乐页面（阶段 4）
 * 功能：CRUD + 类型/状态筛选 + 关键字搜索 + 随机推荐 + 评分
 */
const ENT_TYPE_OPTIONS = [
  { label: '游戏', value: '游戏' },
  { label: '番剧', value: '番剧' },
  { label: '剧集', value: '剧集' },
  { label: '书籍', value: '书籍' },
  { label: '其他', value: '其他' },
];
const ENT_STATUS_OPTIONS = [
  { label: '想看', value: '想看' },
  { label: '在玩', value: '在玩' },
  { label: '已通关', value: '已通关' },
  { label: '弃坑', value: '弃坑' },
];
const ENT_TYPE_FILTER = [{ label: '全部类型', value: '' }, ...ENT_TYPE_OPTIONS];
const ENT_STATUS_FILTER = [{ label: '全部状态', value: '' }, ...ENT_STATUS_OPTIONS];

const EntertainmentPage = {
  name: 'EntertainmentPage',
  setup() {
    const dataStore = useDataStore();

    // ============ 列表 & 筛选 ============
    const list = Vue.ref([]);
    const loading = Vue.ref(false);
    const filterType = Vue.ref('');
    const filterStatus = Vue.ref('');
    const filterKeyword = Vue.ref('');

    async function loadList() {
      loading.value = true;
      try {
        const params = {};
        if (filterType.value) params.type = filterType.value;
        if (filterStatus.value) params.status = filterStatus.value;
        if (filterKeyword.value) params.keyword = filterKeyword.value;
        const raw = await htdApi.get('/entertainments', params);
        list.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        list.value = [];
      } finally {
        loading.value = false;
      }
    }
    Vue.watch([filterType, filterStatus, filterKeyword], loadList);
    Vue.onMounted(loadList);

    // ============ 状态统计 ============
    const statusStats = Vue.ref({});
    async function loadStatusStats() {
      try {
        statusStats.value = await htdApi.get('/entertainments/status-stats');
      } catch (e) { /* ignore */ }
    }
    Vue.onMounted(loadStatusStats);

    // ============ 随机推荐 ============
    const recommend = Vue.ref(null);
    async function rollRecommend() {
      try {
        recommend.value = await dataStore.fetchEntertainmentRecommend();
        if (!recommend.value) {
          showToast('暂无可推荐内容（想看/在玩 列表为空）', 'info');
        } else {
          showToast(`今日推荐：${recommend.value.name}`, 'success');
        }
      } catch (e) { /* ignore */ }
    }

    // ============ CRUD 弹窗 ============
    const modalVisible = Vue.ref(false);
    const editing = Vue.ref(null);
    const formTitle = Vue.computed(() => editing.value ? '编辑娱乐内容' : '新增娱乐内容');
    const form = Vue.reactive({
      name: '', type: '游戏', status: '想看', rating: 0,
      progress: '', review: '',
    });

    function openCreate() {
      editing.value = null;
      Object.assign(form, { name: '', type: '游戏', status: '想看', rating: 0, progress: '', review: '' });
      modalVisible.value = true;
    }
    function openEdit(item) {
      editing.value = item;
      Object.assign(form, {
        name: item.name || '',
        type: item.type || '游戏',
        status: item.status || '想看',
        rating: item.rating || 0,
        progress: item.progress || '',
        review: item.review || '',
      });
      modalVisible.value = true;
    }
    async function submitForm() {
      const name = (form.name || '').trim();
      if (!name) { showToast('作品名称不能为空', 'warning'); return; }
      const payload = {
        name,
        type: form.type,
        status: form.status,
        rating: parseInt(form.rating, 10) || 0,
        progress: form.progress || null,
        review: form.review || null,
      };
      try {
        if (editing.value) {
          await dataStore.updateEntertainment(editing.value.id, payload);
        } else {
          await dataStore.createEntertainment(payload);
        }
        modalVisible.value = false;
        await loadList();
        await loadStatusStats();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 删除二次确认 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(item) { delConfirm.value = item; }
    async function confirmDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteEntertainment(delConfirm.value.id);
        delConfirm.value = null;
        await loadList();
        await loadStatusStats();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 辅助 ============
    function statusType(s) {
      if (s === '已通关') return 'success';
      if (s === '在玩') return 'primary';
      if (s === '弃坑') return 'default';
      return 'warning'; // 想看
    }
    function typeIcon(t) {
      const map = { 游戏: 'gamepad', 番剧: 'tv', 剧集: 'film', 书籍: 'book', 其他: 'dice' };
      return window.htdIcon(map[t] || 'dice', { size: 18 });
    }
    function starsHtml(rating) {
      const r = parseInt(rating, 10) || 0;
      let s = '';
      for (let i = 0; i < 5; i++) {
        const on = i < r;
        const c = on ? 'var(--color-warning)' : 'var(--text-tertiary)';
        s += `<svg class="ent-star-svg" width="14" height="14" viewBox="0 0 24 24" fill="${on ? c : 'none'}" stroke="${c}" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      }
      return s;
    }
    function setRating(v) {
      form.rating = v;
    }

    const starSvg = window.htdIcon('star', { size: 18 });

    return {
      list, loading,
      filterType, filterStatus, filterKeyword,
      loadList, loadStatusStats,
      statusStats, rollRecommend, recommend,
      modalVisible, editing, formTitle, form,
      openCreate, openEdit, submitForm, setRating,
      delConfirm, requestDelete, confirmDelete,
      statusType, typeIcon, starsHtml,
      ENT_TYPE_FILTER, ENT_STATUS_FILTER, ENT_TYPE_OPTIONS, ENT_STATUS_OPTIONS,
    };
  },
  template: `
    <div class="list-page">
      <!-- 顶部：状态统计 + 随机推荐 -->
      <div class="ent-topbar">
        <div class="ent-stats">
          <span class="ent-stat-item" v-for="(count, key) in statusStats" :key="key">
            <htp-tag :type="statusType(key)">{{ key }}</htp-tag>
            <span class="ent-stat-num">{{ count }}</span>
          </span>
        </div>
        <div class="ent-actions">
          <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="rollRecommend"><span class="ent-card__icon" v-html="htdIcon('dice',{size:16})"></span> 随机推荐</button>
        </div>
      </div>

      <!-- 随机推荐结果 -->
      <div v-if="recommend" class="ent-recommend">
        <span class="text-tertiary">今日推荐：</span>
        <span class="text-primary font-medium"><span class="ent-card__icon" v-html="typeIcon(recommend.type)"></span> {{ recommend.name }}</span>
        <htp-tag :type="statusType(recommend.status)" class="ml-sm">{{ recommend.status }}</htp-tag>
        <button class="htp-btn htp-btn--text htp-btn--sm ml-sm" @click="recommend = null">收起</button>
      </div>

      <!-- 筛选条 -->
      <div class="htp-filter-bar">
        <div class="htp-filter-bar__item">
          <htp-select v-model="filterType" :options="ENT_TYPE_FILTER" placeholder="全部类型"></htp-select>
        </div>
        <div class="htp-filter-bar__item">
          <htp-select v-model="filterStatus" :options="ENT_STATUS_FILTER" placeholder="全部状态"></htp-select>
        </div>
        <div class="htp-filter-bar__item" style="flex:1">
          <HtpInput v-model="filterKeyword" placeholder="名称/进度/短评关键字搜索"  />
        </div>
        <button class="htp-btn htp-btn--primary htp-btn--sm" @click="openCreate">+ 新增</button>
      </div>

      <!-- 空状态 -->
      <div v-if="list.length === 0 && !loading" style="padding: 40px;">
        <htp-empty text="暂无娱乐内容记录，点击「新增」开始"></htp-empty>
      </div>

      <!-- 卡片网格 -->
      <div v-else class="ent-grid">
        <div class="ent-card" v-for="item in list" :key="item.id">
          <div class="ent-card__header">
            <span class="ent-card__icon" v-html="typeIcon(item.type)"></span>
            <span class="ent-card__name">{{ item.name }}</span>
            <htp-tag :type="statusType(item.status)">{{ item.status }}</htp-tag>
          </div>
          <div class="ent-card__meta">
            <htp-tag type="info">{{ item.type }}</htp-tag>
            <span class="ent-card__stars">{{ starsHtml(item.rating) }}</span>
          </div>
          <div v-if="item.progress" class="ent-card__progress">
            <span class="text-tertiary">进度：</span>{{ item.progress }}
          </div>
          <div v-if="item.review" class="ent-card__review">
            <span class="text-tertiary">短评：</span>{{ item.review }}
          </div>
          <div class="ent-card__actions">
            <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openEdit(item)">编辑</button>
            <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestDelete(item)">删除</button>
          </div>
        </div>
      </div>

      <!-- 新增/编辑弹窗 -->
      <htp-modal v-if="modalVisible" :visible="true" :title="formTitle" @cancel="modalVisible = false" width="600px">
        <div class="form-grid">
          <div class="form-grid--full">
            <label class="form-label">作品名称 *</label>
            <HtpInput v-model="form.name" placeholder="如：黑神话：悟空"  />
          </div>
          <div>
            <label class="form-label">类型</label>
            <htp-select v-model="form.type" :options="ENT_TYPE_OPTIONS" placeholder="请选择"></htp-select>
          </div>
          <div>
            <label class="form-label">状态</label>
            <htp-select v-model="form.status" :options="ENT_STATUS_OPTIONS" placeholder="请选择"></htp-select>
          </div>
          <div class="form-grid--full">
            <label class="form-label">评分（点击星星）</label>
            <div class="ent-rating-picker">
              <span v-for="n in 5" :key="n" class="ent-star" :class="{ 'ent-star--on': n <= form.rating }" @click="setRating(n)" v-html="starSvg"></span>
              <span class="text-tertiary ml-sm">{{ form.rating }} / 5</span>
            </div>
          </div>
          <div class="form-grid--full">
            <label class="form-label">进度记录</label>
            <HtpInput v-model="form.progress" placeholder="如：第3章 / 第12集 / 70小时"  />
          </div>
          <div class="form-grid--full">
            <label class="form-label">个人短评</label>
            <textarea class="htp-textarea" v-model="form.review" placeholder="个人感受、推荐理由..." rows="3"></textarea>
          </div>
        </div>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="modalVisible = false">取消</button>
          <button class="htp-btn htp-btn--primary" @click="submitForm">确认</button>
        </template>
      </htp-modal>

      <!-- 删除确认 -->
      <htp-modal v-if="delConfirm" :visible="true" title="确认删除？" @cancel="delConfirm = null">
        <p>删除后不可恢复，确认删除以下娱乐内容吗？</p>
        <p style="font-weight: 500; margin-top: 8px;">{{ delConfirm.name }}</p>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="delConfirm = null">取消</button>
          <button class="htp-btn htp-btn--danger" @click="confirmDelete">确认删除</button>
        </template>
      </htp-modal>
    </div>
  `,
};
window.EntertainmentPage = EntertainmentPage;

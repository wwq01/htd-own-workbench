/**
 * RecycleBinPage - 回收站（V1.3）
 * 聚合全部软删除（deletedAt）记录，提供恢复 / 永久删除 / 清空。
 * 依赖全局：Vue / htdApi / showToast / useDataStore / ConfirmPermanentDelete
 */
const RecycleBinPage = {
  name: 'RecycleBinPage',
  setup() {
    const dataStore = useDataStore();

    const items = Vue.ref([]);
    const total = Vue.ref(0);
    const loading = Vue.ref(false);

    // 单条「永久删除」二次确认
    const permConfirm = Vue.ref(null);
    // 「清空回收站」二次确认
    const emptyConfirm = Vue.ref(false);

    async function loadList() {
      loading.value = true;
      try {
        const data = await htdApi.get('/system/recycle-bin');
        items.value = data.items || [];
        total.value = data.total || 0;
      } catch (e) {
        items.value = [];
        total.value = 0;
      } finally {
        loading.value = false;
      }
    }

    function formatDeletedAt(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    async function handleRestore(item) {
      try {
        await dataStore.restoreRecycleBinItem(item.model, item.id);
        showToast(`已恢复「${item.title}」`, 'success');
        await loadList();
      } catch (e) {
        // 请求封装已显示错误
      }
    }

    function requestPermanentDelete(item) {
      permConfirm.value = item;
    }
    async function confirmPermanentDelete() {
      if (!permConfirm.value) return;
      try {
        await dataStore.permanentlyDeleteRecycleBinItem(permConfirm.value.model, permConfirm.value.id);
        showToast('已永久删除', 'success');
        permConfirm.value = null;
        await loadList();
      } catch (e) {
        // 请求封装已显示错误
      }
    }

    async function confirmEmpty() {
      try {
        const r = await dataStore.emptyRecycleBin();
        emptyConfirm.value = false;
        showToast(`已清空回收站，共删除 ${r.total || 0} 条`, 'success');
        await loadList();
      } catch (e) {
        // 请求封装已显示错误
      }
    }

    Vue.onMounted(loadList);

    return {
      items,
      total,
      loading,
      permConfirm,
      emptyConfirm,
      formatDeletedAt,
      handleRestore,
      requestPermanentDelete,
      confirmPermanentDelete,
      confirmEmpty,
    };
  },
  template: `
    <div class="list-page">
      <div class="recycle-header">
        <div class="recycle-header__desc">
          回收站共 <strong style="color: var(--text-primary);">{{ total }}</strong> 条已删除记录。
          恢复后可回到原模块；确认无需保留的记录可永久删除以释放空间。
        </div>
        <button class="htp-btn htp-btn--danger htp-btn--sm" :disabled="total === 0" @click="emptyConfirm = true">清空回收站</button>
      </div>

      <div v-if="loading" class="text-tertiary" style="padding: 40px 0;">正在读取回收站...</div>
      <htp-empty v-else-if="items.length === 0" text="回收站是空的，暂无已删除的记录"></htp-empty>

      <div v-else class="recycle-list">
        <div class="recycle-item" v-for="item in items" :key="item.model + '-' + item.id">
          <div class="recycle-item__main">
            <htp-tag type="info">{{ item.label }}</htp-tag>
            <span class="recycle-item__title">{{ item.title }}</span>
          </div>
          <div class="recycle-item__meta">删除于 {{ formatDeletedAt(item.deletedAt) }}</div>
          <div class="recycle-item__actions">
            <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="handleRestore(item)">恢复</button>
            <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestPermanentDelete(item)">永久删除</button>
          </div>
        </div>
      </div>

      <confirm-permanent-delete
        v-if="permConfirm"
        :visible="true"
        :item-name="permConfirm.title"
        @confirm="confirmPermanentDelete"
        @cancel="permConfirm = null"
      ></confirm-permanent-delete>

      <confirm-permanent-delete
        v-if="emptyConfirm"
        :visible="true"
        title="确认清空回收站？"
        item-name="全部已删除记录"
        confirm-text="清空回收站"
        @confirm="confirmEmpty"
        @cancel="emptyConfirm = false"
      ></confirm-permanent-delete>
    </div>
  `,
};
window.RecycleBinPage = RecycleBinPage;

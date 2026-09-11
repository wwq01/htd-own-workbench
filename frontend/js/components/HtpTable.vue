<script setup>
/**
 * HtpTable - 通用表格（统一列表骨架/空态/分页）
 * - columns: [{ key, title, align?, width? }]
 * - rows: 数据数组（每项为对象，单元格默认取 row[key]）
 * - 单元格自定义：具名插槽 slot name = column.key，作用域 { row, value }
 * - loading: 显示骨架行；rows 为空且非 loading: 显示空态
 * - 分页：pageSize>0 时启用，emit page-change
 */
import { computed } from 'vue';

const props = defineProps({
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  skeletonRows: { type: Number, default: 4 },
  emptyText: { type: String, default: '暂无数据' },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 0 }, // 0 = 不分页
  total: { type: Number, default: 0 },
});
const emit = defineEmits(['page-change']);

const totalPages = computed(() =>
  props.pageSize > 0 ? Math.max(1, Math.ceil(props.total / props.pageSize)) : 1
);

function rowKey(row, i) {
  return row && row.id != null ? row.id : i;
}
function go(p) {
  if (p < 1 || p > totalPages.value) return;
  emit('page-change', p);
}
</script>

<template>
  <div class="htp-table">
    <div class="htp-table__scroll">
      <table class="htp-table__el">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :style="{ width: col.width, textAlign: col.align || 'left' }"
            >
              {{ col.title }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="r in skeletonRows" :key="'sk' + r">
              <td v-for="col in columns" :key="col.key">
                <div class="htp-table__cell-skel"></div>
              </td>
            </tr>
          </template>
          <template v-else-if="rows.length === 0">
            <tr>
              <td :colspan="columns.length" class="htp-table__empty">{{ emptyText }}</td>
            </tr>
          </template>
          <template v-else>
            <tr v-for="(row, i) in rows" :key="rowKey(row, i)">
              <td
                v-for="col in columns"
                :key="col.key"
                :style="{ textAlign: col.align || 'left' }"
              >
                <slot :name="col.key" :row="row" :value="row[col.key]">{{ row[col.key] }}</slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-if="pageSize > 0 && !loading && rows.length > 0" class="htp-table__pager">
      <button class="htp-table__page-btn" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
      <span class="htp-table__page-info">{{ page }} / {{ totalPages }}</span>
      <button
        class="htp-table__page-btn"
        :disabled="page >= totalPages"
        @click="go(page + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.htp-table {
  width: 100%;
}
.htp-table__scroll {
  width: 100%;
  overflow-x: auto;
}
.htp-table__el {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.htp-table__el th {
  padding: 10px 12px;
  color: var(--text-tertiary);
  font-weight: 600;
  text-align: left;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-tertiary);
  white-space: nowrap;
}
.htp-table__el td {
  padding: 10px 12px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-default);
  vertical-align: top;
}
.htp-table__el tbody tr:hover {
  background: var(--bg-hover);
}
.htp-table__empty {
  text-align: center;
  color: var(--text-tertiary);
  padding: 28px 12px;
}
.htp-table__cell-skel {
  height: 12px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 25%,
    rgba(255, 255, 255, 0.12) 50%,
    var(--bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: htp-table-shimmer 1.4s ease-in-out infinite;
}
@keyframes htp-table-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
.htp-table__pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 10px 4px 2px;
}
.htp-table__page-btn {
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  padding: 5px 12px;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}
.htp-table__page-btn:hover:not(:disabled) {
  border-color: var(--border-hover);
  color: var(--text-primary);
}
.htp-table__page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.htp-table__page-info {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>

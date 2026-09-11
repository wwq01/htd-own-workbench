<script setup>
/**
 * HtpChartLegend.vue - S2-2a 图例（响应式 SFC，替代 charts.js legend 字符串）
 * 接收 items: [{ label, color }]
 */
defineProps({
  items: { type: Array, default: () => [] },
});
</script>

<template>
  <div v-if="items.length" class="htd-chart-legend">
    <span v-for="(it, i) in items" :key="i" class="htd-chart-legend__item">
      <span class="htd-chart-legend__dot" :style="{ background: it.color }"></span>{{ it.label }}
    </span>
  </div>
</template>

<style scoped>
.htd-chart-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 8px; font-size: 12px; color: var(--text-secondary); }
.htd-chart-legend__item { display: inline-flex; align-items: center; gap: 6px; }
.htd-chart-legend__dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
</style>

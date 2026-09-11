<script setup>
/**
 * HtpStackedBarChart.vue - S2-2a 堆叠柱状图（响应式 SFC，根治 P0-3 v-html）
 * 接收 data: [{ label, values: { [key]: number } }]，series: [{ key, color?, label? }]
 */
import { computed } from 'vue';
import { stackedGeometry, truncate } from '../utils/chartGeometry.js';

const props = defineProps({
  data: { type: Array, default: () => [] },
  series: { type: Array, default: () => [] },
  height: { type: Number, default: 180 },
});

const geo = computed(() => stackedGeometry({ data: props.data, series: props.series, height: props.height }));
</script>

<template>
  <div class="htp-chart-wrap">
    <svg v-if="geo.W" class="htd-chart" :viewBox="`0 0 ${geo.W} ${geo.H}`" width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      <line :x1="geo.base.x1" :y1="geo.base.y1" :x2="geo.base.x2" :y2="geo.base.y2" stroke="var(--border-default)" stroke-width="1" />
      <rect v-for="(b, i) in geo.bars" :key="'b' + i" :x="b.x.toFixed(1)" :y="b.y.toFixed(1)" :width="b.w.toFixed(1)" :height="b.h.toFixed(1)" :fill="b.color" />
      <text v-for="(l, i) in geo.labels" :key="'l' + i" :x="l.x.toFixed(1)" :y="l.y.toFixed(1)" text-anchor="middle" font-size="10" fill="var(--text-tertiary)">{{ truncate(l.text, 6) }}</text>
    </svg>
    <p v-else class="htp-chart-empty">暂无数据</p>
  </div>
</template>

<style scoped>
.htp-chart-wrap { width: 100%; }
.htp-chart-empty { color: var(--text-tertiary); font-size: 12px; text-align: center; padding: 24px 0; margin: 0; }
</style>

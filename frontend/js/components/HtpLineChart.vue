<script setup>
/**
 * HtpLineChart.vue - S2-2a 折线图（响应式 SFC，根治 P0-3 v-html）
 * S2-2b 挂载点：FinancePage 月度收支趋势（消 P2-2 死代码）
 * 接收 data: [{ label, value }]
 */
import { computed } from 'vue';
import { lineGeometry, truncate } from '../utils/chartGeometry.js';

const props = defineProps({
  data: { type: Array, default: () => [] },
  height: { type: Number, default: 160 },
  color: { type: String, default: 'var(--color-primary)' },
});

const geo = computed(() => lineGeometry({ data: props.data, height: props.height, color: props.color }));
</script>

<template>
  <div class="htp-chart-wrap">
    <svg v-if="geo.W" class="htd-chart" :viewBox="`0 0 ${geo.W} ${geo.H}`" width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      <line :x1="geo.base.x1" :y1="geo.base.y1" :x2="geo.base.x2" :y2="geo.base.y2" stroke="var(--border-default)" stroke-width="1" />
      <polygon :points="geo.area" :fill="geo.color" fill-opacity="0.12" stroke="none" />
      <polyline :points="geo.polyline" fill="none" :stroke="geo.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle v-for="(p, i) in geo.dots" :key="'d' + i" :cx="p.x.toFixed(1)" :cy="p.y.toFixed(1)" r="2.6" :fill="geo.color" />
      <text v-for="(l, i) in geo.labels" :key="'l' + i" :x="l.x.toFixed(1)" :y="l.y.toFixed(1)" text-anchor="middle" font-size="10" fill="var(--text-tertiary)">{{ truncate(l.text, 6) }}</text>
    </svg>
    <p v-else class="htp-chart-empty">暂无数据</p>
  </div>
</template>

<style scoped>
.htp-chart-wrap { width: 100%; }
.htp-chart-empty { color: var(--text-tertiary); font-size: 12px; text-align: center; padding: 24px 0; margin: 0; }
</style>

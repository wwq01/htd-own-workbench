<script setup>
/**
 * HtpTimelineChart.vue - S2-2a 横向时间线（响应式 SFC，根治 P0-3 v-html）
 * 接收 items: [{ label, date?, color?, done? }]
 */
import { computed } from 'vue';
import { timelineGeometry, truncate } from '../utils/chartGeometry.js';

const props = defineProps({
  items: { type: Array, default: () => [] },
  height: { type: Number, default: 120 },
});

const geo = computed(() => timelineGeometry({ items: props.items, height: props.height }));
</script>

<template>
  <div class="htp-chart-wrap">
    <svg v-if="geo.W" class="htd-chart" :viewBox="`0 0 ${geo.W} ${geo.H}`" width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      <line :x1="geo.axis.x1" :y1="geo.axis.y1" :x2="geo.axis.x2" :y2="geo.axis.y2" stroke="var(--border-default)" stroke-width="1.5" />
      <circle v-for="(nd, i) in geo.nodes" :key="'n' + i" :cx="nd.x.toFixed(1)" :cy="nd.y.toFixed(1)" :r="nd.r" :fill="nd.fill" :stroke="nd.stroke" stroke-width="2" />
      <text v-for="(l, i) in geo.labels" :key="'l' + i" :x="l.x.toFixed(1)" :y="l.y.toFixed(1)" text-anchor="middle" font-size="10" fill="var(--text-secondary)">{{ truncate(l.text, 8) }}</text>
      <text v-for="(d, i) in geo.dates" :key="'d' + i" :x="d.x.toFixed(1)" :y="d.y.toFixed(1)" text-anchor="middle" font-size="9" fill="var(--text-tertiary)">{{ d.text }}</text>
    </svg>
    <p v-else class="htp-chart-empty">暂无里程碑</p>
  </div>
</template>

<style scoped>
.htp-chart-wrap { width: 100%; }
.htp-chart-empty { color: var(--text-tertiary); font-size: 12px; text-align: center; padding: 24px 0; margin: 0; }
</style>

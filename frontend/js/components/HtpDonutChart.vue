<script setup>
/**
 * HtpDonutChart.vue - S2-2a 环形图/饼图（响应式 SFC，根治 P0-3 v-html）
 * 接收 data: [{ label, value, color? }]
 */
import { computed } from 'vue';
import { donutGeometry } from '../utils/chartGeometry.js';

const props = defineProps({
  data: { type: Array, default: () => [] },
  width: { type: Number, default: 180 },
  height: { type: Number, default: 180 },
  centerText: { type: String, default: '' },
  innerRatio: { type: Number, default: 0.6 },
});

const geo = computed(() => donutGeometry({ data: props.data, width: props.width, height: props.height, centerText: props.centerText, innerRatio: props.innerRatio }));
</script>

<template>
  <div class="htp-chart-wrap">
    <svg v-if="geo.W" class="htd-chart" :viewBox="`0 0 ${geo.W} ${geo.H}`" width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      <circle v-if="geo.single" :cx="geo.cx" :cy="geo.cy" :r="geo.r" fill="none" :stroke="geo.single.color" :stroke-width="(geo.r - geo.inner).toFixed(1)" />
      <path v-for="(a, i) in geo.arcs" :key="'a' + i" :d="a.path" :fill="a.color" stroke="var(--bg-card)" stroke-width="1.5" />
      <text :x="geo.center.x" :y="geo.center.y" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="600" fill="var(--text-primary)">{{ geo.center.text }}</text>
    </svg>
    <p v-else class="htp-chart-empty">暂无数据</p>
  </div>
</template>

<style scoped>
.htp-chart-wrap { width: 100%; }
.htp-chart-empty { color: var(--text-tertiary); font-size: 12px; text-align: center; padding: 24px 0; margin: 0; }
</style>

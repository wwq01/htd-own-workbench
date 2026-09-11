<script setup>
/**
 * HtpSkeleton - 加载占位骨架屏
 * variant: text（多行文本）| block（矩形块）| circle（圆形）| avatar（圆形头像位）
 * 仅作视觉占位，aria-hidden，不参与交互
 */
const props = defineProps({
  variant: { type: String, default: 'text' }, // text | block | circle | avatar
  lines: { type: Number, default: 3 },
  width: { type: String, default: '' },
  height: { type: String, default: '' },
});
</script>

<template>
  <div class="htp-skeleton" :class="`htp-skeleton--${variant}`" aria-hidden="true">
    <template v-if="variant === 'text'">
      <div
        v-for="n in lines"
        :key="n"
        class="htp-skeleton__line"
        :style="{ width: n === lines ? '70%' : '100%' }"
      ></div>
    </template>
    <div
      v-else
      class="htp-skeleton__shape"
      :class="{ 'htp-skeleton__shape--circle': variant === 'circle' || variant === 'avatar' }"
      :style="{ width: width || (variant === 'avatar' ? '48px' : '100%'), height: height || (variant === 'avatar' ? '48px' : '120px') }"
    ></div>
  </div>
</template>

<style scoped>
.htp-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.htp-skeleton__line,
.htp-skeleton__shape {
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 25%,
    rgba(255, 255, 255, 0.12) 50%,
    var(--bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: htp-skeleton-shimmer 1.4s ease-in-out infinite;
}
.htp-skeleton__line {
  height: 12px;
}
.htp-skeleton__shape--circle {
  border-radius: var(--radius-full);
}
@keyframes htp-skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .htp-skeleton__line,
  .htp-skeleton__shape {
    animation: none;
  }
}
</style>

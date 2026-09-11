<script setup>
/**
 * HtpTooltip - 悬浮提示
 * 包裹触发元素（默认插槽）；content 为提示文本；placement 控制方位
 * hover / focus 显隐；disabled 时禁用
 */
import { ref } from 'vue';

const props = defineProps({
  content: { type: String, default: '' },
  placement: { type: String, default: 'top' }, // top | bottom | left | right
  disabled: { type: Boolean, default: false },
});
const visible = ref(false);
</script>

<template>
  <span
    class="htp-tooltip"
    @mouseenter="!disabled && (visible = true)"
    @mouseleave="visible = false"
    @focusin="!disabled && (visible = true)"
    @focusout="visible = false"
  >
    <span class="htp-tooltip__trigger"><slot /></span>
    <Transition name="htp-tooltip-fade">
      <span
        v-if="visible && content"
        class="htp-tooltip__pop"
        :class="`htp-tooltip__pop--${placement}`"
        role="tooltip"
        >{{ content }}</span
      >
    </Transition>
  </span>
</template>

<style scoped>
.htp-tooltip {
  position: relative;
  display: inline-flex;
}
.htp-tooltip__trigger {
  display: inline-flex;
}
.htp-tooltip__pop {
  position: absolute;
  z-index: 1100;
  max-width: 240px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--text-primary);
  color: var(--bg-deepest);
  font-size: 12px;
  line-height: 1.4;
  white-space: normal;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
.htp-tooltip__pop--top {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
}
.htp-tooltip__pop--bottom {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
}
.htp-tooltip__pop--left {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-right: 8px;
}
.htp-tooltip__pop--right {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
}
.htp-tooltip-fade-enter-active,
.htp-tooltip-fade-leave-active {
  transition: opacity 0.18s ease;
}
.htp-tooltip-fade-enter-from,
.htp-tooltip-fade-leave-to {
  opacity: 0;
}
</style>

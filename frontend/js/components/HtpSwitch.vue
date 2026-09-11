<script setup>
/**
 * HtpSwitch - 开关切换组件
 * v-model 绑定布尔值；支持禁用与尺寸
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' }, // sm | md
});
const emit = defineEmits(['update:modelValue']);

function toggle() {
  if (props.disabled) return;
  emit('update:modelValue', !props.modelValue);
}
</script>

<template>
  <button
    type="button"
    class="htp-switch"
    :class="[`htp-switch--${size}`, { 'htp-switch--on': modelValue, 'htp-switch--disabled': disabled }]"
    role="switch"
    :aria-checked="String(modelValue)"
    :disabled="disabled"
    @click="toggle"
  >
    <span class="htp-switch__thumb"></span>
  </button>
</template>

<style scoped>
.htp-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  cursor: pointer;
  padding: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.htp-switch--md {
  width: 44px;
  height: 24px;
}
.htp-switch--sm {
  width: 34px;
  height: 19px;
}
.htp-switch__thumb {
  position: absolute;
  top: 50%;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  background: var(--color-on-primary);
  transform: translate(0, -50%);
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}
.htp-switch--sm .htp-switch__thumb {
  width: 14px;
  height: 14px;
  left: 2px;
}
.htp-switch--on {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.htp-switch--on .htp-switch__thumb {
  transform: translate(20px, -50%);
}
.htp-switch--sm.htp-switch--on .htp-switch__thumb {
  transform: translate(15px, -50%);
}
.htp-switch--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

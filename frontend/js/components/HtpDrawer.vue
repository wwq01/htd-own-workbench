<script setup>
/**
 * HtpDrawer - 侧边抽屉面板
 * v-model 控制显隐；side 决定从左/右滑出；内容通过默认插槽传入
 * 遮罩点击关闭；Teleport 到 body 避免层级被父容器裁剪
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  side: { type: String, default: 'right' }, // right | left
  width: { type: String, default: '380px' },
});
const emit = defineEmits(['update:modelValue', 'close']);

function close() {
  emit('update:modelValue', false);
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="htp-drawer-fade">
      <div
        v-if="modelValue"
        class="htp-drawer__mask"
        @click.self="close"
      >
        <Transition :name="side === 'left' ? 'htp-drawer-left' : 'htp-drawer-right'">
          <aside
            v-if="modelValue"
            class="htp-drawer"
            :class="`htp-drawer--${side}`"
            :style="{ width }"
            role="dialog"
            aria-modal="true"
          >
            <header class="htp-drawer__head">
              <h3 class="htp-drawer__title">{{ title }}</h3>
              <button class="htp-drawer__close" type="button" aria-label="关闭" @click="close">
                ×
              </button>
            </header>
            <div class="htp-drawer__body">
              <slot />
            </div>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.htp-drawer__mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
}
.htp-drawer__mask.htp-drawer--right,
.htp-drawer__mask {
  justify-content: flex-end;
}
.htp-drawer--left {
  margin-right: auto;
}
.htp-drawer {
  height: 100%;
  max-width: 92vw;
  background: var(--bg-card);
  backdrop-filter: blur(12px) saturate(140%);
  border-left: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.3);
}
.htp-drawer--left {
  border-left: none;
  border-right: 1px solid var(--border-default);
  box-shadow: 8px 0 30px rgba(0, 0, 0, 0.3);
}
.htp-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-default);
}
.htp-drawer__title {
  margin: 0;
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 600;
}
.htp-drawer__close {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.2s ease;
}
.htp-drawer__close:hover {
  color: var(--text-primary);
}
.htp-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
  color: var(--text-secondary);
}
.htp-drawer-fade-enter-active,
.htp-drawer-fade-leave-active {
  transition: opacity 0.25s ease;
}
.htp-drawer-fade-enter-from,
.htp-drawer-fade-leave-to {
  opacity: 0;
}
.htp-drawer-right-enter-active,
.htp-drawer-right-leave-active,
.htp-drawer-left-enter-active,
.htp-drawer-left-leave-active {
  transition: transform 0.28s ease;
}
.htp-drawer-right-enter-from,
.htp-drawer-right-leave-to {
  transform: translateX(100%);
}
.htp-drawer-left-enter-from,
.htp-drawer-left-leave-to {
  transform: translateX(-100%);
}
</style>

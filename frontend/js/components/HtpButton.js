/**
 * HtpButton - 按钮组件
 * 支持：主按钮(primary)、次按钮(secondary)、危险按钮(danger)、文字按钮(text)
 */
const HtpButton = {
  name: 'HtpButton',
  props: {
    type: {
      type: String,
      default: 'primary', // primary | secondary | danger | text
    },
    size: {
      type: String,
      default: 'normal', // normal | sm
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  template: `
    <button
      class="htp-btn"
      :class="['htp-btn--' + type, size === 'sm' ? 'htp-btn--sm' : '']"
      :disabled="disabled"
      @click="$emit('click', $event)"
    >
      <slot></slot>
    </button>
  `,
};

window.HtpButton = HtpButton;

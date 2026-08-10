/**
 * HtpEmpty - 空状态提示组件
 */
const HtpEmpty = {
  name: 'HtpEmpty',
  props: {
    text: {
      type: String,
      default: '暂无数据',
    },
    icon: {
      type: String,
      default: '📭',
    },
  },
  template: `
    <div class="htp-empty">
      <div class="htp-empty__icon">{{ icon }}</div>
      <div class="htp-empty__text">{{ text }}</div>
      <slot></slot>
    </div>
  `,
};

window.HtpEmpty = HtpEmpty;

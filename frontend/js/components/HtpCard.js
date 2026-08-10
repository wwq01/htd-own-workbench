/**
 * HtpCard - 卡片容器组件
 */
const HtpCard = {
  name: 'HtpCard',
  props: {
    title: {
      type: String,
      default: '',
    },
    hover: {
      type: Boolean,
      default: false,
    },
  },
  template: `
    <div class="htp-card" :class="{ 'htp-card--hover': hover }">
      <div v-if="title || $slots.header" class="htp-card__header">
        <slot name="header">
          <span class="htp-card__title">{{ title }}</span>
        </slot>
        <slot name="action"></slot>
      </div>
      <slot></slot>
    </div>
  `,
};

window.HtpCard = HtpCard;

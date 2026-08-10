/**
 * HtpTag - 状态标签组件
 * 支持：default、primary、success、warning、danger、info、purple、orange、cyan
 */
const HtpTag = {
  name: 'HtpTag',
  props: {
    type: {
      type: String,
      default: 'default', // default | primary | success | warning | danger | info | purple | orange | cyan
    },
  },
  template: `
    <span class="htp-tag" :class="'htp-tag--' + type">
      <slot></slot>
    </span>
  `,
};

/**
 * 项目阶段标签辅助函数
 * 根据阶段名返回对应的 tag type
 */
function getPhaseTagType(phase) {
  const map = {
    '需求沟通': 'default',
    '方案撰写': 'primary',
    'POC演示': 'purple',
    '投标答辩': 'orange',
    '交付跟进': 'cyan',
    '项目结项': 'success',
  };
  return map[phase] || 'default';
}

window.HtpTag = HtpTag;
window.getPhaseTagType = getPhaseTagType;

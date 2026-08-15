/**
 * StatusDot - 轻量状态指示点（4+ 态）
 * L1 行为：props 接收 status + label，根元素带 role=status + aria-live 无障碍属性
 * L2 装饰：4 态颜色读 CSS 变量，pending 态脉冲动画（prefers-reduced-motion 时自动降级）
 * 落地：顶栏保存状态（§5.3.2）、备份状态（§5.1.7）
 */
const StatusDot = {
  name: 'StatusDot',
  props: {
    // idle 空闲 / pending 进行中 / success 成功 / error 失败 / warning 警告
    status: {
      type: String,
      default: 'idle',
    },
    label: {
      type: String,
      default: '',
    },
    // 是否允许 pending 态脉冲（关闭则纯色静态）
    pulse: {
      type: Boolean,
      default: true,
    },
    size: {
      type: Number,
      default: 10,
    },
  },
  computed: {
    dotClass() {
      return [
        'status-dot',
        `status-dot--${this.status}`,
        { 'status-dot--pulse': this.pulse && this.status === 'pending' },
      ];
    },
    ariaText() {
      const map = {
        idle: '空闲', pending: '进行中', success: '成功', error: '失败', warning: '警告',
      };
      return this.label || map[this.status] || '状态';
    },
  },
  template: `
    <span class="status-dot-wrap" role="status" aria-live="polite" :title="ariaText">
      <span :class="dotClass" :style="{ width: size + 'px', height: size + 'px' }"></span>
      <span v-if="label" class="status-dot__label">{{ label }}</span>
    </span>
  `,
};
window.StatusDot = StatusDot;

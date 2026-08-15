/**
 * HtpModal - 通用弹窗组件
 * 支持：标题、内容插槽、底部操作按钮、确认/取消回调
 */
const HtpModal = {
  name: 'HtpModal',
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      default: '',
    },
    width: {
      type: String,
      default: '500px',
    },
    showFooter: {
      type: Boolean,
      default: true,
    },
    confirmText: {
      type: String,
      default: '确认',
    },
    cancelText: {
      type: String,
      default: '取消',
    },
    confirmLoading: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:visible', 'confirm', 'cancel'],
  template: `
    <teleport to="body">
      <div v-if="visible" class="htp-modal-overlay" @click.self="handleOverlayClick">
        <div class="htp-modal" :style="{ width: width }">
          <div class="htp-modal__header">
            <span class="htp-modal__title">{{ title }}</span>
            <button class="htp-modal__close" @click="handleClose">&times;</button>
          </div>
          <div class="htp-modal__body">
            <slot></slot>
          </div>
          <div v-if="showFooter" class="htp-modal__footer">
            <slot name="footer">
              <button class="htp-btn htp-btn--secondary" @click="handleClose">{{ cancelText }}</button>
              <button class="htp-btn htp-btn--primary" :disabled="confirmLoading" @click="handleConfirm">
                {{ confirmLoading ? '处理中...' : confirmText }}
              </button>
            </slot>
          </div>
        </div>
      </div>
    </teleport>
  `,
  methods: {
    handleClose() {
      this.$emit('update:visible', false);
      this.$emit('cancel');
    },
    handleConfirm() {
      this.$emit('confirm');
    },
    handleOverlayClick() {
      // 点击遮罩不关闭，防止误操作丢失数据
      // 如需点击遮罩关闭，取消下面注释
      // this.handleClose();
    },
  },
};

window.HtpModal = HtpModal;

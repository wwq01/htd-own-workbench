/**
 * ConfirmPermanentDelete - 永久删除二次确认（回收站三段式 · 第三段）
 * L1 行为：Modal 内「勾选我确认此操作不可撤销」+ 输入 DELETE 才激活确认按钮
 * 复用 HtpModal 组件，纯前端二次确认；软删除/回收站视图留 V1.3（需各模块 deletedAt 迁移）
 * 用法：<confirm-permanent-delete :visible="x" item-name="xxx" @confirm="doDelete" @cancel="x=false" />
 */
const ConfirmPermanentDelete = {
  name: 'ConfirmPermanentDelete',
  props: {
    visible: { type: Boolean, default: false },
    itemName: { type: String, default: '' },
    requireText: { type: String, default: 'DELETE' },
    confirmText: { type: String, default: '永久删除' },
    title: { type: String, default: '确认永久删除？' },
  },
  emits: ['update:visible', 'confirm', 'cancel'],
  setup(props, { emit }) {
    const checked = Vue.ref(false);
    const typed = Vue.ref('');
    const canConfirm = Vue.computed(() => checked.value && typed.value === props.requireText);

    function reset() {
      checked.value = false;
      typed.value = '';
    }
    function handleClose() {
      reset();
      emit('cancel');
      emit('update:visible', false);
    }
    function handleConfirm() {
      if (!canConfirm.value) return;
      emit('confirm');
      reset();
    }
    return { checked, typed, canConfirm, handleClose, handleConfirm };
  },
  template: `
    <htp-modal v-if="visible" :visible="true" :title="title" width="480px" @cancel="handleClose">
      <p style="color: var(--color-danger); font-weight: 600;">此操作不可撤销，确认后数据将<b>永久删除</b>，无法从回收站恢复。</p>
      <p v-if="itemName" class="mt-sm">目标对象：<strong style="color: var(--text-primary);">{{ itemName }}</strong></p>
      <label class="htp-checkbox mt-base">
        <input type="checkbox" class="htp-checkbox__input" v-model="checked" />
        <span class="htp-checkbox__label">我确认此操作不可撤销</span>
      </label>
      <div class="mt-base">
        <label class="form-label">请手动输入
          <code style="color: var(--color-danger); font-weight: 700;">{{ requireText }}</code>
          以激活删除按钮
        </label>
        <input class="htp-input" v-model="typed" :placeholder="requireText" />
      </div>
      <template #footer>
        <button class="htp-btn htp-btn--secondary" @click="handleClose">取消</button>
        <button class="htp-btn htp-btn--danger" :disabled="!canConfirm" @click="handleConfirm">{{ confirmText }}</button>
      </template>
    </htp-modal>
  `,
};
window.ConfirmPermanentDelete = ConfirmPermanentDelete;

/**
 * HtpCheckbox - 复选框组件
 */
const HtpCheckbox = {
  name: 'HtpCheckbox',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    label: {
      type: String,
      default: '',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'change'],
  computed: {
    checked: {
      get() {
        return this.modelValue;
      },
      set(val) {
        this.$emit('update:modelValue', val);
        this.$emit('change', val);
      },
    },
  },
  template: `
    <label class="htp-checkbox" :class="{ 'cursor-not-allowed': disabled }">
      <input
        type="checkbox"
        v-model="checked"
        :disabled="disabled"
        class="htp-checkbox__input"
      />
      <span v-if="label" class="htp-checkbox__label">{{ label }}</span>
      <slot v-else></slot>
    </label>
  `,
};

window.HtpCheckbox = HtpCheckbox;

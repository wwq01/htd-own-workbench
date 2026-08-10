/**
 * HtpInput - 输入框组件
 * 支持：文本输入、密码、数字、日期
 */
const HtpInput = {
  name: 'HtpInput',
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
    type: {
      type: String,
      default: 'text', // text | password | number | date
    },
    placeholder: {
      type: String,
      default: '',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    max: {
      type: [String, Number],
      default: undefined,
    },
  },
  emits: ['update:modelValue', 'blur', 'enter'],
  computed: {
    value: {
      get() {
        return this.modelValue;
      },
      set(val) {
        this.$emit('update:modelValue', val);
      },
    },
  },
  template: `
    <input
      v-model="value"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :max="max"
      class="htp-input"
      @blur="$emit('blur', $event)"
      @keyup.enter="$emit('enter', $event)"
    />
  `,
};

window.HtpInput = HtpInput;

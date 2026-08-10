/**
 * HtpTextarea - 多行文本框组件
 * （预留通用组件，已在 app.js 中注册）
 */
const HtpTextarea = {
  name: 'HtpTextarea',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    rows: { type: [Number, String], default: 4 },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'change', 'blur'],
  setup(props, { emit }) {
    function onInput(e) {
      emit('update:modelValue', e.target.value);
    }
    function onChange(e) {
      emit('change', e.target.value);
    }
    function onBlur(e) {
      emit('blur', e.target.value);
    }
    return { onInput, onChange, onBlur };
  },
  template: `
    <textarea
      class="htp-textarea"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :value="modelValue"
      @input="onInput"
      @change="onChange"
      @blur="onBlur"
    ></textarea>
  `,
};

window.HtpTextarea = HtpTextarea;

/**
 * HtpSelect - 自定义下拉单选框组件（Liquid Glass 风格）
 *
 * 从原生 <select> 重构为完全自定义渲染，解决：
 *   1. 原生 option 下拉面板无法样式化（操作系统级控件）
 *   2. 与 Liquid Glass 毛玻璃视觉体系不兼容
 *
 * 交互：点击触发器切换面板 / 点击选项选中并关闭 / 点击外部关闭
 * 键盘：↑↓ 导航 / Enter 选中 / Esc 关闭
 */
const HtpSelect = {
  name: 'HtpSelect',
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
    options: {
      type: Array,
      default: function () { return []; }, // [{ label: '选项A', value: 'a' }]
    },
    placeholder: {
      type: String,
      default: '请选择',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'change'],
  data: function () {
    return {
      isOpen: false,
      focusedIndex: -1,
    };
  },
  computed: {
    selectedLabel: function () {
      var _this = this;
      var found = this.options.find(function (o) { return o.value === _this.modelValue; });
      return found ? found.label : '';
    },
    displayText: function () {
      return this.selectedLabel || this.placeholder;
    },
    isPlaceholder: function () {
      return !this.selectedLabel;
    },
  },
  mounted: function () {
    this._closeHandler = this.handleOutsideClick.bind(this);
    document.addEventListener('click', this._closeHandler);
  },
  beforeUnmount: function () {
    document.removeEventListener('click', this._closeHandler);
  },
  methods: {
    toggle: function () {
      if (this.disabled) return;
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.focusedIndex = this.modelValue
          ? this.options.findIndex(function (o) { return o.value === this.modelValue; }.bind(this))
          : -1;
      }
    },
    close: function () {
      this.isOpen = false;
      this.focusedIndex = -1;
    },
    selectOption: function (opt) {
      if (this.disabled) return;
      this.$emit('update:modelValue', opt.value);
      this.$emit('change', opt.value);
      this.close();
    },
    handleTriggerKeydown: function (e) {
      if (this.disabled) return;
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          this.toggle();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!this.isOpen) { this.isOpen = true; }
          this.moveFocus(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!this.isOpen) { this.isOpen = true; }
          this.moveFocus(-1);
          break;
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
      }
    },
    moveFocus: function (delta) {
      var len = this.options.length;
      if (len === 0) return;
      if (this.focusedIndex < 0) {
        this.focusedIndex = delta > 0 ? 0 : len - 1;
      } else {
        this.focusedIndex = Math.max(-1, Math.min(len - 1, this.focusedIndex + delta));
      }
    },
    handlePanelKeydown: function (e) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.moveFocus(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.moveFocus(-1);
          break;
        case 'Enter':
          e.preventDefault();
          if (this.focusedIndex >= 0 && this.focusedIndex < this.options.length) {
            this.selectOption(this.options[this.focusedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          this.close();
          this.$refs.trigger.focus();
          break;
      }
    },
    handleOutsideClick: function (e) {
      if (!this.$el.contains(e.target)) {
        this.close();
      }
    },
    focusItem: function (index) {
      this.focusedIndex = index;
    },
  },
  template: '\
    <div \
      class="htp-select-wrap" \
      :class="{\
        \'htp-select--open\': isOpen,\
        \'htp-select--disabled\': disabled,\
        \'htp-select--placeholder\': isPlaceholder && !isOpen\
      }"\
    >\
      <div\
        ref="trigger"\
        class="htp-select__trigger"\
        :tabindex="disabled ? -1 : 0"\
        role="combobox"\
        :aria-expanded="isOpen"\
        :aria-disabled="disabled"\
        @click="toggle"\
        @keydown="handleTriggerKeydown"\
      >\
        <span class="htp-select__label">{{ displayText }}</span>\
        <svg class="htp-select__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\
          <path d="M6 9l6 6 6-6" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\
        </svg>\
      </div>\
      <ul\
        v-if="isOpen"\
        ref="panel"\
        class="htp-select__panel"\
        role="listbox"\
        @keydown="handlePanelKeydown"\
      >\
        <li\
          v-for="(opt, index) in options"\
          :key="opt.value"\
          class="htp-select__opt"\
          :class="{\
            \'htp-select__opt--focused\' : index === focusedIndex,\
            \'htp-select__opt--selected\' : opt.value === modelValue\
          }"\
          role="option"\
          :aria-selected="opt.value === modelValue"\
          @click.stop="selectOption(opt)"\
          @mousemove="focusItem(index)"\
        >\
          <svg\
            v-if="opt.value === modelValue"\
            class="htp-select__check"\
            width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"\
          >\
            <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="#3D6EFF" fill-opacity="0.15" stroke="#3D6EFF" stroke-width="1.5"/>\
            <path d="M7 12l3 3 7-7" stroke="#3D6EFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\
          </svg>\
          <span class="htp-select__opt-label">{{ opt.label }}</span>\
        </li>\
      </ul>\
    </div>',
};

window.HtpSelect = HtpSelect;

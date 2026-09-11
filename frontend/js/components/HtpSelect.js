/**
 * HtpSelect - 自定义下拉单选框组件（Liquid Glass 风格）
 *
 * 从原生 <select> 重构为完全自定义渲染，解决：
 *   1. 原生 option 下拉面板无法样式化（操作系统级控件）
 *   2. 与 Liquid Glass 毛玻璃视觉体系不兼容
 *
 * 层叠修复（V1.2.1）：
 *   原面板 position:absolute 挂在组件内，会被外层玻璃卡片的 backdrop-filter 层叠上下文
 *   困住，溢出后被后续兄弟卡片盖住（"下拉框在别的框下面"）。改为 teleport 到 body +
 *   position:fixed 按触发器坐标定位，彻底脱离任何祖先层叠上下文与 overflow 裁切。
 *
 * 交互：点击触发器切换面板 / 点击选项选中并关闭 / 点击外部关闭
 * 键盘：↑↓ 导航 / Enter 选中（展开态）/ Esc 关闭
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
      // 面板固定定位坐标（teleport 到 body 后用 position:fixed 贴住触发器）
      panelStyle: {
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: 'auto',
        zIndex: '9999',
      },
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
    this.removeRepositionListeners();
  },
  methods: {
    open: function () {
      if (this.disabled || this.isOpen) return;
      this.isOpen = true;
      this.focusedIndex = this.modelValue
        ? this.options.findIndex(function (o) { return o.value === this.modelValue; }.bind(this))
        : -1;
      this.updatePanelPosition();
      this.addRepositionListeners();
    },
    toggle: function () {
      if (this.disabled) return;
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    },
    close: function () {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.focusedIndex = -1;
      this.removeRepositionListeners();
    },
    selectOption: function (opt) {
      if (this.disabled) return;
      this.$emit('update:modelValue', opt.value);
      this.$emit('change', opt.value);
      this.close();
    },
    // 按触发器在视口中的位置计算面板固定坐标
    updatePanelPosition: function () {
      if (!this.isOpen || !this.$refs.trigger) return;
      var rect = this.$refs.trigger.getBoundingClientRect();
      this.panelStyle = {
        position: 'fixed',
        top: (rect.bottom + 6) + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
        zIndex: '9999',
      };
    },
    // 页面/弹窗滚动、窗口缩放时让面板始终贴住触发器
    addRepositionListeners: function () {
      this._reposition = this.updatePanelPosition.bind(this);
      window.addEventListener('scroll', this._reposition, true);
      window.addEventListener('resize', this._reposition);
    },
    removeRepositionListeners: function () {
      if (this._reposition) {
        window.removeEventListener('scroll', this._reposition, true);
        window.removeEventListener('resize', this._reposition);
        this._reposition = null;
      }
    },
    handleTriggerKeydown: function (e) {
      if (this.disabled) return;
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          // 展开态下 Enter 直接选中高亮项（修复此前 Enter 误关闭）
          if (this.isOpen && this.focusedIndex >= 0 && this.focusedIndex < this.options.length) {
            this.selectOption(this.options[this.focusedIndex]);
          } else {
            this.toggle();
          }
          break;
        case ' ':
          e.preventDefault();
          this.toggle();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!this.isOpen) { this.open(); }
          this.moveFocus(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!this.isOpen) { this.open(); }
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
      // 面板已 teleport 到 body，不在 $el 内，需单独判断
      if (this.$el.contains(e.target)) return;
      if (this.$refs.panel && this.$refs.panel.contains(e.target)) return;
      this.close();
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
          <path d="M6 9l6 6 6-6" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\
        </svg>\
      </div>\
      <teleport to="body">\
        <ul\
          v-if="isOpen"\
          ref="panel"\
          class="htp-select__panel"\
          :style="panelStyle"\
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
              <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="var(--color-primary)" fill-opacity="0.15" stroke="var(--color-primary)" stroke-width="1.5"/>\
              <path d="M7 12l3 3 7-7" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\
            </svg>\
            <span class="htp-select__opt-label">{{ opt.label }}</span>\
          </li>\
        </ul>\
      </teleport>\
    </div>',
};

window.HtpSelect = HtpSelect;

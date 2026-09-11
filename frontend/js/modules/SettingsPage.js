/**
 * SettingsPage - 系统设置
 */
const SETTINGS_THEME_OPTIONS = [
  { label: '深色模式', value: 'dark' },
  { label: '浅色模式', value: 'light' },
];
const APPEARANCE_OPTIONS = [
  { label: 'Liquid Glass（玻璃质感 · 默认）', value: 'liquid-glass' },
  { label: 'Notion 极简平铺', value: 'notion-flat' },
];
const BACKUP_FREQUENCY_OPTIONS = [
  { label: '每次启动', value: 'startup' },
  { label: '每天最多一次', value: 'daily' },
  { label: '每周最多一次', value: 'weekly' },
  { label: '仅手动备份', value: 'manual' },
];

const SettingsPage = {
  name: 'SettingsPage',
  setup() {
    const appStore = useAppStore();
    const loading = Vue.ref(false);
    const saving = Vue.ref(false);
    const form = Vue.reactive({
      theme: 'dark',
      appearance: 'liquid-glass',
      decoration: 'on',
      dataRoot: '',
      backupFrequency: 'startup',
      maxBackups: 7,
    });

    async function loadSettings() {
      loading.value = true;
      try {
        const data = await htdApi.get('/system/settings');
        Object.assign(form, data);
        form.appearance = data.appearance || 'liquid-glass';
        form.decoration = data.decoration || 'on';
        appStore.applyAppearance({ theme: data.theme, appearance: form.appearance, decoration: form.decoration });
      } catch (e) {
        // 请求封装已提示错误
      } finally {
        loading.value = false;
      }
    }

    async function saveSettings() {
      if (!form.dataRoot.trim()) {
        showToast('数据路径不能为空', 'warning');
        return;
      }
      saving.value = true;
      try {
        const data = await appStore.saveSettings({
          theme: form.theme,
          appearance: form.appearance,
          decoration: form.appearance === 'notion-flat' ? 'off' : form.decoration,
          dataRoot: form.dataRoot.trim(),
          backupFrequency: form.backupFrequency,
          maxBackups: Number(form.maxBackups),
        });
        Object.assign(form, data);
        showToast(data.restartRequired ? '设置已保存，数据路径将在重启后生效' : '设置已保存', 'success');
      } catch (e) {
        // 请求封装已提示错误
      } finally {
        saving.value = false;
      }
    }

    // 装饰仅 liquid-glass 生效；notion-flat 强制关闭
    const decorationApplicable = Vue.computed(() => form.appearance === 'liquid-glass');
    const decorationOn = Vue.computed({
      get: () => form.decoration === 'on',
      set: (val) => { form.decoration = val ? 'on' : 'off'; },
    });

    function applyThemePreview(theme) {
      appStore.applyTheme(theme);
    }

    // 外观 / 装饰实时预览（仅改 <html> data 属性，不落库）
    function applyAppearancePreview() {
      appStore.applyAppearance({
        theme: form.theme,
        appearance: form.appearance,
        decoration: form.appearance === 'notion-flat' ? 'off' : form.decoration,
      });
    }

    // ---- §8.3 字段 / 状态机配置 ----
    const DROPDOWN_SCOPES = [
      { label: '项目阶段', value: 'project.phase' },
      { label: '项目安全领域', value: 'project.securityDomain' },
      { label: '阅读类型', value: 'reading.type' },
      { label: '待办分类', value: 'todo.category' },
    ];
    const CUSTOM_FIELD_SCOPES = [
      { label: '阅读资料', value: 'reading' },
      { label: '项目', value: 'project' },
    ];
    const STATE_MACHINE_SCOPES = [
      { label: '阅读状态', value: 'reading.status' },
      { label: '项目阶段', value: 'project.phase' },
    ];
    const CUSTOM_FIELD_TYPES = [
      { label: '单行文本', value: 'single_line' },
      { label: '多行文本', value: 'multi_line' },
    ];

    const fieldConfig = Vue.ref(null);
    const fcLoading = Vue.ref(false);
    const fcSaving = Vue.ref(false);
    const dropdownScope = Vue.ref('project.phase');
    const newDropdownValue = Vue.ref('');
    const cfScope = Vue.ref('reading');
    const newField = Vue.reactive({ key: '', label: '', type: 'single_line' });
    const smScope = Vue.ref('project.phase');

    async function loadFieldConfig() {
      fcLoading.value = true;
      try {
        fieldConfig.value = await htdApi.get('/system/field-config');
      } catch (e) {
        // 请求封装已提示错误
      } finally {
        fcLoading.value = false;
      }
    }

    // 下拉项
    const currentDropdown = Vue.computed(() => {
      if (!fieldConfig.value) return [];
      const d = fieldConfig.value.dropdowns;
      return (d && d[dropdownScope.value]) ? d[dropdownScope.value] : [];
    });

    function addDropdownValue() {
      const v = String(newDropdownValue.value || '').trim();
      if (!v) { showToast('请输入下拉项名称', 'warning'); return; }
      if (currentDropdown.value.indexOf(v) >= 0) { showToast('该下拉项已存在', 'warning'); return; }
      if (!fieldConfig.value.dropdowns) fieldConfig.value.dropdowns = {};
      fieldConfig.value.dropdowns[dropdownScope.value] = currentDropdown.value.concat([v]);
      newDropdownValue.value = '';
    }

    function removeDropdownValue(v) {
      if (!fieldConfig.value || !fieldConfig.value.dropdowns) return;
      fieldConfig.value.dropdowns[dropdownScope.value] =
        currentDropdown.value.filter(x => x !== v);
    }

    // 自定义扩展字段
    const currentCustomFields = Vue.computed(() => {
      if (!fieldConfig.value) return [];
      const c = fieldConfig.value.customFields;
      return (c && c[cfScope.value]) ? c[cfScope.value] : [];
    });

    function addCustomField() {
      const key = String(newField.key || '').trim();
      const label = String(newField.label || '').trim();
      if (!key || !label) { showToast('字段标识与显示名均不能为空', 'warning'); return; }
      if (currentCustomFields.value.some(f => f.key === key)) {
        showToast('该字段标识已存在', 'warning');
        return;
      }
      if (!fieldConfig.value.customFields) fieldConfig.value.customFields = {};
      fieldConfig.value.customFields[cfScope.value] =
        currentCustomFields.value.concat([{ key, label, type: newField.type }]);
      newField.key = '';
      newField.label = '';
      newField.type = 'single_line';
    }

    function removeCustomField(key) {
      if (!fieldConfig.value || !fieldConfig.value.customFields) return;
      fieldConfig.value.customFields[cfScope.value] =
        currentCustomFields.value.filter(f => f.key !== key);
    }

    // 状态机迁移规则
    const currentStateMachine = Vue.computed(() => {
      if (!fieldConfig.value) return null;
      const s = fieldConfig.value.stateMachines;
      return (s && s[smScope.value]) ? s[smScope.value] : null;
    });

    const smStates = Vue.computed(() => {
      const sm = currentStateMachine.value;
      return (sm && sm.states) ? sm.states : [];
    });

    function smTargets(from) {
      const sm = currentStateMachine.value;
      if (!sm || !sm.transitions) return [];
      return sm.transitions[from] || [];
    }

    function isTransitionAllowed(from, to) {
      return smTargets(from).indexOf(to) >= 0;
    }

    function toggleTransition(from, to) {
      const sm = currentStateMachine.value;
      if (!sm) return;
      if (!sm.transitions) sm.transitions = {};
      const list = sm.transitions[from] || [];
      const idx = list.indexOf(to);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(to);
      sm.transitions[from] = list;
    }

    async function saveFieldConfig() {
      fcSaving.value = true;
      try {
        const saved = await htdApi.put('/system/field-config', {
          dropdowns: fieldConfig.value.dropdowns,
          customFields: fieldConfig.value.customFields,
          stateMachines: fieldConfig.value.stateMachines,
        });
        fieldConfig.value = saved;
        showToast('字段与状态机配置已保存', 'success');
      } catch (e) {
        // 请求封装已提示错误
      } finally {
        fcSaving.value = false;
      }
    }

    Vue.onMounted(() => {
      loadSettings();
      loadFieldConfig();
    });

    return {
      form, loading, saving,
      SETTINGS_THEME_OPTIONS, BACKUP_FREQUENCY_OPTIONS, APPEARANCE_OPTIONS,
      decorationApplicable, decorationOn,
      loadSettings, saveSettings, applyThemePreview, applyAppearancePreview,
      fieldConfig, fcLoading, fcSaving,
      DROPDOWN_SCOPES, CUSTOM_FIELD_SCOPES, STATE_MACHINE_SCOPES, CUSTOM_FIELD_TYPES,
      dropdownScope, newDropdownValue, currentDropdown, addDropdownValue, removeDropdownValue,
      cfScope, newField, currentCustomFields, addCustomField, removeCustomField,
      smScope, smStates, isTransitionAllowed, toggleTransition,
      loadFieldConfig, saveFieldConfig,
    };
  },
  template: `
    <div class="list-page settings-page">
      <div class="htp-card">
        <div class="htp-card__header">
          <div>
            <div class="htp-card__title">系统设置</div>
            <div class="text-tertiary" style="margin-top: 4px;">设置保存在本机，不会上传到任何外部服务。</div>
          </div>
          <button class="htp-btn htp-btn--primary" :disabled="loading || saving" @click="saveSettings">{{ saving ? '保存中...' : '保存设置' }}</button>
        </div>

        <div v-if="loading" class="text-tertiary" style="padding: 24px 0;">正在读取设置...</div>
        <div v-else class="settings-form">
          <div class="settings-form__row">
            <div>
              <label class="form-label">外观风格</label>
              <div class="text-tertiary">选择工作台的表面材质（玻璃质感或极简平铺）。</div>
            </div>
            <htp-select v-model="form.appearance" :options="APPEARANCE_OPTIONS" placeholder="选择外观" @update:modelValue="applyAppearancePreview"></htp-select>
          </div>

          <div class="settings-form__row">
            <div>
              <label class="form-label">颜色主题</label>
              <div class="text-tertiary">立即切换工作台的深色 / 浅色配色。</div>
            </div>
            <htp-select v-model="form.theme" :options="SETTINGS_THEME_OPTIONS" placeholder="选择主题" @update:modelValue="applyThemePreview"></htp-select>
          </div>

          <div class="settings-form__row">
            <div>
              <label class="form-label">装饰效果</label>
              <div class="text-tertiary">{{ decorationApplicable ? '开启背景光斑等装饰性视觉元素。' : '极简平铺外观不支持装饰，已自动关闭。' }}</div>
            </div>
            <htp-checkbox v-model="decorationOn" :disabled="!decorationApplicable" @change="applyAppearancePreview"></htp-checkbox>
          </div>

          <div class="settings-form__row">
            <div>
              <label class="form-label">数据路径</label>
              <div class="text-tertiary">修改后需要重启服务生效。</div>
            </div>
            <input class="htp-input settings-form__path" v-model="form.dataRoot" placeholder="例如：D:\\荒天帝工作台" />
          </div>

          <div class="settings-form__row">
            <div>
              <label class="form-label">自动备份频率</label>
              <div class="text-tertiary">控制服务启动时是否自动生成 SQLite 备份。</div>
            </div>
            <htp-select v-model="form.backupFrequency" :options="BACKUP_FREQUENCY_OPTIONS" placeholder="选择频率"></htp-select>
          </div>

          <div class="settings-form__row">
            <div>
              <label class="form-label">备份保留份数</label>
              <div class="text-tertiary">最多保留 30 份，超出后自动删除最旧文件。</div>
            </div>
            <input class="htp-input settings-form__number" type="number" min="1" max="30" v-model="form.maxBackups" />
          </div>
        </div>
      </div>

      <div class="htp-card mt-base">
        <div class="htp-card__header">
          <div>
            <div class="htp-card__title">字段与状态机配置</div>
            <div class="text-tertiary" style="margin-top: 4px;">自定义下拉项、扩展字段与状态迁移规则，保存后对新建与状态切换立即生效。</div>
          </div>
          <button class="htp-btn htp-btn--primary" :disabled="fcLoading || fcSaving || !fieldConfig" @click="saveFieldConfig">{{ fcSaving ? '保存中...' : '保存配置' }}</button>
        </div>

        <div v-if="fcLoading" class="text-tertiary" style="padding: 24px 0;">正在读取配置...</div>
        <div v-else-if="!fieldConfig" class="text-tertiary" style="padding: 24px 0;">配置暂不可用</div>
        <div v-else class="settings-form">
          <div class="settings-form__row">
            <div>
              <label class="form-label">自定义下拉项</label>
              <div class="text-tertiary">为模块下拉框增删可选项。已被既有记录使用的值不建议删除。</div>
            </div>
            <htp-select v-model="dropdownScope" :options="DROPDOWN_SCOPES" placeholder="选择范围"></htp-select>
          </div>

          <div class="settings-form__row">
            <div class="cfg-chips">
              <span v-for="v in currentDropdown" :key="v" class="cfg-chip">
                {{ v }}
                <button class="cfg-chip__x" type="button" @click="removeDropdownValue(v)" v-html="htdIcon('x', { size: 14 })"></button>
              </span>
              <span v-if="currentDropdown.length === 0" class="text-tertiary">暂无可选项</span>
            </div>
            <div class="cfg-add">
              <HtpInput v-model="newDropdownValue" placeholder="新增下拉项名称" @keyup.enter="addDropdownValue"  />
              <button class="htp-btn htp-btn--sm" type="button" @click="addDropdownValue">添加</button>
            </div>
          </div>

          <div class="settings-form__row">
            <div>
              <label class="form-label">自定义扩展字段</label>
              <div class="text-tertiary">为模块补充单行 / 多行文本字段，在编辑表单中录入。</div>
            </div>
            <htp-select v-model="cfScope" :options="CUSTOM_FIELD_SCOPES" placeholder="选择模块"></htp-select>
          </div>

          <div class="settings-form__row">
            <div v-if="currentCustomFields.length > 0" class="cfg-table">
              <div v-for="f in currentCustomFields" :key="f.key" class="cfg-table__row">
                <span class="cfg-table__key">{{ f.key }}</span>
                <span>{{ f.label }}</span>
                <span class="text-tertiary">{{ f.type === 'multi_line' ? '多行文本' : '单行文本' }}</span>
                <button class="htp-btn htp-btn--sm" type="button" @click="removeCustomField(f.key)">删除</button>
              </div>
            </div>
            <span v-else class="text-tertiary">该模块暂无自定义字段</span>
            <div class="cfg-add">
              <HtpInput v-model="newField.key" placeholder="字段标识"  />
              <HtpInput v-model="newField.label" placeholder="显示名称"  />
              <htp-select v-model="newField.type" :options="CUSTOM_FIELD_TYPES" placeholder="字段类型"></htp-select>
              <button class="htp-btn htp-btn--sm" type="button" @click="addCustomField">添加字段</button>
            </div>
          </div>

          <div class="settings-form__row">
            <div>
              <label class="form-label">状态机迁移规则</label>
              <div class="text-tertiary">勾选「从某状态」允许迁移到的「目标状态」。</div>
            </div>
            <htp-select v-model="smScope" :options="STATE_MACHINE_SCOPES" placeholder="选择状态机"></htp-select>
          </div>

          <div class="settings-form__row">
            <div v-if="smStates.length > 0" class="cfg-matrix">
              <div class="cfg-matrix__row">
                <div class="cfg-matrix__cell cfg-matrix__cell--corner">从 \ 到</div>
                <div v-for="t in smStates" :key="t" class="cfg-matrix__cell cfg-matrix__cell--head">{{ t }}</div>
              </div>
              <div v-for="f in smStates" :key="f" class="cfg-matrix__row">
                <div class="cfg-matrix__cell cfg-matrix__cell--rowhead">{{ f }}</div>
                <div v-for="t in smStates" :key="t" class="cfg-matrix__cell">
                  <input type="checkbox" :checked="isTransitionAllowed(f, t)" @change="toggleTransition(f, t)" />
                </div>
              </div>
            </div>
            <span v-else class="text-tertiary">该状态机暂无状态</span>
          </div>
        </div>
      </div>
    </div>
  `,
};

window.SettingsPage = SettingsPage;

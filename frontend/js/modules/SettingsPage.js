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

    Vue.onMounted(loadSettings);

    return {
      form, loading, saving,
      SETTINGS_THEME_OPTIONS, BACKUP_FREQUENCY_OPTIONS, APPEARANCE_OPTIONS,
      decorationApplicable, decorationOn,
      loadSettings, saveSettings, applyThemePreview, applyAppearancePreview,
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
    </div>
  `,
};

window.SettingsPage = SettingsPage;

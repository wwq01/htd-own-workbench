/**
 * DataPage - 数据与部署页面（阶段 5 / V1.2 备份升级）
 * 标签1：工作部署记录（CRUD + 环境筛选 + 关键字搜索 + 一键复制命令）
 * 标签2：本APP数据管理（JSON 导出 / 导入 / 清空 / SQLite 整库备份恢复）
 */
const DEPLOY_ENV_OPTIONS = [
  { label: '演示环境', value: '演示环境' },
  { label: '测试环境', value: '测试环境' },
  { label: '生产环境', value: '生产环境' },
  { label: '本地环境', value: '本地环境' },
];
const DEPLOY_ENV_FILTER = [{ label: '全部环境', value: '' }, ...DEPLOY_ENV_OPTIONS];
const CLEAR_SCOPE_OPTIONS = [
  { label: '全部数据', value: 'all' },
  { label: '生活规划', value: 'life' },
  { label: '项目业务', value: 'business' },
  { label: '开发工作', value: 'development' },
  { label: '充电学习', value: 'study' },
  { label: '娱乐放松', value: 'entertainment' },
  { label: '复盘沉淀', value: 'review' },
  { label: '凭据保险箱', value: 'secret' },
  { label: '部署记录', value: 'deployment' },
];
const IMPORT_MODE_OPTIONS = [
  { label: '全量覆盖', value: 'full' },
  { label: '覆盖同 ID 数据', value: 'overwrite' },
  { label: '跳过同 ID 数据', value: 'skip' },
];

const DataPage = {
  name: 'DataPage',
  setup() {
    const dataStore = useDataStore();

    // ============ 标签切换 ============
    const activeTab = Vue.ref('deployment');
    function switchTab(tab) { activeTab.value = tab; }

    // ============ 本 APP 数据管理 ============
    const dataStats = Vue.ref([]);
    const dataLoading = Vue.ref(false);
    const importLoading = Vue.ref(false);
    const importConfirm = Vue.ref(null);
    const clearConfirm = Vue.ref(false);
    const clearPhrase = Vue.ref('');
    const clearScope = Vue.ref('all');
    const backups = Vue.ref([]);
    const backupLoading = Vue.ref(false);
    const backupDeleteConfirm = Vue.ref(null);

    // —— V1.2 备份升级 ——
    const backupNote = Vue.ref('');
    const backupNoteModalVisible = Vue.ref(false);
    const restoringName = Vue.ref(null);
    const restoreLoading = Vue.ref(false);
    const backupStatus = Vue.ref(null);
    const backupError = Vue.ref('');
    let backupStatusTimer = null;

    const backupStatusLabel = Vue.computed(() => {
      if (!backupStatus.value) return '';
      if (backupStatus.value.autoPaused) return '备份已暂停';
      const m = { idle: '', pending: '备份中', success: '已备份', saved: '已备份', error: '备份失败' };
      return m[backupStatus.value.status] || '';
    });

    async function loadDataStats() {
      dataLoading.value = true;
      try {
        await dataStore.fetchDataStats();
        dataStats.value = dataStore.dataStats;
      } finally {
        dataLoading.value = false;
      }
    }

    async function loadBackups() {
      backupLoading.value = true;
      try {
        const result = await htdApi.get('/system/backups');
        backups.value = Array.isArray(result) ? result : [];
      } catch (e) {
        backups.value = [];
      } finally {
        backupLoading.value = false;
      }
    }

    async function loadBackupStatus() {
      try {
        const s = await htdApi.get('/system/backups/status');
        backupStatus.value = s;
        backupError.value = s && s.error ? s.error : '';
      } catch (e) { /* 状态查询失败不阻塞 */ }
    }

    function startBackupStatusPoll() {
      stopBackupStatusPoll();
      backupStatusTimer = setInterval(loadBackupStatus, 8000);
    }
    function stopBackupStatusPoll() {
      if (backupStatusTimer) { clearInterval(backupStatusTimer); backupStatusTimer = null; }
    }

    // 打开「创建备份」备注 Modal
    function openBackupNoteModal() {
      backupNote.value = '';
      backupNoteModalVisible.value = true;
    }
    async function confirmCreateBackup() {
      try {
        const res = await htdApi.post('/system/backups/manual', { note: backupNote.value.trim() });
        backupNoteModalVisible.value = false;
        await loadBackups();
        await loadBackupStatus();
        showToast(`数据库备份成功：${res.fileName}`, 'success');
      } catch (e) {
        // 请求封装已显示错误
      }
    }

    function downloadDbBackup(item) {
      const link = document.createElement('a');
      link.href = `/api/v1/system/backups/${encodeURIComponent(item.fileName)}/download`;
      link.download = item.fileName;
      link.click();
    }

    async function confirmBackupDelete() {
      if (!backupDeleteConfirm.value) return;
      try {
        await htdApi.del(`/system/backups/${encodeURIComponent(backupDeleteConfirm.value.fileName)}`);
        backupDeleteConfirm.value = null;
        await loadBackups();
        showToast('备份文件已删除', 'success');
      } catch (e) {
        // 请求封装已显示错误
      }
    }

    // 恢复：先二次确认，再覆盖（后端自动先做安全快照）
    function requestRestore(item) { restoringName.value = item.fileName; }
    async function confirmRestore() {
      if (!restoringName.value) return;
      restoreLoading.value = true;
      try {
        const res = await htdApi.post(`/system/backups/restore/${encodeURIComponent(restoringName.value)}`);
        restoringName.value = null;
        await loadBackups();
        showToast(`已恢复备份，安全快照：${res.snapshot}`, 'success');
      } catch (e) {
        // 请求封装已显示错误
      } finally {
        restoreLoading.value = false;
      }
    }

    async function selectImportFile(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        if (!payload || typeof payload !== 'object' || !payload.version || !payload.tables) {
          throw new Error('文件不是有效的工作台备份格式');
        }
        importConfirm.value = { fileName: file.name, mode: 'full', payload: { ...payload, confirm: true, mode: 'full' } };
      } catch (e) {
        showToast(`导入文件无效：${e.message}`, 'error');
      }
    }

    async function confirmImport() {
      if (!importConfirm.value) return;
      importLoading.value = true;
      try {
        importConfirm.value.payload.mode = importConfirm.value.mode;
        const result = await htdApi.post('/system/data/import', importConfirm.value.payload);
        importConfirm.value = null;
        await dataStore.refreshAll();
        await loadDataStats();
        showToast(`数据导入成功，共恢复 ${result.importedCount || 0} 条记录`, 'success');
      } catch (e) {
        // 请求封装已显示错误
      } finally {
        importLoading.value = false;
      }
    }

    function requestClear() {
      clearPhrase.value = '';
      clearConfirm.value = true;
    }

    async function confirmClear() {
      if (!clearConfirm.value || clearPhrase.value !== '确认清空') return;
      try {
        const result = await htdApi.post('/system/data/clear', { confirm: true, confirmationText: clearPhrase.value, scope: clearScope.value });
        clearConfirm.value = false;
        await dataStore.refreshAll();
        await loadDataStats();
        showToast(`数据已清空，共删除 ${result.deletedCount || 0} 条记录`, 'success');
      } catch (e) {
        // 请求封装已显示错误
      }
    }

    Vue.watch(activeTab, (tab) => {
      if (tab === 'data') {
        loadDataStats();
        loadBackups();
        loadBackupStatus();
        startBackupStatusPoll();
      } else {
        stopBackupStatusPoll();
      }
    });

    // ============ 部署记录：列表 & 筛选 ============
    const deployList = Vue.ref([]);
    const deployLoading = Vue.ref(false);
    const filterEnv = Vue.ref('');
    const filterKeyword = Vue.ref('');

    async function loadDeployList() {
      deployLoading.value = true;
      try {
        const params = {};
        if (filterEnv.value) params.envType = filterEnv.value;
        if (filterKeyword.value) params.keyword = filterKeyword.value;
        const raw = await htdApi.get('/deployments', params);
        deployList.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        deployList.value = [];
      } finally {
        deployLoading.value = false;
      }
    }
    Vue.watch([filterEnv, filterKeyword], loadDeployList);
    Vue.onMounted(() => {
      loadDeployList();
      loadDataStats();
      loadBackups();
    });

    // ============ 部署记录：环境统计 ============
    const envStats = Vue.ref({});
    async function loadEnvStats() {
      try {
        envStats.value = await htdApi.get('/deployments/env-stats');
      } catch (e) { /* ignore */ }
    }
    Vue.onMounted(loadEnvStats);

    // ============ 部署记录：CRUD 弹窗 ============
    const deployModalVisible = Vue.ref(false);
    const deployEditing = Vue.ref(null);
    const deployFormTitle = Vue.computed(() => deployEditing.value ? '编辑部署记录' : '新增部署记录');
    const deployForm = Vue.reactive({
      name: '', envType: '测试环境', deviceType: '', ipAddress: '',
      config: '', steps: '', commands: '', remark: '',
    });

    function openDeployCreate() {
      deployEditing.value = null;
      Object.assign(deployForm, {
        name: '', envType: '测试环境', deviceType: '', ipAddress: '',
        config: '', steps: '', commands: '', remark: '',
      });
      deployModalVisible.value = true;
    }
    function openDeployEdit(item) {
      deployEditing.value = item;
      Object.assign(deployForm, {
        name: item.name || '',
        envType: item.envType || '测试环境',
        deviceType: item.deviceType || '',
        ipAddress: item.ipAddress || '',
        config: item.config || '',
        steps: item.steps || '',
        commands: item.commands || '',
        remark: item.remark || '',
      });
      deployModalVisible.value = true;
    }
    async function submitDeployForm() {
      const name = (deployForm.name || '').trim();
      if (!name) { showToast('环境名称不能为空', 'warning'); return; }
      const payload = {
        name,
        envType: deployForm.envType,
        deviceType: deployForm.deviceType || null,
        ipAddress: deployForm.ipAddress || null,
        config: deployForm.config || null,
        steps: deployForm.steps || null,
        commands: deployForm.commands || null,
        remark: deployForm.remark || null,
      };
      try {
        if (deployEditing.value) {
          await dataStore.updateDeployment(deployEditing.value.id, payload);
        } else {
          await dataStore.createDeployment(payload);
        }
        deployModalVisible.value = false;
        await loadDeployList();
        await loadEnvStats();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 部署记录：删除二次确认 ============
    const deployDelConfirm = Vue.ref(null);
    function requestDeployDelete(item) { deployDelConfirm.value = item; }
    async function confirmDeployDelete() {
      if (!deployDelConfirm.value) return;
      try {
        await dataStore.deleteDeployment(deployDelConfirm.value.id);
        deployDelConfirm.value = null;
        await loadDeployList();
        await loadEnvStats();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 辅助 ============
    function envTagType(env) {
      if (env === '生产环境') return 'danger';
      if (env === '演示环境') return 'warning';
      if (env === '测试环境') return 'info';
      return 'default';
    }
    function envIcon(env) {
      const map = { '演示环境': 'presentation', '测试环境': 'flask', '生产环境': 'rocket', '本地环境': 'laptop' };
      return window.htdIcon(map[env] || 'package', { size: 16 });
    }
    async function copyText(text, label) {
      if (!text) { showToast('内容为空', 'warning'); return; }
      const ok = await htdCopy.copyToClipboard(text);
      showToast(ok ? `已复制：${label}` : '复制失败', ok ? 'success' : 'error');
    }

    Vue.onUnmounted(() => stopBackupStatusPoll());

    // —— 导出数据 ——
    async function exportData() {
      try {
        const response = await fetch('/api/v1/system/data/export', { cache: 'no-store' });
        const body = await response.json();
        if (body.code !== 0) throw new Error(body.msg || '导出失败');
        const blob = new Blob([JSON.stringify(body.data, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `huangtiandi-workbench-backup-${stamp}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('数据导出成功', 'success');
      } catch (e) {
        showToast(`数据导出失败：${e.message}`, 'error');
      }
    }

    return {
      activeTab, switchTab,
      // 部署记录
      deployList, deployLoading,
      filterEnv, filterKeyword,
      loadDeployList, loadEnvStats, envStats,
      deployModalVisible, deployEditing, deployFormTitle, deployForm,
      openDeployCreate, openDeployEdit, submitDeployForm,
      deployDelConfirm, requestDeployDelete, confirmDeployDelete,
      envTagType, envIcon, copyText,
      DEPLOY_ENV_FILTER, DEPLOY_ENV_OPTIONS,
      dataStore,
      dataStats, dataLoading, importLoading,
      importConfirm, clearConfirm, clearPhrase, clearScope,
      loadDataStats, exportData, selectImportFile, confirmImport, requestClear, confirmClear,
      CLEAR_SCOPE_OPTIONS, IMPORT_MODE_OPTIONS,
      backups, backupLoading, backupDeleteConfirm,
      loadBackups, downloadDbBackup, confirmBackupDelete,
      // V1.2 备份升级
      backupNote, backupNoteModalVisible, openBackupNoteModal, confirmCreateBackup,
      restoringName, restoreLoading, requestRestore, confirmRestore,
      backupStatus, backupError, backupStatusLabel,
    };
  },
  template: `
    <div class="list-page">
      <!-- 标签切换 -->
      <div class="htp-tabs">
        <button
          class="htp-tab"
          :class="{ 'htp-tab--active': activeTab === 'deployment' }"
          @click="switchTab('deployment')"
        >工作部署记录</button>
        <button
          class="htp-tab"
          :class="{ 'htp-tab--active': activeTab === 'data' }"
          @click="switchTab('data')"
        >本APP数据管理</button>
      </div>

      <!-- ====== 标签1：工作部署记录 ====== -->
      <div v-if="activeTab === 'deployment'">
        <!-- 环境统计 -->
        <div class="deploy-topbar">
          <div class="deploy-stats">
            <span class="deploy-stat-item" v-for="(count, key) in envStats" :key="key">
              <htp-tag :type="envTagType(key)"><span class="deploy-card__icon" v-html="envIcon(key)"></span> {{ key }}</htp-tag>
              <span class="deploy-stat-num">{{ count }}</span>
            </span>
          </div>
        </div>

        <!-- 筛选条 -->
        <div class="htp-filter-bar">
          <div class="htp-filter-bar__item">
            <htp-select v-model="filterEnv" :options="DEPLOY_ENV_FILTER" placeholder="全部环境"></htp-select>
          </div>
          <div class="htp-filter-bar__item" style="flex:1">
            <HtpInput v-model="filterKeyword" placeholder="名称/设备/IP/备注关键字搜索"  />
          </div>
          <button class="htp-btn htp-btn--primary htp-btn--sm" @click="openDeployCreate">+ 新增记录</button>
        </div>

        <!-- 空状态 -->
        <div v-if="deployList.length === 0 && !deployLoading" style="padding: 40px;">
          <htp-empty text="暂无部署记录，点击「新增」开始"></htp-empty>
        </div>

        <!-- 卡片列表 -->
        <div v-else class="deploy-list">
          <div class="deploy-card" v-for="item in deployList" :key="item.id">
            <div class="deploy-card__header">
              <span class="deploy-card__icon" v-html="envIcon(item.envType)"></span>
              <span class="deploy-card__name">{{ item.name }}</span>
              <htp-tag :type="envTagType(item.envType)">{{ item.envType }}</htp-tag>
            </div>
            <div class="deploy-card__body">
              <div v-if="item.deviceType" class="deploy-card__row">
                <span class="text-tertiary">设备：</span>{{ item.deviceType }}
              </div>
              <div v-if="item.ipAddress" class="deploy-card__row">
                <span class="text-tertiary">IP：</span>
                <code>{{ item.ipAddress }}</code>
                <button class="htp-btn htp-btn--text htp-btn--sm" @click="copyText(item.ipAddress, 'IP地址')">复制</button>
              </div>
              <div v-if="item.config" class="deploy-card__row">
                <span class="text-tertiary">配置：</span>
                <pre class="deploy-card__pre">{{ item.config }}</pre>
              </div>
              <div v-if="item.steps" class="deploy-card__row">
                <span class="text-tertiary">步骤：</span>
                <pre class="deploy-card__pre">{{ item.steps }}</pre>
              </div>
              <div v-if="item.commands" class="deploy-card__row">
                <span class="text-tertiary">命令：</span>
                <pre class="deploy-card__pre deploy-card__pre--code">{{ item.commands }}</pre>
                <button class="htp-btn htp-btn--text htp-btn--sm" @click="copyText(item.commands, '部署命令')">复制命令</button>
              </div>
              <div v-if="item.remark" class="deploy-card__row">
                <span class="text-tertiary">备注：</span>{{ item.remark }}
              </div>
            </div>
            <div class="deploy-card__actions">
              <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openDeployEdit(item)">编辑</button>
              <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestDeployDelete(item)">删除</button>
            </div>
          </div>
        </div>

        <!-- 新增/编辑弹窗 -->
        <htp-modal v-if="deployModalVisible" :visible="true" :title="deployFormTitle" @cancel="deployModalVisible = false" width="700px">
          <div class="form-grid">
            <div class="form-grid--full">
              <label class="form-label">环境名称 *</label>
              <HtpInput v-model="deployForm.name" placeholder="如：客户A-生产环境部署"  />
            </div>
            <div>
              <label class="form-label">环境类型</label>
              <htp-select v-model="deployForm.envType" :options="DEPLOY_ENV_OPTIONS" placeholder="请选择"></htp-select>
            </div>
            <div>
              <label class="form-label">IP地址</label>
              <HtpInput v-model="deployForm.ipAddress" placeholder="如：192.168.1.100"  />
            </div>
            <div class="form-grid--full">
              <label class="form-label">设备信息</label>
              <HtpInput v-model="deployForm.deviceType" placeholder="如：Dell R740 / 16C 32G"  />
            </div>
            <div class="form-grid--full">
              <label class="form-label">配置说明</label>
              <textarea class="htp-textarea" v-model="deployForm.config" placeholder="环境配置参数..." rows="3"></textarea>
            </div>
            <div class="form-grid--full">
              <label class="form-label">部署步骤</label>
              <textarea class="htp-textarea" v-model="deployForm.steps" placeholder="1. 安装依赖&#10;2. 配置环境变量&#10;3. 启动服务" rows="4"></textarea>
            </div>
            <div class="form-grid--full">
              <label class="form-label">部署命令</label>
              <textarea class="htp-textarea" v-model="deployForm.commands" placeholder="npm install && npm run build && pm2 start..." rows="3"></textarea>
            </div>
            <div class="form-grid--full">
              <label class="form-label">备注</label>
              <textarea class="htp-textarea" v-model="deployForm.remark" placeholder="补充说明..." rows="2"></textarea>
            </div>
          </div>
          <template #footer>
            <button class="htp-btn htp-btn--secondary" @click="deployModalVisible = false">取消</button>
            <button class="htp-btn htp-btn--primary" @click="submitDeployForm">确认</button>
          </template>
        </htp-modal>

        <!-- 删除确认 -->
        <htp-modal v-if="deployDelConfirm" :visible="true" title="确认删除？" @cancel="deployDelConfirm = null">
          <p>删除后不可恢复，确认删除以下部署记录吗？</p>
          <p style="font-weight: 500; margin-top: 8px;">{{ deployDelConfirm.name }}</p>
          <template #footer>
            <button class="htp-btn htp-btn--secondary" @click="deployDelConfirm = null">取消</button>
            <button class="htp-btn htp-btn--danger" @click="confirmDeployDelete">确认删除</button>
          </template>
        </htp-modal>
      </div>

      <!-- ====== 标签2：本APP数据管理 ====== -->
      <div v-if="activeTab === 'data'">
        <div class="htp-card" style="margin-top: 16px;">
          <div class="htp-card__header">
            <div>
              <div class="htp-card__title">数据备份与恢复</div>
              <div class="text-tertiary" style="margin-top: 4px;">导出的 JSON 包含当前工作台全部业务数据，可用于迁移或恢复。</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="htp-btn htp-btn--secondary" @click="exportData">导出 JSON</button>
              <label class="htp-btn htp-btn--primary">
                导入 JSON
                <input type="file" accept=".json,application/json" style="display:none" @change="selectImportFile" />
              </label>
            </div>
          </div>
          <div v-if="dataLoading" class="text-tertiary" style="padding: 24px 0;">正在读取数据统计...</div>
          <div v-else class="data-stats-grid">
            <div v-for="item in dataStats" :key="item.table" class="data-stat-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </div>
          </div>
          <div class="htp-card__footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
            <span class="text-tertiary">导入会覆盖当前全部业务数据，清空操作不可恢复。</span>
              <htp-select v-model="clearScope" :options="CLEAR_SCOPE_OPTIONS" placeholder="选择清空范围"></htp-select>
              <button class="htp-btn htp-btn--danger" @click="requestClear">清空数据</button>
          </div>
        </div>

        <div class="htp-card" style="margin-top: 16px;">
          <div class="htp-card__header">
            <div>
              <div class="htp-card__title">SQLite 文件备份（整库级）</div>
              <div class="text-tertiary" style="margin-top: 4px;">整库 SQLite 快照存于本机备份目录；恢复前系统自动做安全快照，选错可回退。</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <status-dot
                v-if="backupStatus && (backupStatus.status !== 'idle' || backupStatus.autoPaused)"
                :status="backupStatus.autoPaused ? 'error' : (backupStatus.status === 'success' ? 'success' : backupStatus.status)"
                :label="backupStatusLabel"
                :title="backupError || backupStatusLabel"
              ></status-dot>
              <button class="htp-btn htp-btn--secondary" :disabled="backupLoading" @click="openBackupNoteModal">创建备份</button>
            </div>
          </div>

          <div v-if="backupStatus && backupStatus.autoPaused" class="backup-autopause">
            自动备份已连续失败 3 次并暂停。多为磁盘空间不足 / 文件权限 / 杀软锁定 SQLite 所致，请排查后手动创建一次备份即可恢复自动策略。
          </div>

          <div v-if="backupLoading" class="text-tertiary">正在读取备份列表...</div>
          <htp-empty v-else-if="backups.length === 0" text="暂无 SQLite 备份文件"></htp-empty>
          <div v-else class="backup-list">
            <div v-for="item in backups" :key="item.fileName" class="backup-list__item">
              <div>
                <div style="font-weight: 500; display:flex; align-items:center; gap:8px;">
                  {{ item.fileName }}
                  <htp-tag :type="item.type === 'manual' ? 'primary' : (item.type === 'pre-restore' ? 'warning' : 'info')">
                    {{ item.type === 'manual' ? '手动' : (item.type === 'pre-restore' ? '恢复前快照' : '每日') }}
                  </htp-tag>
                  <htp-tag v-if="item.encrypted" type="success" title="静态加密备份（AES-256-GCM），恢复需数据库主密码">已加密</htp-tag>
                </div>
                <div class="text-tertiary">
                  {{ item.sizeText }} · {{ item.updatedAt }}
                  <span v-if="item.note"> · 备注：{{ item.note }}</span>
                </div>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="htp-btn htp-btn--text htp-btn--sm" @click="downloadDbBackup(item)">下载</button>
                <button class="htp-btn htp-btn--text htp-btn--sm" @click="requestRestore(item)" :disabled="restoreLoading">恢复</button>
                <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="backupDeleteConfirm = item">删除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 创建备份备注 Modal -->
        <htp-modal v-if="backupNoteModalVisible" :visible="true" title="创建数据库备份" @cancel="backupNoteModalVisible = false" width="480px">
          <p class="text-tertiary">将保存当前完整 SQLite 数据库到本机备份目录，可随时恢复。</p>
          <div class="mt-base">
            <label class="form-label">备份备注（可选，便于识别）</label>
            <HtpInput v-model="backupNote" placeholder="如：升级 V1.2 前 / 季度归档" maxlength="40"  />
          </div>
          <template #footer>
            <button class="htp-btn htp-btn--secondary" @click="backupNoteModalVisible = false">取消</button>
            <button class="htp-btn htp-btn--primary" @click="confirmCreateBackup">创建备份</button>
          </template>
        </htp-modal>

        <!-- 恢复二次确认 Modal -->
        <htp-modal v-if="restoringName" :visible="true" title="确认恢复备份？" @cancel="restoringName = null" width="480px">
          <p style="color: var(--color-warning); font-weight: 600;">恢复将用所选备份<strong>覆盖当前数据库</strong>。系统会先自动对当前库做安全快照，选错也可一键回退。</p>
          <p style="margin-top: 8px; font-weight: 500; word-break: break-all;">{{ restoringName }}</p>
          <template #footer>
            <button class="htp-btn htp-btn--secondary" @click="restoringName = null">取消</button>
            <button class="htp-btn htp-btn--danger" :disabled="restoreLoading" @click="confirmRestore">{{ restoreLoading ? '恢复中...' : '确认恢复' }}</button>
          </template>
        </htp-modal>

        <htp-modal v-if="importConfirm" :visible="true" title="确认导入数据？" @cancel="importConfirm = null">
          <p>即将导入文件：<strong>{{ importConfirm.fileName }}</strong></p>
          <div style="margin-top: 12px;">
            <label class="form-label">导入模式</label>
            <htp-select v-model="importConfirm.mode" :options="IMPORT_MODE_OPTIONS" placeholder="请选择导入模式"></htp-select>
          </div>
          <p style="margin-top: 8px; color: var(--color-danger);">导入会覆盖当前工作台全部业务数据，请确认已经做好现有数据备份。</p>
          <template #footer>
            <button class="htp-btn htp-btn--secondary" @click="importConfirm = null">取消</button>
            <button class="htp-btn htp-btn--primary" :disabled="importLoading" @click="confirmImport">{{ importLoading ? '导入中...' : '确认覆盖导入' }}</button>
          </template>
        </htp-modal>

        <htp-modal v-if="clearConfirm" :visible="true" title="确认清空数据？" @cancel="clearConfirm = false">
          <p style="color: var(--color-danger);">此操作将删除「{{ CLEAR_SCOPE_OPTIONS.find(item => item.value === clearScope)?.label }}」中的数据，且无法撤销。</p>
          <div style="margin-top: 12px;">
            <label class="form-label">请输入「确认清空」</label>
            <HtpInput v-model="clearPhrase" placeholder="确认清空"  />
          </div>
          <template #footer>
            <button class="htp-btn htp-btn--secondary" @click="clearConfirm = false">取消</button>
            <button class="htp-btn htp-btn--danger" :disabled="clearPhrase !== '确认清空'" @click="confirmClear">确认清空</button>
          </template>
        </htp-modal>

        <htp-modal v-if="backupDeleteConfirm" :visible="true" title="确认删除备份？" @cancel="backupDeleteConfirm = null">
          <p>确认删除备份文件吗？数据库中的业务数据不会受到影响。</p>
          <p style="font-weight: 500; margin-top: 8px;">{{ backupDeleteConfirm.fileName }}</p>
          <template #footer>
            <button class="htp-btn htp-btn--secondary" @click="backupDeleteConfirm = null">取消</button>
            <button class="htp-btn htp-btn--danger" @click="confirmBackupDelete">确认删除</button>
          </template>
        </htp-modal>
      </div>
    </div>
  `,
};
window.DataPage = DataPage;

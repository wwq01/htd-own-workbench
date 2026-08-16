/**
 * TodoPage - 今日/明日计划页面（阶段 1 核心）
 * 三标签：今日工作 / 明日计划 / 历史记录
 * 筛选：分类 / 优先级；历史记录支持日期选择
 */
const TODO_CATEGORY_OPTIONS = [
  { label: '售前工作', value: '售前工作' },
  { label: '日常事务', value: '日常事务' },
  { label: '生活事项', value: '生活事项' },
];
const TODO_PRIORITY_OPTIONS = [
  { label: '高', value: '高' },
  { label: '中', value: '中' },
  { label: '低', value: '低' },
];
const TODO_STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '未完成', value: 'pending' },
  { label: '已完成', value: 'completed' },
];

const TodoPage = {
  name: 'TodoPage',
  setup() {
    const dataStore = useDataStore();

    // ============ 标签 & 筛选 ============
    const activeTab = Vue.ref('today'); // today / tomorrow / history
    const filterCategory = Vue.ref('');
    const filterPriority = Vue.ref('');
    const filterStatus = Vue.ref('');
    const historyDate = Vue.ref(htdDate.today());

    // 当前目标日期 & 标题
    const currentTodoDate = Vue.computed(() => {
      if (activeTab.value === 'today') return htdDate.today();
      if (activeTab.value === 'tomorrow') return htdDate.tomorrow();
      return historyDate.value;
    });
    const listTitle = Vue.computed(() => {
      if (activeTab.value === 'today') return '今日工作';
      if (activeTab.value === 'tomorrow') return '明日计划';
      return `历史记录 · ${historyDate.value}`;
    });

    // ============ 列表数据 ============
    const list = Vue.ref([]);
    const loading = Vue.ref(false);

    async function loadList() {
      loading.value = true;
      try {
        const params = { todoDate: currentTodoDate.value };
        if (filterCategory.value) params.category = filterCategory.value;
        if (filterPriority.value) params.priority = filterPriority.value;
        if (filterStatus.value) params.status = filterStatus.value;
        const raw = await htdApi.get('/todos', params);
        // 原始列表按 sortOrder/priority/createdAt 排序；此处把 completed 沉底
        const arr = Array.isArray(raw) ? raw : (raw.list || []);
        const pending = arr.filter(t => t.status !== 'completed');
        const done = arr.filter(t => t.status === 'completed');
        list.value = [...pending, ...done];
      } catch (e) {
        console.error('加载待办列表失败:', e);
        list.value = [];
      } finally {
        loading.value = false;
      }
    }

    // 标签/筛选/日期 变化 → 刷新
    Vue.watch([activeTab, filterCategory, filterPriority, filterStatus, historyDate], loadList);
    Vue.onMounted(loadList);

    // ============ 新增 / 编辑弹窗 ============
    const formModalVisible = Vue.ref(false);
    const editingTodo = Vue.ref(null); // null=新增 / 对象=编辑
    const formTitle = Vue.computed(() => editingTodo.value ? '编辑待办' : '新增待办');
    const form = Vue.reactive({
      title: '',
      category: '日常事务',
      priority: '中',
      estimatedTime: '',
      remark: '',
      todoDate: htdDate.today(),
    });

    function openCreate() {
      editingTodo.value = null;
      Object.assign(form, {
        title: '',
        category: '日常事务',
        priority: '中',
        estimatedTime: '',
        remark: '',
        todoDate: currentTodoDate.value,
      });
      formModalVisible.value = true;
    }
    function openEdit(todo) {
      editingTodo.value = todo;
      Object.assign(form, {
        title: todo.title,
        category: todo.category,
        priority: todo.priority,
        estimatedTime: todo.estimatedTime || '',
        remark: todo.remark || '',
        todoDate: todo.todoDate,
      });
      formModalVisible.value = true;
    }
    function closeForm() {
      formModalVisible.value = false;
    }
    async function submitForm() {
      const title = (form.title || '').trim();
      if (!title) { showToast('标题不能为空', 'warning'); return; }
      const payload = {
        title,
        category: form.category,
        priority: form.priority,
        todoDate: form.todoDate,
        estimatedTime: form.estimatedTime || null,
        remark: form.remark || null,
      };
      try {
        if (editingTodo.value) {
          await dataStore.updateTodo(editingTodo.value.id, payload);
        } else {
          await dataStore.createTodo(payload);
        }
        formModalVisible.value = false;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 状态切换 ============
    async function handleToggle(todo) {
      try {
        await dataStore.toggleTodo(todo.id);
        showToast(todo.status === 'completed' ? '已恢复为未完成' : '已标记完成', 'success');
        // 同步刷新首页全局数据
        await dataStore.fetchStatistics();
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // 标记进行中（pending → in_progress，走状态机）
    async function markInProgress(todo) {
      try {
        await dataStore.changeTodoStatus(todo.id, 'in_progress');
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 延期弹窗（§6.2.1） ============
    const delayModal = Vue.ref(null);
    const delayMode = Vue.ref('tomorrow'); // tomorrow / date
    const delayToDate = Vue.ref('');
    const minDelayDate = Vue.computed(() => htdDate.tomorrow());
    function openDelay(todo) {
      delayModal.value = todo;
      delayMode.value = 'tomorrow';
      delayToDate.value = '';
    }
    function closeDelay() { delayModal.value = null; }
    async function confirmDelay() {
      if (!delayModal.value) return;
      let payload = {};
      if (delayMode.value === 'date') {
        if (!delayToDate.value) { showToast('请选择延期日期', 'warning'); return; }
        payload = { toDate: delayToDate.value };
      }
      try {
        await dataStore.delayTodo(delayModal.value.id, payload);
        delayModal.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }
    // 是否可延期（已完成 / 已取消不可延期）
    function canDelay(todo) {
      return todo && todo.status !== 'completed' && todo.status !== 'cancelled';
    }
    // 状态标签 / 状态点颜色
    function statusLabel(s) {
      if (s === 'in_progress') return '进行中';
      if (s === 'delayed') return '已延期';
      if (s === 'cancelled') return '已取消';
      if (s === 'completed') return '已完成';
      return '未完成';
    }
    function statusDotColor(s) {
      if (s === 'in_progress') return 'var(--status-in_progress)';
      if (s === 'delayed') return 'var(--status-delayed)';
      if (s === 'cancelled') return 'var(--status-cancelled)';
      if (s === 'completed') return 'var(--status-completed)';
      return 'var(--status-pending)';
    }

    // ============ 删除 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(todo) { delConfirm.value = todo; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteTodo(delConfirm.value.id);
        delConfirm.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 迁移功能 ============
    const migrateConfirm = Vue.ref(null); // {type:'today2tom'|'tom2today', count}
    function cancelMigrate() { migrateConfirm.value = null; }
    function requestMigrateTodayToTomorrow() {
      const todayPending = list.value.filter(t => t.status === 'pending');
      if (!todayPending.length) {
        showToast('当前没有待迁移的未完成任务', 'info');
        return;
      }
      migrateConfirm.value = { type: 'today2tom', count: todayPending.length };
    }
    function requestMigrateTomorrowToToday() {
      if (!list.value.length) {
        showToast('当前明日计划为空，无需迁移', 'info');
        return;
      }
      migrateConfirm.value = { type: 'tom2today', count: list.value.length };
    }
    async function confirmDoMigrate() {
      if (!migrateConfirm.value) return;
      try {
        if (migrateConfirm.value.type === 'today2tom') {
          await dataStore.migrateTodayPendingToTomorrow();
        } else {
          await dataStore.migrateTomorrowToToday();
        }
        migrateConfirm.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 杂项 ============
    function priorityType(p) {
      return p === '高' ? 'danger' : p === '中' ? 'warning' : 'default';
    }
    function resetFilters() {
      filterCategory.value = '';
      filterPriority.value = '';
      filterStatus.value = '';
    }
    // 在模板中使用的包装方法（避免直接引用 htdDate 全局对象）
    function formatDateTime(d) { return htdDate.formatDateTime(d); }
    function tomorrowStr() { return htdDate.tomorrow(); }
    function todayStr() { return htdDate.today(); }

    // 小统计
    const pendingCount = Vue.computed(() => list.value.filter(t => t.status !== 'completed').length);
    const completedCount = Vue.computed(() => list.value.filter(t => t.status === 'completed').length);

    return {
      // state
      activeTab, filterCategory, filterPriority, filterStatus, historyDate,
      list, loading, listTitle,
      formModalVisible, editingTodo, formTitle, form,
      delConfirm, migrateConfirm,
      pendingCount, completedCount,
      // options
      TODO_CATEGORY_OPTIONS, TODO_PRIORITY_OPTIONS, TODO_STATUS_OPTIONS,
      // actions
      openCreate, openEdit, closeForm, submitForm,
      handleToggle, markInProgress, requestDelete, cancelDelete, confirmDoDelete,
      openDelay, closeDelay, confirmDelay, canDelay,
      requestMigrateTodayToTomorrow, requestMigrateTomorrowToToday, cancelMigrate, confirmDoMigrate,
      priorityType, resetFilters, statusLabel, statusDotColor,
      formatDateTime, tomorrowStr, todayStr,
      // delay modal state
      delayModal, delayMode, delayToDate, minDelayDate,
    };
  },
  template: `
    <div class="list-page todo-page">
      <!-- 标签页 -->
      <div class="htp-tabs">
        <button
          class="htp-tab"
          :class="{ 'htp-tab--active': activeTab === 'today' }"
          @click="activeTab = 'today'"
        >今日工作</button>
        <button
          class="htp-tab"
          :class="{ 'htp-tab--active': activeTab === 'tomorrow' }"
          @click="activeTab = 'tomorrow'"
        >明日计划</button>
        <button
          class="htp-tab"
          :class="{ 'htp-tab--active': activeTab === 'history' }"
          @click="activeTab = 'history'"
        >历史记录</button>
      </div>

      <!-- 筛选栏 -->
      <div class="htp-filter-bar">
        <div class="htp-filter-bar__item">
          <htp-select
            v-model="filterCategory"
            :options="[{label:'全部分类',value:''}].concat(TODO_CATEGORY_OPTIONS)"
          ></htp-select>
        </div>
        <div class="htp-filter-bar__item">
          <htp-select
            v-model="filterPriority"
            :options="[{label:'全部优先级',value:''}].concat(TODO_PRIORITY_OPTIONS)"
          ></htp-select>
        </div>
        <div v-if="activeTab !== 'history'" class="htp-filter-bar__item">
          <htp-select
            v-model="filterStatus"
            :options="TODO_STATUS_OPTIONS"
          ></htp-select>
        </div>
        <div v-if="activeTab === 'history'" class="htp-filter-bar__item">
          <input
            type="date"
            class="htp-input"
            v-model="historyDate"
          />
        </div>
        <button
          v-if="activeTab === 'today'"
          class="htp-btn htp-btn--secondary htp-btn--sm"
          title="将今日所有未完成任务迁移到明日"
          @click="requestMigrateTodayToTomorrow"
        >
          一键迁移未完成到明日
        </button>
        <button
          v-if="activeTab === 'tomorrow'"
          class="htp-btn htp-btn--secondary htp-btn--sm"
          title="将明日所有计划迁移到今日"
          @click="requestMigrateTomorrowToToday"
        >
          一键迁移明日计划到今日
        </button>
        <button
          class="htp-btn htp-btn--ghost htp-btn--sm"
          @click="resetFilters"
        >重置筛选</button>
        <div style="margin-left:auto">
          <button class="htp-btn htp-btn--primary" @click="openCreate">+ 新增待办</button>
        </div>
      </div>

      <!-- 列表区 -->
      <div class="list-container">
        <!-- 统计头部 -->
        <div class="list-header">
          <div class="list-header__title">{{ listTitle }}</div>
          <div class="list-header__meta">
            <span class="text-sm mr-md">共 {{ list.length }} 条</span>
            <htp-tag type="warning">未完成 {{ pendingCount }}</htp-tag>
            <htp-tag type="success" class="ml-sm">已完成 {{ completedCount }}</htp-tag>
          </div>
        </div>

        <div class="list-body">
          <div v-if="loading" class="text-center py-lg text-tertiary">加载中...</div>
          <div v-else-if="list.length === 0">
            <htp-empty text="暂无待办事项，点击「新增待办」开始记录"></htp-empty>
          </div>
          <ul v-else class="todo-list">
            <li
              v-for="todo in list"
              :key="todo.id"
              class="todo-list-item"
              :class="{ 'todo-list-item--done': todo.status === 'completed' }"
            >
              <div class="flex items-center flex-1 min-w-0">
                <htp-checkbox
                  :checked="todo.status === 'completed'"
                  @change="handleToggle(todo)"
                ></htp-checkbox>
                <div class="ml-md flex-1 min-w-0">
                  <div class="flex items-center flex-wrap gap-xs">
                    <htp-tag :type="priorityType(todo.priority)">{{ todo.priority }}优</htp-tag>
                    <htp-tag type="info">{{ todo.category }}</htp-tag>
                    <htp-tag
                      v-if="todo.status !== 'pending'"
                      :type="todo.status === 'completed' ? 'success' : (todo.status === 'delayed' ? 'warning' : 'default')"
                    >{{ statusLabel(todo.status) }}</htp-tag>
                    <span
                      class="text-primary ml-xs text-ellipsis flex-1"
                      :class="{ 'todo-list-item__title--done': todo.status === 'completed' }"
                    >{{ todo.title }}</span>
                  </div>
                  <div class="text-sm text-tertiary mt-xs flex items-center flex-wrap gap-sm">
                    <span>日期：{{ todo.todoDate }}</span>
                    <span v-if="todo.estimatedTime">预计耗时：{{ todo.estimatedTime }}</span>
                    <span v-if="todo.status === 'completed' && todo.completedAt" class="text-success">
                      完成于 {{ formatDateTime(todo.completedAt) }}
                    </span>
                    <span v-if="todo.status === 'delayed' && todo.delayedUntil" class="text-warning">
                      延期至 {{ todo.delayedUntil }}
                    </span>
                    <span v-if="todo.remark" class="todo-list-item__remark text-ellipsis">
                      备注：{{ todo.remark }}
                    </span>
                  </div>
                </div>
                <div class="ml-sm flex items-center gap-xs">
                  <button
                    v-if="todo.status === 'pending'"
                    class="htp-btn htp-btn--text htp-btn--primary htp-btn--sm"
                    @click="markInProgress(todo)"
                  >进行中</button>
                  <button
                    v-if="canDelay(todo)"
                    class="htp-btn htp-btn--text htp-btn--warning htp-btn--sm"
                    @click="openDelay(todo)"
                  >延期</button>
                  <button class="htp-btn htp-btn--text htp-btn--primary htp-btn--sm" @click="openEdit(todo)">编辑</button>
                  <button class="htp-btn htp-btn--text htp-btn--danger htp-btn--sm" @click="requestDelete(todo)">删除</button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- 新增/编辑待办弹窗 -->
      <htp-modal
        :visible="formModalVisible"
        :title="formTitle"
        width="520px"
        confirmText="保存"
        @cancel="closeForm"
        @confirm="submitForm"
      >
        <div class="form-grid">
          <div class="form-item">
            <label class="form-item__label"><span class="text-danger">*</span> 标题</label>
            <htp-input v-model="form.title" placeholder="请输入待办标题（最多 200 字）" maxlength="200"></htp-input>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">分类</label>
              <htp-select
                v-model="form.category"
                :options="TODO_CATEGORY_OPTIONS"
              ></htp-select>
            </div>
            <div class="form-item">
              <label class="form-item__label">优先级</label>
              <htp-select
                v-model="form.priority"
                :options="TODO_PRIORITY_OPTIONS"
              ></htp-select>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label">日期</label>
              <input
                type="date"
                class="htp-input"
                v-model="form.todoDate"
              />
            </div>
            <div class="form-item">
              <label class="form-item__label">预计耗时</label>
              <htp-input v-model="form.estimatedTime" placeholder="例如: 30 分钟 / 2 小时（可选）"></htp-input>
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">备注</label>
            <htp-textarea
              v-model="form.remark"
              :rows="3"
              placeholder="补充说明（可选，最多 1000 字）"
              maxlength="1000"
            ></htp-textarea>
          </div>
        </div>
      </htp-modal>

      <!-- 删除二次确认弹窗 -->
      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除待办？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDelete"
        @confirm="confirmDoDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下待办吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">
            <htp-tag :type="priorityType(delConfirm.priority)" class="mr-xs">{{ delConfirm.priority }}优</htp-tag>
            <span>{{ delConfirm.title }}</span>
          </div>
        </div>
      </htp-modal>

      <!-- 迁移二次确认弹窗 -->
      <htp-modal
        v-if="migrateConfirm"
        :visible="!!migrateConfirm"
        :title="migrateConfirm.type === 'today2tom' ? '确认迁移今日未完成任务到明日？' : '确认迁移明日计划到今日？'"
        confirmText="确认迁移"
        confirmType="primary"
        @cancel="cancelMigrate"
        @confirm="confirmDoMigrate"
      >
        <div class="py-sm text-tertiary">
          <p v-if="migrateConfirm.type === 'today2tom'">
            将迁移今日所有 <span class="text-warning font-medium">{{ migrateConfirm.count }}</span> 条未完成任务到明日（{{ tomorrowStr() }}），已完成任务不迁移。
          </p>
          <p v-else>
            将迁移明日所有 <span class="text-primary font-medium">{{ migrateConfirm.count }}</span> 条计划任务（无论状态）到今日（{{ todayStr() }}）。
          </p>
        </div>
      </htp-modal>

      <!-- 延期弹窗（§6.2.1） -->
      <htp-modal
        v-if="delayModal"
        :visible="!!delayModal"
        title="延期任务"
        confirmText="确认延期"
        confirmType="warning"
        @cancel="closeDelay"
        @confirm="confirmDelay"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-base">
            将「{{ delayModal.title }}」延期，状态切为「已延期」，并从当前日期列表移出。
          </div>
          <div class="form-item mb-base">
            <label class="form-item__label">延期方式</label>
            <htp-select
              v-model="delayMode"
              :options="[{label:'延期到明天（'+minDelayDate+'）',value:'tomorrow'},{label:'延期到指定日期',value:'date'}]"
            ></htp-select>
          </div>
          <div class="form-item" v-if="delayMode === 'date'">
            <label class="form-item__label">选择日期</label>
            <input type="date" class="htp-input" v-model="delayToDate" :min="minDelayDate" />
          </div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.TodoPage = TodoPage;

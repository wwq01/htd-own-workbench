/**
 * DevelopPage - 开发工作页面（阶段 3 核心）
 * 三标签切换：个人开发项目 / 代码片段库 / 问题记录
 */
const DEV_PROJECT_STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '开发中', value: '开发中' },
  { label: '已完成', value: '已完成' },
  { label: '搁置', value: '搁置' },
];
const DEV_ISSUE_STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '待解决', value: '待解决' },
  { label: '排查中', value: '排查中' },
  { label: '已解决', value: '已解决' },
];
const DEV_SNIPPET_CATEGORY_OPTIONS = [
  { label: '全部分类', value: '' },
  { label: '前端', value: '前端' },
  { label: '后端', value: '后端' },
  { label: '数据库', value: '数据库' },
  { label: '运维', value: '运维' },
  { label: '工具', value: '工具' },
  { label: '其他', value: '其他' },
];

const DevelopPage = {
  name: 'DevelopPage',
  setup() {
    const dataStore = useDataStore();
    const activeTab = Vue.ref('project');

    // ============ 开发项目 ============
    const projectList = Vue.ref([]);
    const projectLoading = Vue.ref(false);
    const filterProjectStatus = Vue.ref('');
    const filterProjectKeyword = Vue.ref('');

    async function loadProjects() {
      projectLoading.value = true;
      try {
        const params = {};
        if (filterProjectStatus.value) params.status = filterProjectStatus.value;
        if (filterProjectKeyword.value) params.keyword = filterProjectKeyword.value;
        const raw = await htdApi.get('/dev-projects', params);
        projectList.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        projectList.value = [];
      } finally {
        projectLoading.value = false;
      }
    }
    Vue.watch([filterProjectStatus, filterProjectKeyword], loadProjects);

    const projectModalVisible = Vue.ref(false);
    const editingProject = Vue.ref(null);
    const projectFormTitle = Vue.computed(() => editingProject.value ? '编辑开发项目' : '新建开发项目');
    const projectForm = Vue.reactive({
      name: '', description: '', status: '开发中', techStack: [], todoItems: [],
    });
    const newTechTag = Vue.ref('');
    const newTodoItem = Vue.ref('');

    function openCreateProject() {
      editingProject.value = null;
      Object.assign(projectForm, { name: '', description: '', status: '开发中', techStack: [], todoItems: [] });
      newTechTag.value = '';
      newTodoItem.value = '';
      projectModalVisible.value = true;
    }
    function openEditProject(p) {
      editingProject.value = p;
      Object.assign(projectForm, {
        name: p.name || '',
        description: p.description || '',
        status: p.status || '开发中',
        techStack: Array.isArray(p.techStack) ? [...p.techStack] : [],
        todoItems: Array.isArray(p.todoItems) ? [...p.todoItems] : [],
      });
      newTechTag.value = '';
      newTodoItem.value = '';
      projectModalVisible.value = true;
    }
    function addTechTag() {
      const tag = (newTechTag.value || '').trim();
      if (tag && !projectForm.techStack.includes(tag)) {
        projectForm.techStack.push(tag);
      }
      newTechTag.value = '';
    }
    function removeTechTag(idx) {
      projectForm.techStack.splice(idx, 1);
    }
    function addTodoItem() {
      const item = (newTodoItem.value || '').trim();
      if (item) projectForm.todoItems.push(item);
      newTodoItem.value = '';
    }
    function removeTodoItem(idx) {
      projectForm.todoItems.splice(idx, 1);
    }
    async function submitProjectForm() {
      const name = (projectForm.name || '').trim();
      if (!name) { showToast('项目名称不能为空', 'warning'); return; }
      const payload = {
        name,
        description: projectForm.description || null,
        status: projectForm.status,
        techStack: projectForm.techStack,
        todoItems: projectForm.todoItems,
      };
      try {
        if (editingProject.value) {
          await dataStore.updateDevProject(editingProject.value.id, payload);
        } else {
          await dataStore.createDevProject(payload);
        }
        projectModalVisible.value = false;
        await loadProjects();
      } catch (e) { /* toast 已显示 */ }
    }
    const delProjectConfirm = Vue.ref(null);
    function requestDeleteProject(p) { delProjectConfirm.value = p; }
    async function confirmDeleteProject() {
      if (!delProjectConfirm.value) return;
      try {
        await dataStore.deleteDevProject(delProjectConfirm.value.id);
        delProjectConfirm.value = null;
        await loadProjects();
      } catch (e) { /* toast 已显示 */ }
    }

    function projectStatusType(s) {
      if (s === '已完成') return 'success';
      if (s === '搁置') return 'default';
      return 'info';
    }

    // ============ 代码片段 ============
    const snippetList = Vue.ref([]);
    const snippetLoading = Vue.ref(false);
    const filterSnippetCategory = Vue.ref('');
    const filterSnippetKeyword = Vue.ref('');

    async function loadSnippets() {
      snippetLoading.value = true;
      try {
        const params = {};
        if (filterSnippetCategory.value) params.category = filterSnippetCategory.value;
        if (filterSnippetKeyword.value) params.keyword = filterSnippetKeyword.value;
        const raw = await htdApi.get('/dev-snippets', params);
        snippetList.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        snippetList.value = [];
      } finally {
        snippetLoading.value = false;
      }
    }
    Vue.watch([filterSnippetCategory, filterSnippetKeyword], loadSnippets);

    const snippetModalVisible = Vue.ref(false);
    const editingSnippet = Vue.ref(null);
    const snippetFormTitle = Vue.computed(() => editingSnippet.value ? '编辑代码片段' : '新建代码片段');
    const snippetForm = Vue.reactive({ name: '', category: '其他', code: '', remark: '' });
    const expandedSnippetId = Vue.ref(null);

    function openCreateSnippet() {
      editingSnippet.value = null;
      Object.assign(snippetForm, { name: '', category: '其他', code: '', remark: '' });
      snippetModalVisible.value = true;
    }
    function openEditSnippet(s) {
      editingSnippet.value = s;
      Object.assign(snippetForm, {
        name: s.name || '', category: s.category || '其他',
        code: s.code || '', remark: s.remark || '',
      });
      snippetModalVisible.value = true;
    }
    async function submitSnippetForm() {
      const name = (snippetForm.name || '').trim();
      if (!name) { showToast('片段名称不能为空', 'warning'); return; }
      if (!snippetForm.code) { showToast('代码内容不能为空', 'warning'); return; }
      const payload = {
        name, category: snippetForm.category, code: snippetForm.code,
        remark: snippetForm.remark || null,
      };
      try {
        if (editingSnippet.value) {
          await dataStore.updateDevSnippet(editingSnippet.value.id, payload);
        } else {
          await dataStore.createDevSnippet(payload);
        }
        snippetModalVisible.value = false;
        await loadSnippets();
      } catch (e) { /* toast 已显示 */ }
    }
    const delSnippetConfirm = Vue.ref(null);
    function requestDeleteSnippet(s) { delSnippetConfirm.value = s; }
    async function confirmDeleteSnippet() {
      if (!delSnippetConfirm.value) return;
      try {
        await dataStore.deleteDevSnippet(delSnippetConfirm.value.id);
        delSnippetConfirm.value = null;
        await loadSnippets();
      } catch (e) { /* toast 已显示 */ }
    }

    async function copySnippetCode(s) {
      const ok = await htdCopy.copyToClipboard(s.code || '');
      showToast(ok ? '代码已复制到剪贴板' : '复制失败', ok ? 'success' : 'error');
    }
    function toggleExpandSnippet(id) {
      expandedSnippetId.value = expandedSnippetId.value === id ? null : id;
    }

    // ============ 问题记录 ============
    const issueList = Vue.ref([]);
    const issueLoading = Vue.ref(false);
    const filterIssueStatus = Vue.ref('');
    const filterIssueKeyword = Vue.ref('');

    async function loadIssues() {
      issueLoading.value = true;
      try {
        const params = {};
        if (filterIssueStatus.value) params.status = filterIssueStatus.value;
        if (filterIssueKeyword.value) params.keyword = filterIssueKeyword.value;
        const raw = await htdApi.get('/dev-issues', params);
        issueList.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        issueList.value = [];
      } finally {
        issueLoading.value = false;
      }
    }
    Vue.watch([filterIssueStatus, filterIssueKeyword], loadIssues);

    const issueModalVisible = Vue.ref(false);
    const editingIssue = Vue.ref(null);
    const issueFormTitle = Vue.computed(() => editingIssue.value ? '编辑问题记录' : '新建问题记录');
    const issueForm = Vue.reactive({
      title: '', status: '待解决', symptom: '', investigation: '', solution: '',
    });

    function openCreateIssue() {
      editingIssue.value = null;
      Object.assign(issueForm, { title: '', status: '待解决', symptom: '', investigation: '', solution: '' });
      issueModalVisible.value = true;
    }
    function openEditIssue(i) {
      editingIssue.value = i;
      Object.assign(issueForm, {
        title: i.title || '', status: i.status || '待解决',
        symptom: i.symptom || '', investigation: i.investigation || '', solution: i.solution || '',
      });
      issueModalVisible.value = true;
    }
    async function submitIssueForm() {
      const title = (issueForm.title || '').trim();
      if (!title) { showToast('问题标题不能为空', 'warning'); return; }
      const payload = {
        title, status: issueForm.status,
        symptom: issueForm.symptom || null,
        investigation: issueForm.investigation || null,
        solution: issueForm.solution || null,
      };
      try {
        if (editingIssue.value) {
          await dataStore.updateDevIssue(editingIssue.value.id, payload);
        } else {
          await dataStore.createDevIssue(payload);
        }
        issueModalVisible.value = false;
        await loadIssues();
      } catch (e) { /* toast 已显示 */ }
    }
    const delIssueConfirm = Vue.ref(null);
    function requestDeleteIssue(i) { delIssueConfirm.value = i; }
    async function confirmDeleteIssue() {
      if (!delIssueConfirm.value) return;
      try {
        await dataStore.deleteDevIssue(delIssueConfirm.value.id);
        delIssueConfirm.value = null;
        await loadIssues();
      } catch (e) { /* toast 已显示 */ }
    }

    function issueStatusType(s) {
      if (s === '已解决') return 'success';
      if (s === '排查中') return 'warning';
      return 'danger';
    }

    // ============ 标签切换时加载数据 ============
    function switchTab(tab) {
      activeTab.value = tab;
      if (tab === 'project' && projectList.value.length === 0) loadProjects();
      if (tab === 'snippet' && snippetList.value.length === 0) loadSnippets();
      if (tab === 'issue' && issueList.value.length === 0) loadIssues();
    }

    Vue.onMounted(() => {
      loadProjects();
    });

    return {
      // 标签
      activeTab, switchTab,
      // 开发项目
      projectList, projectLoading, filterProjectStatus, filterProjectKeyword,
      projectModalVisible, editingProject, projectFormTitle, projectForm,
      newTechTag, newTodoItem,
      openCreateProject, openEditProject, addTechTag, removeTechTag, addTodoItem, removeTodoItem,
      submitProjectForm, delProjectConfirm, requestDeleteProject, confirmDeleteProject,
      projectStatusType, loadProjects,
      // 代码片段
      snippetList, snippetLoading, filterSnippetCategory, filterSnippetKeyword,
      snippetModalVisible, editingSnippet, snippetFormTitle, snippetForm,
      expandedSnippetId,
      openCreateSnippet, openEditSnippet, submitSnippetForm,
      delSnippetConfirm, requestDeleteSnippet, confirmDeleteSnippet,
      copySnippetCode, toggleExpandSnippet, loadSnippets,
      // 问题记录
      issueList, issueLoading, filterIssueStatus, filterIssueKeyword,
      issueModalVisible, editingIssue, issueFormTitle, issueForm,
      openCreateIssue, openEditIssue, submitIssueForm,
      delIssueConfirm, requestDeleteIssue, confirmDeleteIssue,
      issueStatusType, loadIssues,
      // 选项
      DEV_PROJECT_STATUS_OPTIONS, DEV_ISSUE_STATUS_OPTIONS, DEV_SNIPPET_CATEGORY_OPTIONS,
    };
  },
  template: `
    <div class="list-page">
      <!-- 标签切换 -->
      <div class="htp-tabs">
        <button class="htp-tab" :class="{ 'htp-tab--active': activeTab === 'project' }" @click="switchTab('project')">个人开发项目</button>
        <button class="htp-tab" :class="{ 'htp-tab--active': activeTab === 'snippet' }" @click="switchTab('snippet')">代码片段库</button>
        <button class="htp-tab" :class="{ 'htp-tab--active': activeTab === 'issue' }" @click="switchTab('issue')">问题记录</button>
      </div>

      <!-- ===== 开发项目 ===== -->
      <template v-if="activeTab === 'project'">
        <div class="htp-filter-bar">
          <div class="form-row-2">
            <htp-select v-model="filterProjectStatus" :options="DEV_PROJECT_STATUS_OPTIONS" placeholder="全部状态"></htp-select>
            <input class="htp-input" v-model="filterProjectKeyword" placeholder="项目名称搜索" />
          </div>
          <button class="htp-btn htp-btn--primary htp-btn--sm" @click="openCreateProject">+ 新建项目</button>
        </div>
        <div v-if="projectList.length === 0 && !projectLoading" style="padding: 40px;">
          <htp-empty text="暂无开发项目，点击「新建项目」开始"></htp-empty>
        </div>
        <div class="project-cards" v-else>
          <div class="project-card" v-for="p in projectList" :key="p.id">
            <div class="project-card__header">
              <span class="project-card__name">{{ p.name }}</span>
              <htp-tag :type="projectStatusType(p.status)">{{ p.status }}</htp-tag>
            </div>
            <div class="project-card__meta" v-if="p.techStack && p.techStack.length">
              <htp-tag v-for="tag in p.techStack" :key="tag" type="info">{{ tag }}</htp-tag>
            </div>
            <div class="project-card__desc" v-if="p.description" style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">{{ p.description }}</div>
            <div v-if="p.todoItems && p.todoItems.length" style="margin-top: 8px;">
              <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px;">待办事项（{{ p.todoItems.length }}）</div>
              <div v-for="(item, idx) in p.todoItems" :key="idx" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px; position: relative;">
                <span style="position: absolute; left: 0;">•</span>{{ item }}
              </div>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openEditProject(p)">编辑</button>
              <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestDeleteProject(p)">删除</button>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== 代码片段 ===== -->
      <template v-if="activeTab === 'snippet'">
        <div class="htp-filter-bar">
          <div class="form-row-2">
            <htp-select v-model="filterSnippetCategory" :options="DEV_SNIPPET_CATEGORY_OPTIONS" placeholder="全部分类"></htp-select>
            <input class="htp-input" v-model="filterSnippetKeyword" placeholder="片段名称/代码搜索" />
          </div>
          <button class="htp-btn htp-btn--primary htp-btn--sm" @click="openCreateSnippet">+ 新建片段</button>
        </div>
        <div v-if="snippetList.length === 0 && !snippetLoading" style="padding: 40px;">
          <htp-empty text="暂无代码片段，点击「新建片段」开始"></htp-empty>
        </div>
        <div class="list-container" v-else>
          <div class="htp-list-item" v-for="s in snippetList" :key="s.id" style="flex-direction: column; align-items: stretch;">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" @click="toggleExpandSnippet(s.id)">
                <span style="font-weight: 500;">{{ s.name }}</span>
                <htp-tag type="info">{{ s.category }}</htp-tag>
                <span v-if="s.remark" style="font-size: 12px; color: var(--text-tertiary);">{{ s.remark }}</span>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="copySnippetCode(s)"><span v-html="htdIcon('clipboard')"></span> 复制</button>
                <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openEditSnippet(s)">编辑</button>
                <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestDeleteSnippet(s)">删除</button>
              </div>
            </div>
            <div v-if="expandedSnippetId === s.id" style="margin-top: 8px; background: var(--bg-secondary); border-radius: 6px; padding: 12px; overflow-x: auto;">
              <pre style="margin: 0; font-size: 13px; white-space: pre-wrap; word-break: break-all; color: var(--text-primary);"><code>{{ s.code }}</code></pre>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== 问题记录 ===== -->
      <template v-if="activeTab === 'issue'">
        <div class="htp-filter-bar">
          <div class="form-row-2">
            <htp-select v-model="filterIssueStatus" :options="DEV_ISSUE_STATUS_OPTIONS" placeholder="全部状态"></htp-select>
            <input class="htp-input" v-model="filterIssueKeyword" placeholder="问题标题搜索" />
          </div>
          <button class="htp-btn htp-btn--primary htp-btn--sm" @click="openCreateIssue">+ 新建问题</button>
        </div>
        <div v-if="issueList.length === 0 && !issueLoading" style="padding: 40px;">
          <htp-empty text="暂无问题记录，点击「新建问题」开始"></htp-empty>
        </div>
        <div class="list-container" v-else>
          <div class="htp-list-item" v-for="i in issueList" :key="i.id" style="flex-direction: column; align-items: stretch; padding: 12px var(--spacing-lg);">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 500;">{{ i.title }}</span>
                <htp-tag :type="issueStatusType(i.status)">{{ i.status }}</htp-tag>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openEditIssue(i)">编辑</button>
                <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestDeleteIssue(i)">删除</button>
              </div>
            </div>
            <div v-if="i.symptom" style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">
              <span style="color: var(--text-tertiary);">现象：</span>{{ i.symptom }}
            </div>
            <div v-if="i.investigation" style="margin-top: 4px; font-size: 13px; color: var(--text-secondary);">
              <span style="color: var(--text-tertiary);">排查：</span>{{ i.investigation }}
            </div>
            <div v-if="i.solution" style="margin-top: 4px; font-size: 13px; color: var(--color-success);">
              <span style="color: var(--text-tertiary);">解决：</span>{{ i.solution }}
            </div>
          </div>
        </div>
      </template>

      <!-- ===== 开发项目弹窗 ===== -->
      <htp-modal v-if="projectModalVisible" :visible="true" :title="projectFormTitle" @cancel="projectModalVisible = false">
        <div class="form-grid">
          <div class="form-grid--full">
            <label class="form-label">项目名称 *</label>
            <input class="htp-input" v-model="projectForm.name" placeholder="项目名称" />
          </div>
          <div>
            <label class="form-label">状态</label>
            <htp-select v-model="projectForm.status" :options="DEV_PROJECT_STATUS_OPTIONS.filter(o => o.value)" placeholder="请选择"></htp-select>
          </div>
          <div class="form-grid--full">
            <label class="form-label">项目描述</label>
            <textarea class="htp-textarea" v-model="projectForm.description" placeholder="项目描述" rows="3"></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">技术栈标签</label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <htp-tag v-for="(tag, idx) in projectForm.techStack" :key="idx" type="info" closable @close="removeTechTag(idx)">{{ tag }}</htp-tag>
              <input class="htp-input" v-model="newTechTag" placeholder="输入标签回车添加" style="width: 180px;" @keyup.enter="addTechTag" />
            </div>
          </div>
          <div class="form-grid--full">
            <label class="form-label">待完成事项</label>
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <input class="htp-input" v-model="newTodoItem" placeholder="输入事项回车添加" @keyup.enter="addTodoItem" />
              <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="addTodoItem">添加</button>
            </div>
            <div v-for="(item, idx) in projectForm.todoItems" :key="idx" style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 13px; color: var(--text-secondary);">• {{ item }}</span>
              <button class="htp-btn htp-btn--danger htp-btn--sm" @click="removeTodoItem(idx)" style="padding: 2px 8px;">×</button>
            </div>
          </div>
        </div>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="projectModalVisible = false">取消</button>
          <button class="htp-btn htp-btn--primary" @click="submitProjectForm">确认</button>
        </template>
      </htp-modal>

      <!-- ===== 代码片段弹窗 ===== -->
      <htp-modal v-if="snippetModalVisible" :visible="true" :title="snippetFormTitle" @cancel="snippetModalVisible = false" width="700px">
        <div class="form-grid">
          <div>
            <label class="form-label">片段名称 *</label>
            <input class="htp-input" v-model="snippetForm.name" placeholder="片段名称" />
          </div>
          <div>
            <label class="form-label">分类</label>
            <htp-select v-model="snippetForm.category" :options="DEV_SNIPPET_CATEGORY_OPTIONS.filter(o => o.value)" placeholder="请选择"></htp-select>
          </div>
          <div class="form-grid--full">
            <label class="form-label">代码内容 *</label>
            <textarea class="htp-textarea" v-model="snippetForm.code" placeholder="粘贴代码内容..." rows="12" style="font-family: monospace; font-size: 13px;"></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">备注</label>
            <input class="htp-input" v-model="snippetForm.remark" placeholder="备注说明（可选）" />
          </div>
        </div>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="snippetModalVisible = false">取消</button>
          <button class="htp-btn htp-btn--primary" @click="submitSnippetForm">确认</button>
        </template>
      </htp-modal>

      <!-- ===== 问题记录弹窗 ===== -->
      <htp-modal v-if="issueModalVisible" :visible="true" :title="issueFormTitle" @cancel="issueModalVisible = false" width="700px">
        <div class="form-grid">
          <div class="form-grid--full">
            <label class="form-label">问题标题 *</label>
            <input class="htp-input" v-model="issueForm.title" placeholder="问题标题" />
          </div>
          <div>
            <label class="form-label">状态</label>
            <htp-select v-model="issueForm.status" :options="DEV_ISSUE_STATUS_OPTIONS.filter(o => o.value)" placeholder="请选择"></htp-select>
          </div>
          <div class="form-grid--full">
            <label class="form-label">问题现象</label>
            <textarea class="htp-textarea" v-model="issueForm.symptom" placeholder="描述问题现象..." rows="3"></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">排查过程</label>
            <textarea class="htp-textarea" v-model="issueForm.investigation" placeholder="记录排查过程..." rows="4"></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">解决方案</label>
            <textarea class="htp-textarea" v-model="issueForm.solution" placeholder="最终解决方案..." rows="3"></textarea>
          </div>
        </div>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="issueModalVisible = false">取消</button>
          <button class="htp-btn htp-btn--primary" @click="submitIssueForm">确认</button>
        </template>
      </htp-modal>

      <!-- ===== 删除确认弹窗 ===== -->
      <htp-modal v-if="delProjectConfirm" :visible="true" title="确认删除？" @cancel="delProjectConfirm = null">
        <p>删除后不可恢复，确认删除以下开发项目吗？</p>
        <p style="font-weight: 500; margin-top: 8px;">{{ delProjectConfirm.name }}</p>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="delProjectConfirm = null">取消</button>
          <button class="htp-btn htp-btn--danger" @click="confirmDeleteProject">确认删除</button>
        </template>
      </htp-modal>
      <htp-modal v-if="delSnippetConfirm" :visible="true" title="确认删除？" @cancel="delSnippetConfirm = null">
        <p>删除后不可恢复，确认删除以下代码片段吗？</p>
        <p style="font-weight: 500; margin-top: 8px;">{{ delSnippetConfirm.name }}</p>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="delSnippetConfirm = null">取消</button>
          <button class="htp-btn htp-btn--danger" @click="confirmDeleteSnippet">确认删除</button>
        </template>
      </htp-modal>
      <htp-modal v-if="delIssueConfirm" :visible="true" title="确认删除？" @cancel="delIssueConfirm = null">
        <p>删除后不可恢复，确认删除以下问题记录吗？</p>
        <p style="font-weight: 500; margin-top: 8px;">{{ delIssueConfirm.title }}</p>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="delIssueConfirm = null">取消</button>
          <button class="htp-btn htp-btn--danger" @click="confirmDeleteIssue">确认删除</button>
        </template>
      </htp-modal>
    </div>
  `,
};
window.DevelopPage = DevelopPage;

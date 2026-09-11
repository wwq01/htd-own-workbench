/**
 * MeetingPage - 会议纪要模块（V1.3）
 * 列表（卡片）/ 筛选 / 新增-编辑 / 详情（议题·决策·行动项）/ 生成复盘 / 行动项加入今日
 */
const MeetingPage = {
  name: 'MeetingPage',
  setup() {
    const dataStore = useDataStore();
    // ============ 筛选 ============
    const filterKeyword = Vue.ref('');
    const filterFrom = Vue.ref('');
    const filterTo = Vue.ref('');
    const filterProject = Vue.ref('');

    // 关联项目下拉
    const projects = Vue.ref([]);
    const projectOptions = Vue.computed(() => {
      const base = [{ label: '全部项目', value: '' }];
      const list = projects.value.map(p => ({ label: p.customerName || p.name || p.id, value: p.id }));
      return base.concat(list);
    });
    function projectName(id) {
      if (!id) return '';
      const p = projects.value.find(x => x.id === id);
      return p ? (p.customerName || p.name || id) : '';
    }

    // ============ 列表数据 ============
    const list = Vue.ref([]);
    const loading = Vue.ref(false);

    function safeParse(str, fallback) {
      try { return JSON.parse(str || '[]'); } catch (e) { return fallback; }
    }

    function normalizeMeeting(m) {
      const participants = safeParse(m.participants, []);
      const agenda = safeParse(m.agenda, []);
      const decisions = safeParse(m.decisions, []);
      const actionItems = safeParse(m.actionItems, []);
      return {
        ...m,
        _participants: participants,
        _agenda: agenda,
        _decisions: decisions,
        _actionItems: actionItems,
        _participantCount: participants.length,
      };
    }

    async function loadList() {
      loading.value = true;
      try {
        const params = {};
        if (filterKeyword.value) params.keyword = filterKeyword.value;
        if (filterFrom.value) params.heldAtFrom = filterFrom.value;
        if (filterTo.value) params.heldAtTo = filterTo.value;
        if (filterProject.value) params.relatedProjectId = filterProject.value;
        const raw = await htdApi.get('/meetings', params);
        const arr = Array.isArray(raw) ? raw : [];
        list.value = arr.map(normalizeMeeting);
      } catch (e) {
        console.error('加载会议列表失败:', e);
        list.value = [];
      } finally {
        loading.value = false;
      }
    }

    async function loadProjects() {
      try {
        const raw = await htdApi.get('/projects');
        projects.value = Array.isArray(raw) ? raw : [];
      } catch (e) {
        projects.value = [];
      }
    }

    Vue.watch([filterKeyword, filterFrom, filterTo, filterProject], loadList);
    Vue.onMounted(() => { loadProjects(); loadList(); });

    // 时间格式化包装
    function formatDateTime(d) { return htdDate.formatDateTime(d); }

    // 将 ISO 时间转为 datetime-local 输入值（本地时区 YYYY-MM-DDTHH:mm）
    function isoToLocalInput(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function localInputToIso(v) {
      if (!v) return null;
      const d = new Date(v);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    }

    // ============ 新增 / 编辑弹窗 ============
    const formModalVisible = Vue.ref(false);
    const editingMeeting = Vue.ref(null);
    const formTitle = Vue.computed(() => editingMeeting.value ? '编辑会议' : '新增会议');
    const form = Vue.reactive({
      title: '',
      heldAt: '',              // datetime-local 字符串
      participantsText: '',    // 每行一个名字
      agenda: [],              // [{ title, detail }]
      decisions: [],           // [{ content, owner }]
      actionItems: [],         // [{ content, owner, due, done }]
      relatedProjectId: '',
    });

    function resetForm() {
      Object.assign(form, {
        title: '',
        heldAt: '',
        participantsText: '',
        agenda: [],
        decisions: [],
        actionItems: [],
        relatedProjectId: '',
      });
    }

    function openCreate() {
      editingMeeting.value = null;
      resetForm();
      formModalVisible.value = true;
    }

    function openEdit(meeting) {
      editingMeeting.value = meeting;
      const m = meeting;
      Object.assign(form, {
        title: m.title || '',
        heldAt: isoToLocalInput(m.heldAt),
        participantsText: (safeParse(m.participants, []).join('\n')),
        agenda: safeParse(m.agenda, []).map(a => ({ title: a.title || '', detail: a.detail || '' })),
        decisions: safeParse(m.decisions, []).map(d => ({ content: d.content || '', owner: d.owner || '' })),
        actionItems: safeParse(m.actionItems, []).map(a => ({
          content: a.content || '',
          owner: a.owner || '',
          due: a.due || '',
          done: !!a.done,
        })),
        relatedProjectId: m.relatedProjectId || '',
      });
      formModalVisible.value = true;
    }

    function closeForm() { formModalVisible.value = false; }

    // 动态行增删
    function addAgenda() { form.agenda.push({ title: '', detail: '' }); }
    function removeAgenda(i) { form.agenda.splice(i, 1); }
    function addDecision() { form.decisions.push({ content: '', owner: '' }); }
    function removeDecision(i) { form.decisions.splice(i, 1); }
    function addAction() { form.actionItems.push({ content: '', owner: '', due: '', done: false }); }
    function removeAction(i) { form.actionItems.splice(i, 1); }

    async function submitForm() {
      const title = (form.title || '').trim();
      if (!title) { showToast('会议主题不能为空', 'warning'); return; }
      if (!form.heldAt) { showToast('请选择召开时间', 'warning'); return; }
      const iso = localInputToIso(form.heldAt);
      if (!iso) { showToast('召开时间格式不正确', 'warning'); return; }

      const payload = {
        title,
        heldAt: iso,
        participants: (form.participantsText || '')
          .split('\n').map(s => s.trim()).filter(Boolean),
        agenda: form.agenda.filter(a => a.title || a.detail),
        decisions: form.decisions.filter(d => d.content || d.owner),
        actionItems: form.actionItems
          .filter(a => a.content || a.owner)
          .map(a => ({ content: a.content, owner: a.owner, due: a.due || '', done: !!a.done })),
        relatedProjectId: form.relatedProjectId || null,
      };

      try {
        if (editingMeeting.value) {
          await dataStore.updateMeeting(editingMeeting.value.id, payload);
        } else {
          await dataStore.createMeeting(payload);
        }
        formModalVisible.value = false;
        showToast('保存成功', 'success');
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 详情弹窗 ============
    const detailVisible = Vue.ref(false);
    const detailMeeting = Vue.ref(null);
    function openDetail(meeting) {
      detailMeeting.value = meeting;
      detailVisible.value = true;
    }
    function closeDetail() { detailVisible.value = false; }

    async function generateReview(meeting) {
      try {
        await dataStore.generateMeetingReview(meeting.id);
        showToast('已生成复盘草稿', 'success');
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    async function addActionToToday(a) {
      try {
        await htdApi.post('/todos', {
          title: '【会议行动项】' + (a.content || ''),
          category: '售前工作',
          priority: '中',
          todoDate: htdDate.today(),
          status: 'pending',
        });
        showToast('已加入今日', 'success');
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 删除 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(meeting) { delConfirm.value = meeting; }
    function cancelDelete() { delConfirm.value = null; }
    async function confirmDoDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteMeeting(delConfirm.value.id);
        delConfirm.value = null;
        showToast('删除成功', 'success');
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    return {
      // state
      filterKeyword, filterFrom, filterTo, filterProject,
      projectOptions, projects,
      list, loading,
      formModalVisible, editingMeeting, formTitle, form,
      detailVisible, detailMeeting,
      delConfirm,
      // actions
      loadList, loadProjects, formatDateTime, projectName,
      openCreate, openEdit, closeForm, submitForm,
      addAgenda, removeAgenda, addDecision, removeDecision, addAction, removeAction,
      openDetail, closeDetail, generateReview, addActionToToday,
      requestDelete, cancelDelete, confirmDoDelete,
    };
  },
  template: `
    <div class="list-page meeting-page">
      <!-- 筛选栏 -->
      <div class="htp-filter-bar">
        <div class="htp-filter-bar__item" style="min-width:200px">
          <htp-input v-model="filterKeyword" placeholder="搜索会议主题"></htp-input>
        </div>
        <div class="htp-filter-bar__item">
          <input type="date" class="htp-input" v-model="filterFrom" title="召开时间从" />
        </div>
        <div class="htp-filter-bar__item">
          <input type="date" class="htp-input" v-model="filterTo" title="召开时间至" />
        </div>
        <div class="htp-filter-bar__item">
          <htp-select v-model="filterProject" :options="projectOptions"></htp-select>
        </div>
        <div style="margin-left:auto">
          <button class="htp-btn htp-btn--primary" @click="openCreate">+ 新增会议</button>
        </div>
      </div>

      <!-- 列表区 -->
      <div class="list-container">
        <div class="list-header">
          <div class="list-header__title">会议纪要</div>
          <div class="list-header__meta">
            <span class="text-sm mr-md">共 {{ list.length }} 条</span>
          </div>
        </div>

        <div class="list-body">
          <div v-if="loading" class="text-center py-lg text-tertiary">加载中...</div>
          <div v-else-if="list.length === 0">
            <htp-empty text="暂无会议纪要，点击「新增会议」开始记录"></htp-empty>
          </div>
          <div v-else class="meeting-grid">
            <div
              v-for="m in list"
              :key="m.id"
              class="meeting-card"
              @click="openDetail(m)"
            >
              <div class="meeting-card__head">
                <div class="meeting-card__title text-ellipsis">{{ m.title }}</div>
                <div class="meeting-card__time text-sm text-tertiary">{{ formatDateTime(m.heldAt) }}</div>
              </div>
              <div class="meeting-card__meta text-sm text-tertiary">
                <span>参与人 {{ m._participantCount }} 人</span>
                <span v-if="m.relatedProjectId" class="ml-sm">· 项目：{{ projectName(m.relatedProjectId) }}</span>
              </div>
              <div class="meeting-card__foot">
                <htp-tag type="info">议题 {{ m._agenda.length }}</htp-tag>
                <htp-tag type="warning">决策 {{ m._decisions.length }}</htp-tag>
                <htp-tag type="success">行动项 {{ m._actionItems.length }}</htp-tag>
                <div class="ml-auto flex items-center gap-xs">
                  <button class="htp-btn htp-btn--primary htp-btn--sm" @click.stop="openEdit(m)">编辑</button>
                  <button class="htp-btn htp-btn--danger htp-btn--sm" @click.stop="requestDelete(m)">删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新增/编辑会议弹窗 -->
      <htp-modal
        :visible="formModalVisible"
        :title="formTitle"
        width="640px"
        confirmText="保存"
        @cancel="closeForm"
        @confirm="submitForm"
      >
        <div class="form-grid">
          <div class="form-item">
            <label class="form-item__label"><span class="text-danger">*</span> 会议主题</label>
            <htp-input v-model="form.title" placeholder="请输入会议主题" maxlength="200"></htp-input>
          </div>
          <div class="form-row-2">
            <div class="form-item">
              <label class="form-item__label"><span class="text-danger">*</span> 召开时间</label>
              <input type="datetime-local" class="htp-input" v-model="form.heldAt" />
              <div class="form-hint">格式：年/月/日 时:分（24 小时制）</div>
            </div>
            <div class="form-item">
              <label class="form-item__label">关联项目</label>
              <htp-select v-model="form.relatedProjectId" :options="projectOptions"></htp-select>
            </div>
          </div>
          <div class="form-item">
            <label class="form-item__label">参与人（每行一个）</label>
            <htp-textarea v-model="form.participantsText" :rows="3" placeholder="张三&#10;李四"></htp-textarea>
          </div>

          <!-- 议题 -->
          <div class="form-item">
            <div class="flex items-center justify-between mb-xs">
              <label class="form-item__label">会议议题</label>
              <button class="htp-btn htp-btn--primary htp-btn--sm" @click="addAgenda">+ 添加议题</button>
            </div>
            <div v-for="(a, i) in form.agenda" :key="i" class="dynamic-row">
              <htp-input v-model="a.title" placeholder="议题标题" class="flex-1"></htp-input>
              <htp-input v-model="a.detail" placeholder="议题说明" class="flex-1"></htp-input>
              <button class="htp-btn htp-btn--danger htp-btn--sm" @click="removeAgenda(i)">删除</button>
            </div>
            <div v-if="form.agenda.length === 0" class="form-empty">暂无议题</div>
          </div>

          <!-- 决策 -->
          <div class="form-item">
            <div class="flex items-center justify-between mb-xs">
              <label class="form-item__label">会议决策</label>
              <button class="htp-btn htp-btn--primary htp-btn--sm" @click="addDecision">+ 添加决策</button>
            </div>
            <div v-for="(d, i) in form.decisions" :key="i" class="dynamic-row">
              <htp-input v-model="d.content" placeholder="决策内容" class="flex-1"></htp-input>
              <htp-input v-model="d.owner" placeholder="负责人" style="max-width:160px"></htp-input>
              <button class="htp-btn htp-btn--danger htp-btn--sm" @click="removeDecision(i)">删除</button>
            </div>
            <div v-if="form.decisions.length === 0" class="form-empty">暂无决策</div>
          </div>

          <!-- 行动项 -->
          <div class="form-item">
            <div class="flex items-center justify-between mb-xs">
              <label class="form-item__label">行动项</label>
              <button class="htp-btn htp-btn--primary htp-btn--sm" @click="addAction">+ 添加行动项</button>
            </div>
            <div v-for="(a, i) in form.actionItems" :key="i" class="dynamic-row dynamic-row--action">
              <htp-input v-model="a.content" placeholder="行动内容" class="flex-1"></htp-input>
              <htp-input v-model="a.owner" placeholder="负责人" style="max-width:120px"></htp-input>
              <input type="date" class="htp-input" v-model="a.due" style="max-width:150px" title="截止日期" />
              <htp-checkbox v-model="a.done" label="已完成"></htp-checkbox>
              <button class="htp-btn htp-btn--danger htp-btn--sm" @click="removeAction(i)">删除</button>
            </div>
            <div v-if="form.actionItems.length === 0" class="form-empty">暂无行动项</div>
          </div>
        </div>
      </htp-modal>

      <!-- 会议详情弹窗 -->
      <htp-modal
        v-if="detailMeeting"
        :visible="detailVisible"
        :title="detailMeeting.title"
        width="680px"
        :showFooter="false"
        @cancel="closeDetail"
      >
        <div class="meeting-detail">
          <div class="meeting-detail__meta text-sm text-tertiary mb-base">
            <span>召开时间：{{ formatDateTime(detailMeeting.heldAt) }}</span>
            <span v-if="detailMeeting.relatedProjectId" class="ml-md">关联项目：{{ projectName(detailMeeting.relatedProjectId) }}</span>
            <span class="ml-md">参与人：{{ detailMeeting._participants.join('、') || '无' }}</span>
          </div>

          <section class="detail-section">
            <h4 class="detail-section__title">议题</h4>
            <ul v-if="detailMeeting._agenda.length" class="detail-list">
              <li v-for="(a, i) in detailMeeting._agenda" :key="i">
                <span class="text-primary font-medium">{{ a.title || '（未命名）' }}</span>
                <span v-if="a.detail" class="text-tertiary ml-sm">— {{ a.detail }}</span>
              </li>
            </ul>
            <div v-else class="text-sm text-tertiary">暂无议题</div>
          </section>

          <section class="detail-section">
            <h4 class="detail-section__title">决策</h4>
            <ul v-if="detailMeeting._decisions.length" class="detail-list">
              <li v-for="(d, i) in detailMeeting._decisions" :key="i">
                <span>{{ d.content || '（无内容）' }}</span>
                <htp-tag v-if="d.owner" type="info" class="ml-sm">{{ d.owner }}</htp-tag>
              </li>
            </ul>
            <div v-else class="text-sm text-tertiary">暂无决策</div>
          </section>

          <section class="detail-section">
            <h4 class="detail-section__title">行动项</h4>
            <ul v-if="detailMeeting._actionItems.length" class="detail-list">
              <li v-for="(a, i) in detailMeeting._actionItems" :key="i" class="action-item">
                <span :class="{ 'text-tertiary line-through': a.done }">{{ a.content || '（无内容）' }}</span>
                <htp-tag v-if="a.owner" type="info" class="ml-sm">{{ a.owner }}</htp-tag>
                <htp-tag v-if="a.due" type="default" class="ml-sm">截止 {{ a.due }}</htp-tag>
                <htp-tag v-if="a.done" type="success" class="ml-sm">已完成</htp-tag>
                <button class="htp-btn htp-btn--primary htp-btn--sm ml-auto" @click="addActionToToday(a)"><span v-html="htdIcon('plus')"></span> 今日</button>
              </li>
            </ul>
            <div v-else class="text-sm text-tertiary">暂无行动项</div>
          </section>

          <div class="text-right mt-base">
            <button class="htp-btn htp-btn--primary" @click="generateReview(detailMeeting)">生成复盘</button>
          </div>
        </div>
      </htp-modal>

      <!-- 删除二次确认弹窗 -->
      <htp-modal
        v-if="delConfirm"
        :visible="!!delConfirm"
        title="确认删除会议？"
        confirmText="确认删除"
        confirmType="danger"
        @cancel="cancelDelete"
        @confirm="confirmDoDelete"
      >
        <div class="py-sm">
          <div class="text-tertiary mb-xs">删除后不可恢复，确定要删除以下会议吗？</div>
          <div class="text-primary font-medium bg-bg-tertiary rounded p-sm">
            {{ delConfirm.title }}
          </div>
        </div>
      </htp-modal>
    </div>
  `,
};

window.MeetingPage = MeetingPage;

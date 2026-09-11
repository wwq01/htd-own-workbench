/**
 * ReviewPage - 复盘与沉淀页面（阶段 4）
 * 功能：周复盘 + 项目复盘（双模板）+ 一键生成本周周复盘（自动统计）+ 项目联动
 */
const REVIEW_RESULT_OPTIONS = [
  { label: '成单', value: '成单' },
  { label: '丢单', value: '丢单' },
  { label: '暂停', value: '暂停' },
  { label: '持续跟进', value: '持续跟进' },
];

const ReviewPage = {
  name: 'ReviewPage',
  setup() {
    const dataStore = useDataStore();

    // ============ 标签 ============
    const activeTab = Vue.ref('week'); // week / project
    function switchTab(tab) {
      activeTab.value = tab;
      loadList();
    }

    // ============ 列表 ============
    const list = Vue.ref([]);
    const loading = Vue.ref(false);

    async function loadList() {
      loading.value = true;
      try {
        const params = { type: activeTab.value };
        const raw = await htdApi.get('/reviews', params);
        list.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) {
        list.value = [];
      } finally {
        loading.value = false;
      }
    }
    Vue.onMounted(loadList);

    // ============ 一键生成本周周复盘 ============
    const generating = Vue.ref(false);
    async function generateCurrentWeek() {
      generating.value = true;
      try {
        const r = await dataStore.createCurrentWeekReview({});
        if (r.created) {
          showToast('本周周复盘已生成', 'success');
          await loadList();
          if (r.review && r.review.id) openEdit(r.review);
        } else {
          showToast('本周周复盘已存在', 'info');
          if (r.review && r.review.id) openEdit(r.review);
        }
      } catch (e) { /* toast 已显示 */ }
      finally { generating.value = false; }
    }

    // ============ 编辑弹窗 ============
    const modalVisible = Vue.ref(false);
    const editing = Vue.ref(null);
    const formTitle = Vue.computed(() => {
      if (!editing.value) return '新建复盘';
      return editing.value.type === 'week' ? '编辑周复盘' : '编辑项目复盘';
    });

    // 周复盘表单
    const weekForm = Vue.reactive({
      type: 'week', weekKey: '', projectId: null,
      highlights: '', pitfalls: '', reusableExperience: '', improvements: '',
      remark: '',
    });
    // 项目复盘表单
    const projectForm = Vue.reactive({
      type: 'project', weekKey: null, projectId: null,
      customerPainPoints: '', presentationHighlights: '', exposedWeakness: '',
      reusableTips: '', reviewResult: '',
      remark: '',
    });

    function openEdit(item) {
      editing.value = item;
      if (item.type === 'week') {
        Object.assign(weekForm, {
          type: 'week',
          weekKey: item.weekKey || '',
          projectId: item.projectId || null,
          highlights: item.highlights || '',
          pitfalls: item.pitfalls || '',
          reusableExperience: item.reusableExperience || '',
          improvements: item.improvements || '',
          remark: item.remark || '',
        });
      } else {
        Object.assign(projectForm, {
          type: 'project',
          weekKey: item.weekKey || null,
          projectId: item.projectId || null,
          customerPainPoints: item.customerPainPoints || '',
          presentationHighlights: item.presentationHighlights || '',
          exposedWeakness: item.exposedWeakness || '',
          reusableTips: item.reusableTips || '',
          reviewResult: item.reviewResult || '',
          remark: item.remark || '',
        });
      }
      modalVisible.value = true;
    }

    async function submitForm() {
      if (!editing.value) {
        showToast('请先选择一条复盘', 'warning');
        return;
      }
      const t = editing.value.type;
      const payload = t === 'week'
        ? {
            type: 'week',
            weekKey: weekForm.weekKey || null,
            projectId: weekForm.projectId || null,
            highlights: weekForm.highlights || null,
            pitfalls: weekForm.pitfalls || null,
            reusableExperience: weekForm.reusableExperience || null,
            improvements: weekForm.improvements || null,
            remark: weekForm.remark || null,
          }
        : {
            type: 'project',
            weekKey: projectForm.weekKey || null,
            projectId: projectForm.projectId || null,
            customerPainPoints: projectForm.customerPainPoints || null,
            presentationHighlights: projectForm.presentationHighlights || null,
            exposedWeakness: projectForm.exposedWeakness || null,
            reusableTips: projectForm.reusableTips || null,
            reviewResult: projectForm.reviewResult || null,
            remark: projectForm.remark || null,
          };
      try {
        await dataStore.updateReview(editing.value.id, payload);
        modalVisible.value = false;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 删除二次确认 ============
    const delConfirm = Vue.ref(null);
    function requestDelete(item) { delConfirm.value = item; }
    async function confirmDelete() {
      if (!delConfirm.value) return;
      try {
        await dataStore.deleteReview(delConfirm.value.id);
        delConfirm.value = null;
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }

    // ============ 状态机操作（§6.2.3） ============
    async function submitReview(item) {
      try {
        await dataStore.reviewSubmit(item.id);
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }
    async function precipitateReview(item) {
      try {
        await dataStore.reviewPrecipitate(item.id);
        await loadList();
      } catch (e) { /* toast 已显示 */ }
    }
    function reviewStatusLabel(s) {
      if (s === 'submitted') return '已提交';
      if (s === 'precipitated') return '已沉淀';
      return '草稿';
    }
    function reviewStatusType(s) {
      if (s === 'submitted') return 'warning';
      if (s === 'precipitated') return 'success';
      return 'default';
    }

    // ============ 辅助 ============
    function currentForm() {
      return editing.value && editing.value.type === 'week' ? weekForm : projectForm;
    }
    function resultType(r) {
      if (r === '成单') return 'success';
      if (r === '丢单') return 'danger';
      if (r === '暂停') return 'default';
      return 'primary'; // 持续跟进
    }
    function isFilled(field) {
      const f = currentForm();
      return !!(f[field] && String(f[field]).trim());
    }
    function filledCount(fields) {
      let n = 0;
      for (const k of fields) if (isFilled(k)) n++;
      return n;
    }
    function totalFields(type) {
      if (type === 'week') return 4; // highlights/pitfalls/reusableExperience/improvements
      return 5; // customerPainPoints/presentationHighlights/exposedWeakness/reusableTips/reviewResult
    }
    function filledCountByType(item) {
      if (item.type === 'week') {
        return [item.highlights, item.pitfalls, item.reusableExperience, item.improvements]
          .filter(v => v && String(v).trim()).length;
      }
      return [item.customerPainPoints, item.presentationHighlights, item.exposedWeakness, item.reusableTips, item.reviewResult]
        .filter(v => v && String(v).trim()).length;
    }
    function autoDataSummary(item) {
      const a = item.autoData || {};
      const lines = [];
      if (a.weekKey) lines.push(`周次：${a.weekKey}`);
      if (a.weekStart) lines.push(`区间：${a.weekStart} ~ ${a.weekEnd}`);
      if (typeof a.todoTotal === 'number') {
        lines.push(`待办：${a.todoDone}/${a.todoTotal}（${a.todoCompletionRate || 0}%）`);
      }
      if (typeof a.studyHours === 'number') lines.push(`学习：${a.studyHours}h`);
      if (typeof a.issueTouched === 'number') lines.push(`触达问题：${a.issueTouched}`);
      if (Array.isArray(a.activeProjects) && a.activeProjects.length) {
        lines.push(`活跃项目：${a.activeProjects.length}`);
      }
      return lines;
    }
    function projectLabel(item) {
      if (item.type !== 'project' || !item.project) return '';
      return `${item.project.customerName}（${item.project.phase}）`;
    }
    function projectPriorityLabel(item) {
      if (item.type !== 'project' || !item.project) return '';
      const p = item.project.priority;
      if (!p) return '';
      return p;
    }

    return {
      activeTab, switchTab,
      list, loading, loadList,
      generating, generateCurrentWeek,
      modalVisible, editing, formTitle,
      weekForm, projectForm,
      openEdit, submitForm,
      delConfirm, requestDelete, confirmDelete,
      submitReview, precipitateReview, reviewStatusLabel, reviewStatusType,
      currentForm, resultType, isFilled, filledCount, totalFields, filledCountByType, autoDataSummary, projectLabel, projectPriorityLabel,
      REVIEW_RESULT_OPTIONS,
    };
  },
  template: `
    <div class="list-page">
      <!-- 标签 + 顶部操作 -->
      <div class="review-topbar">
        <div class="htp-tabs">
          <button class="htp-tab" :class="{ 'htp-tab--active': activeTab === 'week' }" @click="switchTab('week')">周复盘</button>
          <button class="htp-tab" :class="{ 'htp-tab--active': activeTab === 'project' }" @click="switchTab('project')">项目复盘</button>
        </div>
        <div v-if="activeTab === 'week'" class="review-topbar__actions">
          <button class="htp-btn htp-btn--primary htp-btn--sm" :disabled="generating" @click="generateCurrentWeek">
            {{ generating ? '生成中...' : '一键生成本周周复盘' }}
          </button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="list.length === 0 && !loading" style="padding: 40px;">
        <htp-empty :text="activeTab === 'week' ? '暂无周复盘，点击「一键生成本周周复盘」开始' : '暂无项目复盘，去项目管理页生成吧'"></htp-empty>
      </div>

      <!-- 列表 -->
      <div v-else class="review-list">
        <div class="review-card" v-for="item in list" :key="item.id">
          <div class="review-card__header">
            <div class="review-card__title">
              <htp-tag v-if="item.type === 'week'" type="primary">周复盘</htp-tag>
              <htp-tag v-else type="purple">项目复盘</htp-tag>
              <span class="text-primary font-medium">
                {{ item.type === 'week' ? (item.weekKey || '—') : projectLabel(item) || '未关联项目' }}
              </span>
              <htp-tag v-if="item.type === 'project' && item.reviewResult" :type="resultType(item.reviewResult)">{{ item.reviewResult }}</htp-tag>
            </div>
            <div class="review-card__meta">
              <htp-tag :type="reviewStatusType(item.status)">{{ reviewStatusLabel(item.status) }}</htp-tag>
              <span class="text-tertiary text-sm">
                {{ filledCountByType(item) }} / {{ totalFields(item.type) }} 字段已填写
              </span>
            </div>
          </div>

          <!-- 自动统计预览 -->
          <div v-if="item.autoData && Object.keys(item.autoData).length" class="review-card__auto">
            <span class="text-tertiary text-sm">自动统计：</span>
            <span v-for="(line, idx) in autoDataSummary(item)" :key="idx" class="review-card__auto-item">
              {{ line }}<span v-if="idx < autoDataSummary(item).length - 1"> · </span>
            </span>
          </div>

          <!-- 周复盘字段预览 -->
          <div v-if="item.type === 'week'" class="review-card__preview">
            <div v-if="item.highlights" class="review-card__line">
              <span class="text-tertiary">亮点：</span>{{ item.highlights }}
            </div>
            <div v-if="item.pitfalls" class="review-card__line">
              <span class="text-tertiary">踩坑：</span>{{ item.pitfalls }}
            </div>
            <div v-if="item.reusableExperience" class="review-card__line">
              <span class="text-tertiary">可复用：</span>{{ item.reusableExperience }}
            </div>
            <div v-if="item.improvements" class="review-card__line">
              <span class="text-tertiary">改进：</span>{{ item.improvements }}
            </div>
          </div>

          <!-- 项目复盘字段预览 -->
          <div v-else class="review-card__preview">
            <div v-if="item.customerPainPoints" class="review-card__line">
              <span class="text-tertiary">痛点：</span>{{ item.customerPainPoints }}
            </div>
            <div v-if="item.presentationHighlights" class="review-card__line">
              <span class="text-tertiary">方案加分：</span>{{ item.presentationHighlights }}
            </div>
            <div v-if="item.exposedWeakness" class="review-card__line">
              <span class="text-tertiary">暴露不足：</span>{{ item.exposedWeakness }}
            </div>
            <div v-if="item.reusableTips" class="review-card__line">
              <span class="text-tertiary">可复用技巧：</span>{{ item.reusableTips }}
            </div>
          </div>

          <div v-if="item.remark" class="review-card__remark">
            <span class="text-tertiary text-sm">{{ item.remark }}</span>
          </div>

          <div class="review-card__actions">
            <button
              v-if="item.status === 'draft'"
              class="htp-btn htp-btn--primary htp-btn--sm"
              @click="submitReview(item)"
            >提交</button>
            <button
              v-if="item.status === 'submitted'"
              class="htp-btn htp-btn--primary htp-btn--sm"
              @click="precipitateReview(item)"
            >生成沉淀</button>
            <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="openEdit(item)">编辑</button>
            <button class="htp-btn htp-btn--danger htp-btn--sm" @click="requestDelete(item)">删除</button>
          </div>
        </div>
      </div>

      <!-- 编辑弹窗 -->
      <htp-modal v-if="modalVisible && editing" :visible="true" :title="formTitle" @cancel="modalVisible = false" width="800px">
        <!-- 周复盘表单 -->
        <div v-if="editing.type === 'week'" class="form-grid">
          <div class="form-grid--full">
            <label class="form-label">周次标识</label>
            <HtpInput v-model="weekForm.weekKey" placeholder="如：2026-W32"  />
          </div>
          <div class="form-grid--full">
            <label class="form-label">本周核心成果亮点</label>
            <textarea class="htp-textarea" v-model="weekForm.highlights" rows="4" placeholder="本周完成的关键成果、突破..."></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">踩坑与不足</label>
            <textarea class="htp-textarea" v-model="weekForm.pitfalls" rows="4" placeholder="遇到的问题、踩过的坑、不足之处..."></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">沉淀可复用经验</label>
            <textarea class="htp-textarea" v-model="weekForm.reusableExperience" rows="4" placeholder="方法论、模板、套路、SOP..."></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">下周改进方向</label>
            <textarea class="htp-textarea" v-model="weekForm.improvements" rows="4" placeholder="下周要重点改进的点..."></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">备注</label>
            <HtpInput v-model="weekForm.remark" placeholder="可选"  />
          </div>
        </div>

        <!-- 项目复盘表单 -->
        <div v-else class="form-grid">
          <div v-if="editing.project" class="form-grid--full">
            <label class="form-label">关联项目</label>
            <div class="bg-bg-tertiary rounded p-sm">
              <span class="text-primary font-medium">{{ editing.project.customerName }}</span>
              <htp-tag class="ml-sm" type="info">{{ editing.project.phase }}</htp-tag>
              <htp-tag v-if="editing.project.priority" class="ml-sm" type="warning">{{ editing.project.priority }}</htp-tag>
            </div>
          </div>
          <div class="form-grid--full">
            <label class="form-label">客户核心痛点与关注点</label>
            <textarea class="htp-textarea" v-model="projectForm.customerPainPoints" rows="3"></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">方案/演示加分项</label>
            <textarea class="htp-textarea" v-model="projectForm.presentationHighlights" rows="3"></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">暴露的不足</label>
            <textarea class="htp-textarea" v-model="projectForm.exposedWeakness" rows="3"></textarea>
          </div>
          <div class="form-grid--full">
            <label class="form-label">可复用经验技巧</label>
            <textarea class="htp-textarea" v-model="projectForm.reusableTips" rows="3"></textarea>
          </div>
          <div>
            <label class="form-label">复盘结果</label>
            <htp-select v-model="projectForm.reviewResult" :options="[{label:'未选择', value:''}, ...REVIEW_RESULT_OPTIONS]" placeholder="请选择"></htp-select>
          </div>
          <div>
            <label class="form-label">备注</label>
            <HtpInput v-model="projectForm.remark"  />
          </div>
        </div>

        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="modalVisible = false">取消</button>
          <button class="htp-btn htp-btn--primary" @click="submitForm">保存</button>
        </template>
      </htp-modal>

      <!-- 删除确认 -->
      <htp-modal v-if="delConfirm" :visible="true" title="确认删除？" @cancel="delConfirm = null">
        <p>删除后不可恢复，确认删除以下复盘吗？</p>
        <p style="font-weight: 500; margin-top: 8px;">
          {{ delConfirm.type === 'week' ? (delConfirm.weekKey || '周复盘') : (projectLabel(delConfirm) || '项目复盘') }}
        </p>
        <template #footer>
          <button class="htp-btn htp-btn--secondary" @click="delConfirm = null">取消</button>
          <button class="htp-btn htp-btn--danger" @click="confirmDelete">确认删除</button>
        </template>
      </htp-modal>
    </div>
  `,
};
window.ReviewPage = ReviewPage;

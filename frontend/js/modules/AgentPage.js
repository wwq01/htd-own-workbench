/**
 * AgentPage - 本地 Agent 通道（V2-1：agent-inbox + Skills + JobRunner）
 * 功能：提交指令 → 本地技能执行 → 结果落收件箱，可回溯/重跑/删除。
 */
const AGENT_STATUS_TAG = {
  pending: { type: 'info', label: '待执行' },
  running: { type: 'warning', label: '执行中' },
  succeeded: { type: 'success', label: '已完成' },
  failed: { type: 'danger', label: '失败' },
  cancelled: { type: 'default', label: '已取消' },
};

const AgentPage = {
  name: 'AgentPage',
  setup() {
    const skills = Vue.ref([]);
    const tasks = Vue.ref([]);
    const loading = Vue.ref(false);
    const submitting = Vue.ref(false);
    const detail = Vue.ref(null);

    const form = Vue.reactive({
      title: '',
      prompt: '',
      skillKey: 'auto',
    });

    async function loadSkills() {
      try {
        const raw = await htdApi.get('/agent/skills');
        skills.value = Array.isArray(raw) ? raw : (raw.list || []);
      } catch (e) { /* 静默 */ }
    }

    async function loadTasks() {
      loading.value = true;
      try {
        const raw = await htdApi.get('/agent/tasks', { limit: 50 });
        const list = Array.isArray(raw) ? raw : (raw.list || []);
        tasks.value = list;
      } catch (e) {
        tasks.value = [];
      } finally {
        loading.value = false;
      }
    }

    Vue.onMounted(() => { loadSkills(); loadTasks(); });

    async function submit() {
      if (!form.prompt.trim()) { showToast('请填写指令内容', 'warning'); return; }
      submitting.value = true;
      try {
        await htdApi.post('/agent/tasks', {
          title: form.title.trim() || undefined,
          prompt: form.prompt.trim(),
          skillKey: form.skillKey || 'auto',
        });
        form.title = '';
        form.prompt = '';
        form.skillKey = 'auto';
        showToast('已提交并执行', 'success');
        await loadTasks();
      } catch (e) { /* htdApi 已提示 */ }
      finally { submitting.value = false; }
    }

    async function runAgain(id) {
      try {
        await htdApi.post(`/agent/tasks/${id}/run`);
        showToast('已重新执行', 'success');
        await loadTasks();
        if (detail.value && detail.value.id === id) detail.value = tasks.value.find(t => t.id === id) || null;
      } catch (e) { /* 静默 */ }
    }

    async function removeTask(id) {
      if (!window.confirm('确认删除该任务？删除后不可恢复。')) return;
      try {
        await htdApi.del(`/agent/tasks/${id}`);
        if (detail.value && detail.value.id === id) detail.value = null;
        await loadTasks();
        showToast('已删除', 'success');
      } catch (e) { /* 静默 */ }
    }

    function selectTask(t) { detail.value = t; }

    function statusTag(status) {
      return AGENT_STATUS_TAG[status] || { type: 'default', label: status };
    }

    function formatResult(result) {
      if (!result) return '';
      try {
        return JSON.stringify(result.output ?? result, null, 2);
      } catch {
        return String(result);
      }
    }

    return {
      skills, tasks, loading, submitting, detail, form,
      loadSkills, loadTasks, submit, runAgain, removeTask, selectTask,
      statusTag, formatResult,
    };
  },
  template: `
  <div class="list-page agent-page">
    <!-- 提交区 -->
    <div class="agent-compose htp-card">
      <div class="agent-compose__title">给本地 Agent 派个活</div>
      <div class="agent-compose__hint">所有指令在本机执行，不联网、不上传你的数据。</div>
      <div class="form-grid">
        <div class="form-grid--full">
          <label class="form-label">指令内容 *</label>
          <textarea class="htp-textarea" v-model="form.prompt" rows="3"
            placeholder="例如：总结一下我的 vault 沉淀库 / 把下面的内容整理成待办：- 写周报&#10;- 预约会议"></textarea>
        </div>
        <div>
          <label class="form-label">标题（可选）</label>
          <HtpInput v-model="form.title" placeholder="自动从指令生成" />
        </div>
        <div>
          <label class="form-label">技能</label>
          <htp-select v-model="form.skillKey"
            :options="[{value:'auto',label:'自动匹配'}].concat(skills.map(s=>({value:s.key,label:s.title})))"
            placeholder="自动匹配"></htp-select>
        </div>
        <div style="display:flex;align-items:flex-end;">
          <button class="htp-btn htp-btn--primary" :disabled="submitting" @click="submit">
            {{ submitting ? '执行中…' : '提交并执行' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 列表 + 详情 -->
    <div class="agent-body">
      <div class="agent-list">
        <div v-if="loading" class="text-tertiary" style="padding:16px;">加载中…</div>
        <div v-else-if="tasks.length === 0" style="padding:40px;">
          <htp-empty text="收件箱为空，派个任务试试"></htp-empty>
        </div>
        <div v-for="t in tasks" :key="t.id" class="agent-item" :class="{'agent-item--active': detail && detail.id===t.id}" @click="selectTask(t)">
          <div class="agent-item__head">
            <span class="agent-item__title">{{ t.title }}</span>
            <htp-tag :type="statusTag(t.status).type">{{ statusTag(t.status).label }}</htp-tag>
          </div>
          <div class="agent-item__prompt text-tertiary">{{ t.prompt }}</div>
          <div class="agent-item__foot">
            <span class="text-tertiary">{{ t.result && t.result.skill ? '技能：'+t.result.skill : '' }}</span>
            <span>
              <button class="htp-btn htp-btn--text htp-btn--sm" @click.stop="runAgain(t.id)">重跑</button>
              <button class="htp-btn htp-btn--text htp-btn--sm htp-btn--danger" @click.stop="removeTask(t.id)">删除</button>
            </span>
          </div>
        </div>
      </div>

      <div class="agent-detail">
        <div v-if="!detail" class="text-tertiary" style="padding:40px;">从左侧选择一个任务查看结果</div>
        <div v-else class="htp-card">
          <div class="agent-detail__head">
            <span class="agent-detail__title">{{ detail.title }}</span>
            <htp-tag :type="statusTag(detail.status).type">{{ statusTag(detail.status).label }}</htp-tag>
          </div>
          <div class="agent-detail__prompt"><span class="text-tertiary">指令：</span>{{ detail.prompt }}</div>
          <div v-if="detail.error" class="agent-detail__error">失败原因：{{ detail.error }}</div>
          <div v-if="detail.result" class="agent-detail__result">
            <div class="text-tertiary" style="margin-bottom:6px;">执行结果（技能：{{ detail.result.skill }}）</div>
            <pre class="agent-result-pre">{{ formatResult(detail.result) }}</pre>
          </div>
          <div class="agent-detail__actions">
            <button class="htp-btn htp-btn--secondary htp-btn--sm" @click="runAgain(detail.id)">重新执行</button>
            <button class="htp-btn htp-btn--danger htp-btn--sm" @click="removeTask(detail.id)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
};
window.AgentPage = AgentPage;

/**
 * 业务数据缓存：首页统计数据、通用动作封装
 */
const useDataStore = Pinia.defineStore('data', {
  state: () => ({
    // 首页统计数据
    statistics: {
      projectCount: 0,
      devIssueCount: 0,
      todayTodoCount: 0,
      weekStudyHours: 0,
      memoCount: 0,
      entertainmentWantCount: 0,
      entertainmentPlayingCount: 0,
      secretCount: 0,
      deploymentCount: 0,
      upcomingMilestones: [],
      recentMemos: [],
      tomorrowTodos: [],
    },

    // 全局备忘列表（顶部快速备忘用）
    recentMemos: [],

    // 各模块数据条目统计
    dataStats: [],

    // 首页三栏聚合数据（V1.3 §6.1）
    homeSummary: null,

    // 字段 / 状态机配置（V1.5 §8.3）：下拉项 / 自定义字段 / 状态机迁移
    fieldConfig: null,
  }),

  actions: {
    // ============ 首页聚合 ============
    // 拉取首页统计数据
    async fetchStatistics() {
      try {
        const data = await htdApi.get('/system/statistics');
        this.statistics = { ...this.statistics, ...data };
      } catch (err) {
        console.error('获取统计数据失败:', err);
      }
    },

    // 拉取首页三栏聚合数据（V1.3 §6.1）
    async fetchHomeSummary() {
      try {
        const data = await htdApi.get('/system/home-summary');
        this.homeSummary = data;
      } catch (err) {
        console.error('获取首页三栏数据失败:', err);
      }
    },

    // 拉取图表聚合数据（V1.5 §8.1）：首页 / 学习 / 财务
    async fetchCharts() {
      return htdApi.get('/system/charts');
    },

    // 拉取项目详情图表（V1.5 §8.1）：里程碑时间线 + 任务速率
    async fetchProjectCharts(projectId) {
      return htdApi.get('/system/project-charts', { projectId });
    },

    // 拉取字段 / 状态机配置（V1.5 §8.3），缓存于 store 供各模块下拉与状态机消费
    async fetchFieldConfig() {
      try {
        const data = await htdApi.get('/system/field-config');
        this.fieldConfig = data;
        return data;
      } catch (err) {
        console.error('获取字段配置失败:', err);
        return null;
      }
    },

    // 首页知识栏「一键生成沉淀草稿」（§6.8.5）
    async autoRecommendVault(candidate) {
      const r = await htdApi.post('/system/home-recommend', candidate);
      showToast('沉淀草稿已生成', 'success');
      await this.fetchHomeSummary();
      return r;
    },

    // 拉取最近备忘
    async fetchRecentMemos() {
      try {
        const data = await htdApi.get('/system/statistics');
        this.recentMemos = data.recentMemos || [];
      } catch (err) {
        console.error('获取最近备忘失败:', err);
      }
    },

    // 拉取各模块数据条目统计
    async fetchDataStats() {
      try {
        const data = await htdApi.get('/system/data-stats');
        this.dataStats = data.stats || [];
      } catch (err) {
        console.error('获取数据统计失败:', err);
      }
    },

    // 刷新首页相关的所有全局数据（增删后调用）
    async refreshAll() {
      const appStore = useAppStore();
      await Promise.all([
        this.fetchStatistics(),
        this.fetchHomeSummary(),
        appStore.refreshDataCount(),
      ]);
    },

    // ============ 备忘模块 ============
    // 新增备忘（快速备忘入口）
    async createMemo(content) {
      const trimmed = (content || '').trim();
      if (!trimmed) {
        showToast('备忘内容不能为空', 'warning');
        return null;
      }
      const created = await htdApi.post('/memos', { content: trimmed });
      showToast('备忘已保存', 'success');
      await this.refreshAll();
      return created;
    },

    // 删除备忘（首页快捷删除）
    async deleteMemo(id) {
      if (!id) return;
      await htdApi.del(`/memos/${id}`);
      showToast('备忘已删除', 'success');
      await this.refreshAll();
    },

    // ============ 待办模块 ============
    // 新增待办
    async createTodo(payload) {
      const r = await htdApi.post('/todos', payload);
      showToast('已创建待办', 'success');
      await this.refreshAll();
      return r;
    },

    // 编辑待办
    async updateTodo(id, payload) {
      const r = await htdApi.put(`/todos/${id}`, payload);
      showToast('已更新待办', 'success');
      await this.refreshAll();
      return r;
    },

    // 删除待办
    async deleteTodo(id) {
      await htdApi.del(`/todos/${id}`);
      showToast('已删除待办', 'success');
      await this.refreshAll();
    },

    // 切换完成状态
    async toggleTodo(id) {
      return htdApi.post(`/todos/${id}/toggle`);
    },

    // 延期任务（切 DELAYED + 顺延 todoDate，§6.2.1）
    async delayTodo(id, payload) {
      const r = await htdApi.post(`/todos/${id}/delay`, payload);
      showToast('已延期', 'success');
      await this.refreshAll();
      return r;
    },

    // 直接切换任务状态（走状态机校验，§6.2.1）
    async changeTodoStatus(id, status) {
      const r = await htdApi.post(`/todos/${id}/status`, { status });
      showToast('状态已更新', 'success');
      await this.refreshAll();
      return r;
    },

    // 今日未完成 → 明日
    async migrateTodayPendingToTomorrow() {
      const r = await htdApi.post('/todos/migrate/today-to-tomorrow');
      showToast(`已迁移 ${r.movedCount || 0} 条到明日`, 'success');
      await this.refreshAll();
      return r;
    },

    // 明日所有 → 今日
    async migrateTomorrowToToday() {
      const r = await htdApi.post('/todos/migrate/tomorrow-to-today');
      showToast(`已迁移 ${r.movedCount || 0} 条到今日`, 'success');
      await this.refreshAll();
      return r;
    },

    // ============ 项目模块 ============
    // 项目列表（带筛选）
    async fetchProjects(query = {}) {
      return htdApi.get('/projects', query);
    },

    // 项目详情（含里程碑 + 任务）
    async fetchProjectDetail(id) {
      return htdApi.get(`/projects/${id}`);
    },

    // 新增项目
    async createProject(payload) {
      const r = await htdApi.post('/projects', payload);
      showToast('项目已创建', 'success');
      await this.refreshAll();
      return r;
    },

    // 编辑项目
    async updateProject(id, payload) {
      const r = await htdApi.put(`/projects/${id}`, payload);
      showToast('项目已更新', 'success');
      await this.refreshAll();
      return r;
    },

    // 更新项目备忘（失焦自动保存）
    async updateProjectMemo(id, projectMemo) {
      const r = await htdApi.patch(`/projects/${id}/memo`, { projectMemo });
      return r;
    },

    // 删除项目（级联删除里程碑 + 任务）
    async deleteProject(id) {
      await htdApi.del(`/projects/${id}`);
      showToast('项目已删除', 'success');
      await this.refreshAll();
    },

    // 一键生成项目复盘
    async generateProjectReview(id) {
      const r = await htdApi.post(`/projects/${id}/generate-review`);
      showToast(r.created === false ? '已存在复盘草稿' : '复盘草稿已生成', 'success');
      return r;
    },

    // 项目阶段切换（走 6 阶段状态机校验，§6.2.2）
    async changeProjectPhase(id, phase, reason) {
      const r = await htdApi.post(`/projects/${id}/phase`, { phase, reason });
      showToast('阶段已更新', 'success');
      await this.refreshAll();
      return r;
    },

    // ============ 项目里程碑模块 ============
    async fetchMilestones(projectId) {
      return htdApi.get('/milestones', { projectId });
    },

    async createMilestone(payload) {
      const r = await htdApi.post('/milestones', payload);
      showToast('里程碑已添加', 'success');
      await this.refreshAll();
      return r;
    },

    async updateMilestone(id, payload) {
      const r = await htdApi.put(`/milestones/${id}`, payload);
      showToast('里程碑已更新', 'success');
      await this.refreshAll();
      return r;
    },

    async deleteMilestone(id) {
      await htdApi.del(`/milestones/${id}`);
      showToast('里程碑已删除', 'success');
      await this.refreshAll();
    },

    async toggleMilestone(id) {
      return htdApi.post(`/milestones/${id}/toggle`);
    },

    // ============ 项目任务模块 ============
    async fetchTasks(projectId) {
      return htdApi.get('/tasks', { projectId });
    },

    async createTask(payload) {
      const r = await htdApi.post('/tasks', payload);
      showToast('任务已添加', 'success');
      await this.refreshAll();
      return r;
    },

    async updateTask(id, payload) {
      const r = await htdApi.put(`/tasks/${id}`, payload);
      showToast('任务已更新', 'success');
      await this.refreshAll();
      return r;
    },

    async deleteTask(id) {
      await htdApi.del(`/tasks/${id}`);
      showToast('任务已删除', 'success');
      await this.refreshAll();
    },

    async toggleTask(id) {
      return htdApi.post(`/tasks/${id}/toggle`);
    },

    // ============ 开发项目模块 ============
    async fetchDevProjects(query = {}) {
      return htdApi.get('/dev-projects', query);
    },
    async createDevProject(payload) {
      const r = await htdApi.post('/dev-projects', payload);
      showToast('开发项目已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateDevProject(id, payload) {
      const r = await htdApi.put(`/dev-projects/${id}`, payload);
      showToast('开发项目已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteDevProject(id) {
      await htdApi.del(`/dev-projects/${id}`);
      showToast('开发项目已删除', 'success');
      await this.refreshAll();
    },

    // ============ 代码片段模块 ============
    async fetchDevSnippets(query = {}) {
      return htdApi.get('/dev-snippets', query);
    },
    async createDevSnippet(payload) {
      const r = await htdApi.post('/dev-snippets', payload);
      showToast('代码片段已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateDevSnippet(id, payload) {
      const r = await htdApi.put(`/dev-snippets/${id}`, payload);
      showToast('代码片段已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteDevSnippet(id) {
      await htdApi.del(`/dev-snippets/${id}`);
      showToast('代码片段已删除', 'success');
      await this.refreshAll();
    },

    // ============ 开发问题模块 ============
    async fetchDevIssues(query = {}) {
      return htdApi.get('/dev-issues', query);
    },
    async createDevIssue(payload) {
      const r = await htdApi.post('/dev-issues', payload);
      showToast('问题记录已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateDevIssue(id, payload) {
      const r = await htdApi.put(`/dev-issues/${id}`, payload);
      showToast('问题记录已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteDevIssue(id) {
      await htdApi.del(`/dev-issues/${id}`);
      showToast('问题记录已删除', 'success');
      await this.refreshAll();
    },

    // ============ 学习记录模块 ============
    async fetchStudyRecords(query = {}) {
      return htdApi.get('/study-records', query);
    },
    async fetchStudyStats() {
      return htdApi.get('/study-records/stats');
    },
    async createStudyRecord(payload) {
      const r = await htdApi.post('/study-records', payload);
      showToast('学习记录已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateStudyRecord(id, payload) {
      const r = await htdApi.put(`/study-records/${id}`, payload);
      showToast('学习记录已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteStudyRecord(id) {
      await htdApi.del(`/study-records/${id}`);
      showToast('学习记录已删除', 'success');
      await this.refreshAll();
    },

    // ============ 待学清单模块 ============
    async fetchStudyPendings(query = {}) {
      return htdApi.get('/study-pendings', query);
    },
    async createStudyPending(payload) {
      const r = await htdApi.post('/study-pendings', payload);
      showToast('待学资源已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateStudyPending(id, payload) {
      const r = await htdApi.put(`/study-pendings/${id}`, payload);
      showToast('待学资源已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteStudyPending(id) {
      await htdApi.del(`/study-pendings/${id}`);
      showToast('待学资源已删除', 'success');
      await this.refreshAll();
    },
    async completeStudyPending(id, payload) {
      const r = await htdApi.post(`/study-pendings/${id}/complete`, payload);
      showToast('已标记为已学习并创建学习记录', 'success');
      await this.refreshAll();
      return r;
    },

    // ============ 娱乐内容模块 ============
    async fetchEntertainments(query = {}) {
      return htdApi.get('/entertainments', query);
    },
    async fetchEntertainmentRecommend() {
      return htdApi.get('/entertainments/recommend');
    },
    async fetchEntertainmentStatusStats() {
      return htdApi.get('/entertainments/status-stats');
    },
    async createEntertainment(payload) {
      const r = await htdApi.post('/entertainments', payload);
      showToast('娱乐内容已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateEntertainment(id, payload) {
      const r = await htdApi.put(`/entertainments/${id}`, payload);
      showToast('娱乐内容已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteEntertainment(id) {
      await htdApi.del(`/entertainments/${id}`);
      showToast('娱乐内容已删除', 'success');
      await this.refreshAll();
    },

    // ============ 复盘模块 ============
    async fetchReviews(query = {}) {
      return htdApi.get('/reviews', query);
    },
    async fetchReviewDetail(id) {
      return htdApi.get(`/reviews/${id}`);
    },
    async createReview(payload) {
      const r = await htdApi.post('/reviews', payload);
      showToast('复盘已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateReview(id, payload) {
      const r = await htdApi.put(`/reviews/${id}`, payload);
      showToast('复盘已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteReview(id) {
      await htdApi.del(`/reviews/${id}`);
      showToast('复盘已删除', 'success');
      await this.refreshAll();
    },
    async createCurrentWeekReview(payload = {}) {
      const r = await htdApi.post('/reviews/current-week', payload);
      showToast(r.created === false ? '本周周复盘已存在' : '本周周复盘已生成', 'success');
      return r;
    },
    // 提交复盘（draft → submitted，自动生成 Vault 草稿）
    async reviewSubmit(id) {
      const r = await htdApi.post(`/reviews/${id}/submit`);
      showToast('复盘已提交，沉淀草稿已生成', 'success');
      await this.refreshAll();
      return r;
    },
    // 生成沉淀（submitted → precipitated）
    async reviewPrecipitate(id) {
      const r = await htdApi.post(`/reviews/${id}/precipitate`);
      showToast('沉淀已生成', 'success');
      await this.refreshAll();
      return r;
    },

    // ============ 凭据保险箱模块 ============
    async fetchSecrets(query = {}) {
      return htdApi.get('/secrets', query);
    },
    async fetchSecretTypeStats() {
      return htdApi.get('/secrets/type-stats');
    },
    async createSecret(payload) {
      const r = await htdApi.post('/secrets', payload);
      showToast('凭据已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateSecret(id, payload) {
      const r = await htdApi.put(`/secrets/${id}`, payload);
      showToast('凭据已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteSecret(id) {
      await htdApi.del(`/secrets/${id}`);
      showToast('凭据已删除', 'success');
      await this.refreshAll();
    },

    // ============ 部署记录模块 ============
    async fetchDeployments(query = {}) {
      return htdApi.get('/deployments', query);
    },
    async fetchDeploymentEnvStats() {
      return htdApi.get('/deployments/env-stats');
    },
    async createDeployment(payload) {
      const r = await htdApi.post('/deployments', payload);
      showToast('部署记录已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateDeployment(id, payload) {
      const r = await htdApi.put(`/deployments/${id}`, payload);
      showToast('部署记录已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteDeployment(id) {
      await htdApi.del(`/deployments/${id}`);
      showToast('部署记录已删除', 'success');
      await this.refreshAll();
    },

    // ============ 会议纪要模块 ============
    async createMeeting(payload) {
      const r = await htdApi.post('/meetings', payload);
      await this.refreshAll();
      return r;
    },
    async updateMeeting(id, payload) {
      const r = await htdApi.put(`/meetings/${id}`, payload);
      await this.refreshAll();
      return r;
    },
    async deleteMeeting(id) {
      await htdApi.del(`/meetings/${id}`);
      await this.refreshAll();
    },
    async generateMeetingReview(id) {
      const r = await htdApi.post(`/meetings/${id}/generate-review`);
      await this.refreshAll();
      return r;
    },

    // ============ 习惯打卡模块 ============
    async createHabit(payload) {
      const r = await htdApi.post('/habits', payload);
      await this.refreshAll();
      return r;
    },
    async updateHabit(id, payload) {
      const r = await htdApi.put(`/habits/${id}`, payload);
      await this.refreshAll();
      return r;
    },
    async deleteHabit(id) {
      await htdApi.del(`/habits/${id}`);
      await this.refreshAll();
    },
    async checkInHabit(id, payload) {
      const r = await htdApi.post(`/habits/${id}/checkin`, payload);
      await this.refreshAll();
      return r;
    },

    // ============ 时间块模块 ============
    async createTimeBlock(payload) {
      const r = await htdApi.post('/time-blocks', payload);
      await this.refreshAll();
      return r;
    },
    async startTimeBlock(payload) {
      const r = await htdApi.post('/time-blocks/start', payload);
      await this.refreshAll();
      return r;
    },
    async stopTimeBlock(id, payload) {
      const r = await htdApi.post(`/time-blocks/${id}/stop`, payload);
      await this.refreshAll();
      return r;
    },
    async deleteTimeBlock(id) {
      await htdApi.del(`/time-blocks/${id}`);
      await this.refreshAll();
    },

    // ============ 财务收支模块 ============
    async createFinance(payload) {
      const r = await htdApi.post('/finances', payload);
      await this.refreshAll();
      return r;
    },
    async updateFinance(id, payload) {
      const r = await htdApi.put(`/finances/${id}`, payload);
      await this.refreshAll();
      return r;
    },
    async deleteFinance(id) {
      await htdApi.del(`/finances/${id}`);
      await this.refreshAll();
    },

    // ============ 合同回款模块 ============
    async createFinanceContract(payload) {
      const r = await htdApi.post('/finance-contracts', payload);
      await this.refreshAll();
      return r;
    },
    async updateFinanceContract(id, payload) {
      const r = await htdApi.put(`/finance-contracts/${id}`, payload);
      await this.refreshAll();
      return r;
    },
    async deleteFinanceContract(id) {
      await htdApi.del(`/finance-contracts/${id}`);
      await this.refreshAll();
    },
    async updateContractNode(id, nodeIndex, payload) {
      const r = await htdApi.post(`/finance-contracts/${id}/nodes/${nodeIndex}`, payload);
      await this.refreshAll();
      return r;
    },

    // ============ 沉淀 Vault 模块 ============
    async createVaultItem(payload) {
      const r = await htdApi.post('/vaults', payload);
      await this.refreshAll();
      return r;
    },
    async updateVaultItem(id, payload) {
      const r = await htdApi.put(`/vaults/${id}`, payload);
      await this.refreshAll();
      return r;
    },
    async deleteVaultItem(id) {
      await htdApi.del(`/vaults/${id}`);
      await this.refreshAll();
    },

    // ============ 回收站模块 ============
    async fetchRecycleBin() {
      return htdApi.get('/system/recycle-bin');
    },
    async restoreRecycleBinItem(model, id) {
      const r = await htdApi.post('/system/recycle-bin/restore', { model, id });
      await this.refreshAll();
      return r;
    },
    async permanentlyDeleteRecycleBinItem(model, id) {
      const r = await htdApi.del(`/system/recycle-bin/${model}/${id}`);
      await this.refreshAll();
      return r;
    },
    async emptyRecycleBin() {
      const r = await htdApi.del('/system/recycle-bin/empty');
      await this.refreshAll();
      return r;
    },

    // ============ POC 模块（渗透验证，§4.4） ============
    // 端点：GET/POST /pocs、GET/PUT/DELETE /pocs/:id、PATCH /pocs/:id/status
    async fetchPocs(query = {}) {
      return htdApi.get('/pocs', query);
    },
    async createPoc(payload) {
      const r = await htdApi.post('/pocs', payload);
      showToast('POC 已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updatePoc(id, payload) {
      const r = await htdApi.put(`/pocs/${id}`, payload);
      showToast('POC 已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deletePoc(id) {
      await htdApi.del(`/pocs/${id}`);
      showToast('POC 已删除', 'success');
      await this.refreshAll();
    },
    async changePocStatus(id, status) {
      const r = await htdApi.patch(`/pocs/${id}/status`, { status });
      showToast('POC 状态已更新', 'success');
      await this.refreshAll();
      return r;
    },

    // ============ 投标模块（§4.4） ============
    // 端点：同模板（bids）；另增 GET /bids?milestoneId=（软关联查询）
    async fetchBids(query = {}) {
      return htdApi.get('/bids', query);
    },
    async createBid(payload) {
      const r = await htdApi.post('/bids', payload);
      showToast('投标记录已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateBid(id, payload) {
      const r = await htdApi.put(`/bids/${id}`, payload);
      showToast('投标记录已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteBid(id) {
      await htdApi.del(`/bids/${id}`);
      showToast('投标记录已删除', 'success');
      await this.refreshAll();
    },
    async changeBidStatus(id, status) {
      const r = await htdApi.patch(`/bids/${id}/status`, { status });
      showToast('投标状态已更新', 'success');
      await this.refreshAll();
      return r;
    },

    // ============ 漏洞模块（§4.4，assetGroup 隔离维度） ============
    // 端点：同模板（vulns）；列表必带 ?assetGroup=（前端分组切换即切该参数）
    async fetchVulns(query = {}) {
      return htdApi.get('/vulns', query);
    },
    async createVuln(payload) {
      const r = await htdApi.post('/vulns', payload);
      showToast('漏洞记录已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateVuln(id, payload) {
      const r = await htdApi.put(`/vulns/${id}`, payload);
      showToast('漏洞记录已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteVuln(id) {
      await htdApi.del(`/vulns/${id}`);
      showToast('漏洞记录已删除', 'success');
      await this.refreshAll();
    },
    async changeVulnStatus(id, status) {
      const r = await htdApi.patch(`/vulns/${id}/status`, { status });
      showToast('漏洞状态已更新', 'success');
      await this.refreshAll();
      return r;
    },

    // ============ 应急模块（§4.4） ============
    // 端点：同模板（incidents）；另增 POST /incidents/:id/timeline、POST /incidents/:id/actions
    async fetchIncidents(query = {}) {
      return htdApi.get('/incidents', query);
    },
    async createIncident(payload) {
      const r = await htdApi.post('/incidents', payload);
      showToast('应急事件已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateIncident(id, payload) {
      const r = await htdApi.put(`/incidents/${id}`, payload);
      showToast('应急事件已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteIncident(id) {
      await htdApi.del(`/incidents/${id}`);
      showToast('应急事件已删除', 'success');
      await this.refreshAll();
    },
    async changeIncidentStatus(id, status) {
      const r = await htdApi.patch(`/incidents/${id}/status`, { status });
      showToast('事件状态已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async addIncidentTimeline(id, entry) {
      const r = await htdApi.post(`/incidents/${id}/timeline`, entry);
      showToast('时间线已追加', 'success');
      await this.refreshAll();
      return r;
    },
    async addIncidentAction(id, action) {
      const r = await htdApi.post(`/incidents/${id}/actions`, action);
      showToast('处置动作已追加', 'success');
      await this.refreshAll();
      return r;
    },

    // ============ 阅读 / 资料模块（V1.5 §8.4） ============
    // 端点：GET/POST /readings、GET/PUT/DELETE /readings/:id、PATCH /readings/:id/status、POST /readings/:id/convert-to-vault
    async fetchReadings(query = {}) {
      return htdApi.get('/readings', query);
    },
    async createReading(payload) {
      const r = await htdApi.post('/readings', payload);
      showToast('阅读资料已创建', 'success');
      await this.refreshAll();
      return r;
    },
    async updateReading(id, payload) {
      const r = await htdApi.put(`/readings/${id}`, payload);
      showToast('阅读资料已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async deleteReading(id) {
      await htdApi.del(`/readings/${id}`);
      showToast('阅读资料已删除', 'success');
      await this.refreshAll();
    },
    async changeReadingStatus(id, status) {
      const r = await htdApi.patch(`/readings/${id}/status`, { status });
      showToast('阅读状态已更新', 'success');
      await this.refreshAll();
      return r;
    },
    async convertReadingToVault(id) {
      const r = await htdApi.post(`/readings/${id}/convert-to-vault`, {});
      showToast('已转化为 Vault 沉淀', 'success');
      await this.refreshAll();
      return r;
    },

    // ============ S2-4 双轨笔记模块 ============
    // 笔记是来源记录下的子资源，刻意不做 refreshAll（避免为一条笔记刷新全部模块）
    async fetchNotes(query = {}) {
      return htdApi.get('/notes', query);
    },
    async createNote(payload) {
      return htdApi.post('/notes', payload);
    },
    async updateNote(id, payload) {
      return htdApi.put(`/notes/${id}`, payload);
    },
    async deleteNote(id) {
      await htdApi.del(`/notes/${id}`);
    },

    // ============ S2-5 RFP 条目级应答模块 ============
    // 条目挂在投标下，同为子资源，不做 refreshAll
    async fetchRfpItems(query = {}) {
      return htdApi.get('/rfp-items', query);
    },
    async fetchRfpStats(bidId) {
      return htdApi.get('/rfp-items/stats', { bidId });
    },
    async createRfpItem(payload) {
      return htdApi.post('/rfp-items', payload);
    },
    async updateRfpItem(id, payload) {
      return htdApi.put(`/rfp-items/${id}`, payload);
    },
    async deleteRfpItem(id) {
      await htdApi.del(`/rfp-items/${id}`);
    },
    async changeRfpItemStatus(id, status) {
      return htdApi.patch(`/rfp-items/${id}/status`, { status });
    },
  },
});

window.useDataStore = useDataStore;

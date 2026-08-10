/**
 * 系统模块 - 服务层
 * 提供健康检查、全局统计数据
 */
import prisma from '../../database/prisma.js';
import { today, startOfWeek, endOfWeek, formatDate } from '../../common/utils/date.js';

class SystemService {
  /**
   * 健康检查
   */
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * 全局统计数据（供首页使用）
   */
  async getStatistics() {
    const [
      projectCount,
      devIssueCount,
      todayTodoCount,
      memoCount,
      entertainmentWantCount,
      entertainmentPlayingCount,
      secretCount,
      deploymentCount,
    ] = await Promise.all([
      // 进行中项目数
      prisma.project.count({
        where: {
          deletedAt: null,
          NOT: { phase: '项目结项' },
        },
      }),
      // 待解决开发问题数
      prisma.devIssue.count({
        where: {
          deletedAt: null,
          status: { in: ['待解决', '排查中'] },
        },
      }),
      // 今日未完成待办数
      prisma.todo.count({
        where: {
          deletedAt: null,
          todoDate: today(),
          status: 'pending',
        },
      }),
      // 备忘总数
      prisma.memo.count({
        where: { deletedAt: null },
      }),
      // 想看的娱乐数
      prisma.entertainment.count({
        where: { deletedAt: null, status: '想看' },
      }),
      // 在玩的娱乐数
      prisma.entertainment.count({
        where: { deletedAt: null, status: '在玩' },
      }),
      // 凭据总数
      prisma.secret.count({
        where: { deletedAt: null },
      }),
      // 部署记录总数
      prisma.deployment.count({
        where: { deletedAt: null },
      }),
    ]);

    // 本周学习时长
    const weekStart = startOfWeek();
    const weekEnd = endOfWeek();
    const weekStudyRecords = await prisma.studyRecord.findMany({
      where: {
        deletedAt: null,
        studyDate: {
          gte: formatDate(weekStart),
          lte: formatDate(weekEnd),
        },
      },
      select: { duration: true },
    });
    const weekStudyHours = weekStudyRecords.reduce((sum, r) => sum + (r.duration || 0), 0);

    // 即将到期里程碑（7天内）
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const upcomingMilestones = await prisma.projectMilestone.findMany({
      where: {
        deletedAt: null,
        completed: false,
        dueDate: {
          gte: formatDate(now),
          lte: formatDate(sevenDaysLater),
        },
      },
      include: {
        project: {
          select: { id: true, customerName: true, phase: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // 最近备忘（3条）
    const recentMemos = await prisma.memo.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // 明日计划预览（5条）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);
    const tomorrowTodos = await prisma.todo.findMany({
      where: {
        deletedAt: null,
        todoDate: tomorrowStr,
      },
      orderBy: [{ sortOrder: 'asc' }, { priority: 'desc' }],
      take: 5,
    });

    return {
      projectCount,
      devIssueCount,
      todayTodoCount,
      weekStudyHours: parseFloat(weekStudyHours.toFixed(1)),
      memoCount,
      entertainmentWantCount,
      entertainmentPlayingCount,
      secretCount,
      deploymentCount,
      upcomingMilestones,
      recentMemos,
      tomorrowTodos,
    };
  }

  /**
   * 各模块数据条目统计（供数据管理页面使用）
   */
  async getDataStats() {
    const tables = [
      { name: 'memos', label: '全局备忘', model: 'memo' },
      { name: 'todos', label: '待办事项', model: 'todo' },
      { name: 'projects', label: '项目', model: 'project' },
      { name: 'project_milestones', label: '项目里程碑', model: 'projectMilestone' },
      { name: 'project_tasks', label: '项目任务', model: 'projectTask' },
      { name: 'dev_projects', label: '开发项目', model: 'devProject' },
      { name: 'dev_snippets', label: '代码片段', model: 'devSnippet' },
      { name: 'dev_issues', label: '开发问题', model: 'devIssue' },
      { name: 'entertainments', label: '娱乐内容', model: 'entertainment' },
      { name: 'study_records', label: '学习记录', model: 'studyRecord' },
      { name: 'study_pendings', label: '待学清单', model: 'studyPending' },
      { name: 'reviews', label: '复盘记录', model: 'review' },
      { name: 'secrets', label: '凭据', model: 'secret' },
      { name: 'deployments', label: '部署记录', model: 'deployment' },
    ];

    const stats = [];
    for (const table of tables) {
      const count = await prisma[table.model].count({ where: { deletedAt: null } });
      stats.push({ table: table.name, label: table.label, count });
    }

    const totalCount = stats.reduce((sum, s) => sum + s.count, 0);
    return { stats, totalCount };
  }
}

export default new SystemService();

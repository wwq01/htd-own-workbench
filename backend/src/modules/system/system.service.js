/**
 * 系统模块 - 服务层
 * 提供健康检查、全局统计数据
 */
import prisma from '../../database/prisma.js';
import appConfig from '../../config/app.config.js';
import {
  today,
  tomorrow,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  formatDate,
  getWeekKey,
  daysBetween,
} from '../../common/utils/date.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { PROJECT_PHASE_COLORS } from '../../common/constants/enums.js';
import reviewService from '../review/review.service.js';
import vaultService from '../vault/vault.service.js';

/**
 * 回收站配置：遍历所有带 deletedAt 的模型
 * model 为 Prisma client 键（首字母小写驼峰），label 为前端展示名，
 * select 控制聚合查询字段，title 从记录中抽取可读标题
 */
const RECYCLE_BIN_CONFIG = [
  { model: 'memo', label: '全局备忘', select: { id: true, deletedAt: true, content: true }, title: (r) => r.content || '(空内容)' },
  { model: 'todo', label: '待办事项', select: { id: true, deletedAt: true, title: true }, title: (r) => r.title || '(未命名)' },
  { model: 'project', label: '售前项目', select: { id: true, deletedAt: true, customerName: true }, title: (r) => r.customerName || '(未命名客户)' },
  { model: 'projectMilestone', label: '项目里程碑', select: { id: true, deletedAt: true, name: true }, title: (r) => r.name || '(未命名)' },
  { model: 'projectTask', label: '项目任务', select: { id: true, deletedAt: true, name: true }, title: (r) => r.name || '(未命名)' },
  { model: 'devProject', label: '开发项目', select: { id: true, deletedAt: true, name: true }, title: (r) => r.name || '(未命名)' },
  { model: 'devSnippet', label: '代码片段', select: { id: true, deletedAt: true, name: true }, title: (r) => r.name || '(未命名)' },
  { model: 'devIssue', label: '开发问题', select: { id: true, deletedAt: true, title: true }, title: (r) => r.title || '(未命名)' },
  { model: 'entertainment', label: '娱乐内容', select: { id: true, deletedAt: true, name: true }, title: (r) => r.name || '(未命名)' },
  { model: 'studyRecord', label: '学习记录', select: { id: true, deletedAt: true, topic: true }, title: (r) => r.topic || '(未命名)' },
  { model: 'studyPending', label: '待学清单', select: { id: true, deletedAt: true, title: true }, title: (r) => r.title || '(未命名)' },
  { model: 'review', label: '复盘记录', select: { id: true, deletedAt: true, type: true, weekKey: true }, title: (r) => (r.type === 'week' ? `周复盘 ${r.weekKey || ''}` : '项目复盘') },
  { model: 'secret', label: '凭据保险箱', select: { id: true, deletedAt: true, name: true }, title: (r) => r.name || '(未命名)' },
  { model: 'deployment', label: '工作部署', select: { id: true, deletedAt: true, name: true }, title: (r) => r.name || '(未命名)' },
  { model: 'meeting', label: '会议纪要', select: { id: true, deletedAt: true, title: true }, title: (r) => r.title || '(未命名)' },
  { model: 'habit', label: '习惯打卡', select: { id: true, deletedAt: true, name: true }, title: (r) => r.name || '(未命名)' },
  { model: 'habitCheckIn', label: '习惯打卡记录', select: { id: true, deletedAt: true, date: true }, title: (r) => `${r.date || ''} 打卡` },
  { model: 'timeBlock', label: '时间块', select: { id: true, deletedAt: true, type: true, note: true }, title: (r) => `${r.type || ''}${r.note ? ' · ' + r.note : ''}` || r.type || '(时间块)' },
  { model: 'financeRecord', label: '财务速记', select: { id: true, deletedAt: true, type: true, category: true }, title: (r) => `${r.type === 'INCOME' ? '收入' : '支出'} · ${r.category || ''}` },
  { model: 'contractReceivable', label: '合同回款', select: { id: true, deletedAt: true, contractNo: true, clientName: true }, title: (r) => `${r.contractNo || ''}${r.clientName ? ' · ' + r.clientName : ''}` || '(合同)' },
  { model: 'vaultItem', label: '沉淀 Vault', select: { id: true, deletedAt: true, topic: true }, title: (r) => r.topic || '(未命名)' },
];

const RECYCLE_BIN_MODEL_SET = new Set(RECYCLE_BIN_CONFIG.map((c) => c.model));

// V1.5 图表配色（与前端 charts.js PALETTE 对齐）
const CHART_PALETTE = ['#5B8DEF', '#22D3EE', '#34D399', '#FBBF24', '#FB923C', '#F87171', '#94A3B8', '#60A5FA', '#2DD4BF', '#A3E635'];
const FINANCE_CATEGORY_LABELS = { FOOD: '餐饮', HOUSING: '居住', TRANSPORT: '交通', SALARY: '工资', REIMBURSEMENT: '报销', OTHER: '其他' };

function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function parseYMD(s) {
  if (!s) return null;
  const parts = String(s).split('-').map(Number);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function lastNDates(n) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    arr.push(formatDate(d));
  }
  return arr;
}
function lastNMonths(n) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
}
function lastNWeeks(n) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    arr.push(getWeekKey(d));
  }
  return arr;
}
function weekdayShort(dateStr) {
  const d = parseYMD(dateStr);
  if (!d) return '';
  const names = ['日', '一', '二', '三', '四', '五', '六'];
  return '周' + names[d.getDay()];
}

class SystemService {
  /**
   * 健康检查（含 service/version 供启动器进程复用探测，§5.3.3）
   */
  async healthCheck() {
    return {
      status: 'ok',
      service: 'htd-own-workbench',
      version: appConfig.version,
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

  /**
   * 回收站列表：聚合所有软删除（deletedAt 不为空）的记录
   * 返回按删除时间倒序排列的 { model, label, id, title, deletedAt } 列表
   */
  async getRecycleBin() {
    const items = [];
    await Promise.all(RECYCLE_BIN_CONFIG.map(async (cfg) => {
      const rows = await prisma[cfg.model].findMany({
        where: { deletedAt: { not: null } },
        select: cfg.select,
        orderBy: { deletedAt: 'desc' },
      });
      for (const row of rows) {
        items.push({
          model: cfg.model,
          label: cfg.label,
          id: row.id,
          title: (cfg.title(row) || '(未命名)').toString().slice(0, 80),
          deletedAt: row.deletedAt,
        });
      }
    }));
    items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
    return { items, total: items.length };
  }

  /**
   * 恢复回收站条目（清空 deletedAt）
   * 项目恢复时连带恢复其下里程碑 / 任务 / 阶段切换记录
   */
  async restoreRecycleBinItem(model, id) {
    if (!model || !id || !RECYCLE_BIN_MODEL_SET.has(model)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '未知的回收站模块或缺少 ID');
    }
    await prisma[model].update({
      where: { id },
      data: { deletedAt: null },
    });
    if (model === 'project') {
      await Promise.all([
        prisma.projectMilestone.updateMany({ where: { projectId: id }, data: { deletedAt: null } }),
        prisma.projectTask.updateMany({ where: { projectId: id }, data: { deletedAt: null } }),
        prisma.projectPhaseTransition.updateMany({ where: { projectId: id }, data: { deletedAt: null } }),
      ]);
    }
    return { id, model, restored: true };
  }

  /**
   * 永久删除回收站条目（硬删除）
   * 项目硬删除前先清理其下子记录，避免外键孤立
   */
  async permanentlyDeleteRecycleBinItem(model, id) {
    if (!model || !id || !RECYCLE_BIN_MODEL_SET.has(model)) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '未知的回收站模块或缺少 ID');
    }
    if (model === 'project') {
      await Promise.all([
        prisma.projectMilestone.deleteMany({ where: { projectId: id } }),
        prisma.projectTask.deleteMany({ where: { projectId: id } }),
        prisma.projectPhaseTransition.deleteMany({ where: { projectId: id } }),
      ]);
    }
    await prisma[model].delete({ where: { id } });
    return { id, model, deleted: true };
  }

  /**
   * 清空回收站：硬删除全部软删除记录
   */
  async emptyRecycleBin() {
    let total = 0;
    for (const cfg of RECYCLE_BIN_CONFIG) {
      const r = await prisma[cfg.model].deleteMany({
        where: { deletedAt: { not: null } },
      });
      total += r.count;
    }
    return { total };
  }

  /**
   * 首页三栏数据聚合（§6.1）
   * 工作组 5 卡 / 生活组 4 卡 / 知识组 3 卡，一次查询聚合返回，前端直接渲染。
   */
  async getHomeSummary() {
    const todayStr = today();
    const tomorrowStr = tomorrow();
    const weekStart = startOfWeek();
    const weekEnd = endOfWeek();
    const weekStartStr = formatDate(weekStart);
    const weekEndStr = formatDate(weekEnd);
    const monthStart = startOfMonth();
    const monthEnd = endOfMonth();
    const todayStart = new Date(`${todayStr}T00:00:00`);
    const todayEnd = new Date(`${todayStr}T23:59:59`);

    // ===== 工作组 =====
    const [todayTodos, tomorrowCount, activeProjects, recentMeetings, expiringSecrets] = await Promise.all([
      prisma.todo.findMany({
        where: { deletedAt: null, todoDate: todayStr },
        select: { status: true },
      }),
      prisma.todo.count({ where: { deletedAt: null, todoDate: tomorrowStr } }),
      prisma.project.findMany({
        where: { deletedAt: null, NOT: { phase: '项目结项' } },
        orderBy: { progress: 'desc' },
        take: 3,
        select: { id: true, customerName: true, phase: true, progress: true },
      }),
      prisma.meeting.findMany({
        where: { deletedAt: null },
        orderBy: { heldAt: 'desc' },
        take: 2,
        select: { id: true, title: true, heldAt: true },
      }),
      prisma.secret.count({
        where: {
          deletedAt: null,
          expiryDate: { gte: todayStr, lte: formatDate(new Date(Date.now() + 7 * 86400000)) },
        },
      }),
    ]);

    const todayDone = todayTodos.filter(t => t.status === 'completed').length;
    const todayTotal = todayTodos.length;

    // ===== 生活组：习惯打卡 =====
    const habits = await prisma.habit.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, frequency: true, dailyTargetCount: true, weeklyTargetDays: true },
    });
    const habitIds = habits.map(h => h.id);
    const checkins = habitIds.length
      ? await prisma.habitCheckIn.findMany({
          where: { deletedAt: null, habitId: { in: habitIds } },
          select: { habitId: true, date: true, count: true },
        })
      : [];
    const checkinByHabit = {};
    for (const c of checkins) {
      (checkinByHabit[c.habitId] ||= []).push(c);
    }
    const todayHabits = [];
    let maxStreak = 0;
    for (const h of habits) {
      const cs = checkinByHabit[h.id] || [];
      const dates = cs.map(c => c.date).filter(Boolean);
      maxStreak = Math.max(maxStreak, this._maxStreak(dates));
      if (h.frequency === 'DAILY') {
        const todayCount = cs.filter(c => c.date === todayStr).reduce((s, c) => s + (c.count || 0), 0);
        if (todayCount < (h.dailyTargetCount || 1)) {
          todayHabits.push({ id: h.id, name: h.name, current: todayCount, target: h.dailyTargetCount || 1, kind: 'daily' });
        }
      } else {
        const weekCount = cs.filter(c => c.date >= weekStartStr && c.date <= weekEndStr).reduce((s, c) => s + (c.count || 0), 0);
        if (weekCount < (h.weeklyTargetDays || 1)) {
          todayHabits.push({ id: h.id, name: h.name, current: weekCount, target: h.weeklyTargetDays || 1, kind: 'weekly' });
        }
      }
    }

    const [todayTomatoes, monthFinance, studyPendings, vaultWeek] = await Promise.all([
      prisma.timeBlock.count({
        where: {
          deletedAt: null,
          startedAt: { gte: todayStart, lte: todayEnd },
          endedAt: { not: null },
        },
      }),
      prisma.financeRecord.findMany({
        where: { deletedAt: null, date: { gte: monthStart, lte: monthEnd } },
        select: { type: true, amount: true },
      }),
      prisma.studyPending.findMany({
        where: { deletedAt: null, completed: false },
        orderBy: { sortOrder: 'asc' },
        take: 3,
        select: { id: true, title: true },
      }),
      prisma.vaultItem.findMany({
        where: { deletedAt: null, createdAt: { gte: weekStart, lte: weekEnd } },
        select: { status: true },
      }),
    ]);

    const income = monthFinance.filter(f => f.type === 'INCOME').reduce((s, f) => s + (f.amount || 0), 0);
    const expense = monthFinance.filter(f => f.type === 'EXPENSE').reduce((s, f) => s + (f.amount || 0), 0);
    const net = parseFloat((income - expense).toFixed(2));
    const vaultDraft = vaultWeek.filter(v => v.status === 'DRAFT').length;
    const vaultPrecipitated = vaultWeek.filter(v => v.status === 'PRECIPITATED').length;

    return {
      generatedAt: new Date().toISOString(),
      work: {
        todayProgress: {
          completed: todayDone,
          total: todayTotal,
          percent: todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0,
        },
        tomorrowCount,
        activeProjects: activeProjects.map(p => ({
          id: p.id,
          name: p.customerName,
          phase: p.phase,
          phaseColor: PROJECT_PHASE_COLORS[p.phase] || '#64748B',
          progress: p.progress,
        })),
        recentMeetings: recentMeetings.map(m => ({ id: m.id, title: m.title, heldAt: m.heldAt })),
        expiringSecrets: expiringSecrets,
      },
      life: {
        todayHabits: todayHabits.slice(0, 3),
        maxStreak,
        todayTomatoes: { completed: todayTomatoes, target: 8 },
        financeMonth: {
          income: parseFloat(income.toFixed(2)),
          expense: parseFloat(expense.toFixed(2)),
          net,
          direction: net >= 0 ? 'up' : 'down',
        },
      },
      knowledge: {
        vaultWeek: { total: vaultWeek.length, draft: vaultDraft, precipitated: vaultPrecipitated },
        studying: studyPendings.map(s => ({ id: s.id, title: s.title })),
        recommendations: await this._buildRecommendations(weekStart, weekEnd),
      },
    };
  }

  /**
   * 计算历史最长连续天数
   */
  _maxStreak(dates) {
    if (!dates || !dates.length) return 0;
    const set = new Set(dates);
    const sorted = [...set].sort();
    let best = 0;
    let cur = 0;
    let prev = null;
    for (const d of sorted) {
      if (prev && daysBetween(prev, d) === 1) cur += 1;
      else cur = 1;
      best = Math.max(best, cur);
      prev = d;
    }
    return best;
  }

  /**
   * 首页知识栏「推荐待写沉淀」候选（§6.8.5 简化规则）
   * 候选池：本周提交但未沉淀的复盘（3 分）+ 本周阶段推进到交付跟进/结项的项目（4 分）
   * 取分数前 3，每条带一键生成草稿所需信息。
   */
  async _buildRecommendations(weekStart, weekEnd) {
    const candidates = [];
    // 1) 本周提交但未沉淀的复盘
    const submittedReviews = await prisma.review.findMany({
      where: {
        deletedAt: null,
        status: 'submitted',
        updatedAt: { gte: weekStart, lte: weekEnd },
      },
      select: { id: true, type: true, projectId: true, remark: true, vaultSourceType: true },
    });
    for (const r of submittedReviews) {
      const sourceType = r.vaultSourceType
        || (r.type === 'week' ? 'WEEKLY_REVIEW' : r.projectId ? 'PROJECT_REVIEW' : 'MEETING_REVIEW');
      const existing = await prisma.vaultItem.findFirst({
        where: { deletedAt: null, sourceType, sourceId: r.id },
        select: { id: true, status: true },
      });
      if (existing && existing.status === 'PRECIPITATED') continue; // 已沉淀则不再推荐
      candidates.push({
        kind: 'review',
        sourceType,
        sourceId: r.id,
        title: r.remark || (r.type === 'week' ? '周复盘' : '项目复盘'),
        score: 3,
      });
    }
    // 2) 本周阶段推进到交付跟进/结项的项目
    const phaseTransitions = await prisma.projectPhaseTransition.findMany({
      where: {
        createdAt: { gte: weekStart, lte: weekEnd },
        toPhase: { in: ['交付跟进', '项目结项'] },
      },
      select: { projectId: true, toPhase: true },
    });
    for (const t of phaseTransitions) {
      const project = await prisma.project.findFirst({
        where: { id: t.projectId, deletedAt: null },
        select: { id: true, customerName: true },
      });
      if (!project) continue;
      candidates.push({
        kind: 'project',
        sourceType: 'MANUAL',
        sourceId: project.id,
        sourceUrl: `#/project/${project.id}`,
        title: `项目复盘：${project.customerName}`,
        score: 4,
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 3);
  }

  /**
   * 首页推荐「一键生成沉淀草稿」（§6.8.5）
   * review 候选 → 走复盘 precipitate（自动生成 Vault 并置 PRECIPITATED）；
   * 其它候选 → 生成 MANUAL 沉淀草稿（引用原记录，不复制正文）。
   */
  async autoRecommendVault(candidate = {}) {
    if (!candidate || !candidate.sourceId) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '推荐项缺少来源 ID');
    }
    if (candidate.kind === 'review') {
      return reviewService.precipitate(candidate.sourceId);
    }
    return vaultService.autoCreateFromReview({
      sourceType: candidate.sourceType || 'MANUAL',
      reviewId: candidate.sourceId,
      sourceUrl: candidate.sourceUrl || null,
      title: candidate.title || '沉淀草稿',
    });
  }

  /**
   * 图表聚合数据（V1.5 §8.1）
   * 返回首页 / 学习 / 财务三类图表所需的全部数据集。
   * 性能策略：个人数据量级小，直接拉取相关列后在 JS 端分桶聚合，避免 N+1 与复杂 SQL。
   */
  async getCharts() {
    const last7 = lastNDates(7);
    const last14 = lastNDates(14);
    const last6Months = lastNMonths(6);

    // ---- 待办：本周完成趋势 ----
    const todos = await prisma.todo.findMany({
      where: { deletedAt: null },
      select: { createdAt: true, completedAt: true },
    });
    const weekCompletionTrend = last7.map((d) => ({
      label: weekdayShort(d),
      date: d,
      completed: todos.filter((t) => t.completedAt && formatDate(t.completedAt) === d).length,
      created: todos.filter((t) => formatDate(t.createdAt) === d).length,
    }));

    // ---- 项目：阶段分布 ----
    const phaseGroups = await prisma.project.groupBy({
      by: ['phase'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const projectPhaseDistribution = phaseGroups.map((g, i) => ({
      label: g.phase,
      value: g._count._all,
      color: PROJECT_PHASE_COLORS[g.phase] || CHART_PALETTE[i % CHART_PALETTE.length],
    }));

    // ---- 学习：最近 7 天时长 ----
    const studyRecs = await prisma.studyRecord.findMany({
      where: { deletedAt: null },
      select: { studyDate: true, duration: true, techDirection: true },
    });
    const studyHours = last7.map((d) => ({
      label: weekdayShort(d),
      date: d,
      value: round1(studyRecs.filter((r) => r.studyDate === d).reduce((s, r) => s + (r.duration || 0), 0)),
    }));

    // ---- 习惯：最近 7 天完成率 ----
    const habits = await prisma.habit.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, frequency: true, dailyTargetCount: true, weeklyTargetDays: true },
    });
    const checkins = await prisma.habitCheckIn.findMany({
      where: { deletedAt: null, date: { in: last7 } },
      select: { habitId: true, count: true },
    });
    const habitCompletionRate = habits
      .map((h) => {
        const actual = checkins.filter((c) => c.habitId === h.id).reduce((s, c) => s + (c.count || 0), 0);
        const expected = h.frequency === 'WEEKLY' ? (h.weeklyTargetDays || 7) : (h.dailyTargetCount || 1) * 7;
        const rate = expected > 0 ? Math.min(100, Math.round((actual / expected) * 100)) : 0;
        return { label: h.name, value: rate };
      })
      .filter((h) => h.label);

    // ---- 学习：日 / 周 / 月 + 方向堆叠 ----
    const study = this._buildStudyCharts(studyRecs, last14, last6Months);

    // ---- 财务：月度收支 / 分类饼 / 合同回款 ----
    const finance = await this._buildFinanceCharts();

    return {
      home: { weekCompletionTrend, projectPhaseDistribution, studyHours, habitCompletionRate },
      study,
      finance,
    };
  }

  // 学习图表子聚合（日/周/月 + 技术方向堆叠）
  _buildStudyCharts(studyRecs, last14, last6Months) {
    const daily = last14.map((d) => ({
      label: d.slice(5),
      date: d,
      value: round1(studyRecs.filter((r) => r.studyDate === d).reduce((s, r) => s + (r.duration || 0), 0)),
    }));

    const weekMap = {};
    studyRecs.forEach((r) => {
      if (!r.studyDate) return;
      const wk = getWeekKey(parseYMD(r.studyDate) || new Date());
      weekMap[wk] = (weekMap[wk] || 0) + (r.duration || 0);
    });
    const weekly = lastNWeeks(8).map((wk) => ({ label: wk, value: round1(weekMap[wk] || 0) }));

    const monthMap = {};
    studyRecs.forEach((r) => {
      const mk = (r.studyDate || '').slice(0, 7);
      if (mk) monthMap[mk] = (monthMap[mk] || 0) + (r.duration || 0);
    });
    const monthly = last6Months.map((mk) => ({ label: mk, value: round1(monthMap[mk] || 0) }));

    const dirs = [...new Set(studyRecs.map((r) => r.techDirection || '未分类'))];
    const series = dirs.map((d, i) => ({ key: d, label: d, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
    const dirMap = {};
    studyRecs.forEach((r) => {
      const mk = (r.studyDate || '').slice(0, 7);
      const dir = r.techDirection || '未分类';
      dirMap[mk] = dirMap[mk] || {};
      dirMap[mk][dir] = (dirMap[mk][dir] || 0) + (r.duration || 0);
    });
    const directionStacked = {
      series,
      data: last6Months.map((mk) => {
        const vals = dirMap[mk] || {};
        const values = {};
        dirs.forEach((d) => { values[d] = round1(vals[d] || 0); });
        return { label: mk, values };
      }),
    };
    return { daily, weekly, monthly, directionStacked };
  }

  // 财务图表子聚合（月度收支 / 分类饼图 / 合同回款进度）
  async _buildFinanceCharts() {
    const fin = await prisma.financeRecord.findMany({
      where: { deletedAt: null },
      select: { date: true, type: true, amount: true, category: true },
    });
    const last6 = lastNMonths(6);
    const monthMap = {};
    last6.forEach((mk) => { monthMap[mk] = { income: 0, expense: 0 }; });
    fin.forEach((r) => {
      const mk = formatDate(r.date).slice(0, 7);
      if (monthMap[mk]) {
        if (r.type === 'INCOME') monthMap[mk].income += (r.amount || 0);
        else monthMap[mk].expense += (r.amount || 0);
      }
    });
    const monthlyIncomeExpense = last6.map((mk) => ({
      label: mk,
      income: round2(monthMap[mk].income),
      expense: round2(monthMap[mk].expense),
    }));

    const catMap = {};
    fin.filter((r) => r.type === 'EXPENSE').forEach((r) => {
      const c = r.category || 'OTHER';
      catMap[c] = (catMap[c] || 0) + (r.amount || 0);
    });
    const categoryPie = Object.keys(catMap)
      .map((c, i) => ({ label: FINANCE_CATEGORY_LABELS[c] || c, value: round2(catMap[c]), color: CHART_PALETTE[i % CHART_PALETTE.length] }))
      .filter((x) => x.value > 0);

    const contracts = await prisma.contractReceivable.findMany({
      where: { deletedAt: null },
      select: { contractNo: true, contractAmount: true, totalReceived: true },
      orderBy: { contractAmount: 'desc' },
      take: 6,
    });
    const contractProgress = contracts.map((c) => ({
      label: c.contractNo,
      planned: round2(c.contractAmount || 0),
      received: round2(c.totalReceived || 0),
    }));

    return { monthlyIncomeExpense, categoryPie, contractProgress };
  }

  /**
   * 项目详情图表（V1.5 §8.1）：里程碑时间线 + 任务速率
   * @param {string} projectId
   */
  async getProjectCharts(projectId) {
    if (!projectId) {
      throw new BusinessError(ErrorCodes.PARAM_ERROR, '缺少项目 ID');
    }
    const milestones = await prisma.projectMilestone.findMany({
      where: { projectId, deletedAt: null },
      select: { name: true, dueDate: true, completed: true },
      orderBy: { dueDate: 'asc' },
    });
    const tasks = await prisma.projectTask.findMany({
      where: { projectId, deletedAt: null },
      select: { completed: true },
    });
    const timeline = milestones.map((m) => ({
      label: m.name,
      date: m.dueDate,
      done: !!m.completed,
      color: m.completed ? '#34D399' : '#5B8DEF',
    }));
    const total = tasks.length || 0;
    const done = tasks.filter((t) => t.completed).length;
    const taskVelocity = {
      total,
      done,
      pending: total - done,
      completionRate: total ? Math.round((done / total) * 100) : 0,
    };
    return { timeline, taskVelocity };
  }
}

export default new SystemService();

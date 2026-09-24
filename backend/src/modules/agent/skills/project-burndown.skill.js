/**
 * 技能：项目进展与燃尽（project-burndown）
 * 统计项目阶段分布、平均进度、逾期与高风险项目、里程碑/任务完成情况。纯本地只读、不联网。
 *
 * 注意：projects.startDate / expectedEndDate、project_milestones.dueDate
 * 均为 YYYY-MM-DD 字符串列，可直接做字符串比较；与 finance_records.date（BIGINT）不同。
 */
import { todayStr } from './util.js';

export default {
  key: 'project-burndown',
  title: '项目进展与燃尽',
  description: '统计项目阶段分布、平均进度、逾期与高风险项目、里程碑/任务完成情况',
  // 避开已被占用的关键字：'任务'(todo-extract)、'汇总'(weekly-report)
  keywords: ['项目', '燃尽', '进展', '里程碑', '交付', 'project', 'burndown', '风险'],
  async run({ prisma }) {
    const today = todayStr();

    const projects = await safeQuery(
      prisma,
      `SELECT id, "customerName", phase, progress, "expectedEndDate", priority FROM "projects" WHERE "deletedAt" IS NULL`,
    );
    const milestones = await safeQuery(
      prisma,
      `SELECT "projectId", "dueDate", completed FROM "project_milestones" WHERE "deletedAt" IS NULL`,
    );
    const tasks = await safeQuery(
      prisma,
      `SELECT "projectId", completed FROM "project_tasks" WHERE "deletedAt" IS NULL`,
    );

    // 阶段分布 + 平均进度
    const byPhase = {};
    let progressSum = 0;
    for (const p of projects) {
      const ph = p.phase || '未分类';
      byPhase[ph] = (byPhase[ph] || 0) + 1;
      progressSum += Number(p.progress || 0);
    }
    const totalProjects = projects.length;
    const avgProgress = totalProjects ? Math.round(progressSum / totalProjects) : 0;

    // 逾期：预计结项已过且进度未满
    const overdue = projects
      .filter((p) => p.expectedEndDate && p.expectedEndDate < today && Number(p.progress || 0) < 100)
      .map((p) => ({
        customerName: p.customerName,
        expectedEndDate: p.expectedEndDate,
        progress: Number(p.progress || 0),
      }));

    // 高风险：逾期 或 进度低于 30%
    const risky = projects
      .filter((p) => {
        const isOverdue = p.expectedEndDate && p.expectedEndDate < today && Number(p.progress || 0) < 100;
        return isOverdue || Number(p.progress || 0) < 30;
      })
      .map((p) => ({
        customerName: p.customerName,
        phase: p.phase,
        progress: Number(p.progress || 0),
        expectedEndDate: p.expectedEndDate || '',
      }))
      .sort((a, b) => a.progress - b.progress)
      .slice(0, 5);

    const milestoneTotal = milestones.length;
    const milestoneDone = milestones.filter((m) => Boolean(m.completed)).length;
    const milestoneOverdue = milestones.filter(
      (m) => !m.completed && m.dueDate && m.dueDate < today,
    ).length;

    const taskTotal = tasks.length;
    const taskDone = tasks.filter((t) => Boolean(t.completed)).length;

    return {
      totalProjects,
      avgProgress,
      byPhase,
      overdueCount: overdue.length,
      overdue,
      riskyCount: risky.length,
      risky,
      milestoneTotal,
      milestoneDone,
      milestoneOverdue,
      taskTotal,
      taskDone,
      taskDoneRate: taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0,
      today,
      note: '本地确定性项目分析：基于本机 SQLite projects/project_milestones/project_tasks 统计，未联网。',
    };
  },
};

/** 只读查询兜底：单表异常返回空数组，不影响整体结果 */
async function safeQuery(prisma, sql) {
  try {
    const rows = await prisma.$queryRawUnsafe(sql);
    return rows || [];
  } catch {
    return [];
  }
}

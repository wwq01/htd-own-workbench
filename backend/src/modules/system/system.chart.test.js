import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import systemService from './system.service.js';
import { formatDate } from '../../common/utils/date.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'CHART_TEST_';
const todayStr = formatDate(new Date());

async function cleanup() {
  await prisma.todo.deleteMany({ where: { title: { contains: PREFIX } } });
  await prisma.studyRecord.deleteMany({ where: { topic: { contains: PREFIX } } });
  await prisma.habit.deleteMany({ where: { name: { contains: PREFIX } } });
  await prisma.financeRecord.deleteMany({ where: { remark: { contains: PREFIX } } });
  await prisma.contractReceivable.deleteMany({ where: { contractNo: { contains: PREFIX } } });
  await prisma.project.deleteMany({ where: { customerName: { contains: PREFIX } } });
}

describe('System Charts Aggregation (V1.5 §8.1)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('getCharts 返回首页/学习/财务三类结构', async () => {
    // 构造少量样本数据
    await prisma.todo.create({ data: { title: `${PREFIX}完成`, todoDate: todayStr, status: 'completed', completedAt: new Date() } });
    await prisma.project.create({ data: { customerName: `${PREFIX}客户`, phase: '方案撰写' } });
    await prisma.studyRecord.create({ data: { topic: `${PREFIX}学习`, studyDate: todayStr, duration: 2, techDirection: 'AI安全' } });
    await prisma.financeRecord.create({ data: { date: new Date(), type: 'INCOME', amount: 100, category: 'SALARY', remark: `${PREFIX}工资` } });
    await prisma.financeRecord.create({ data: { date: new Date(), type: 'EXPENSE', amount: 30, category: 'FOOD', remark: `${PREFIX}餐` } });
    await prisma.contractReceivable.create({ data: { contractNo: `${PREFIX}C1`, contractAmount: 1000, totalReceived: 400 } });

    const charts = await systemService.getCharts();
    expect(charts.home).toBeTruthy();
    expect(charts.study).toBeTruthy();
    expect(charts.finance).toBeTruthy();

    // 首页：固定 7 天分桶
    expect(Array.isArray(charts.home.weekCompletionTrend)).toBe(true);
    expect(charts.home.weekCompletionTrend.length).toBe(7);
    expect(Array.isArray(charts.home.projectPhaseDistribution)).toBe(true);
    expect(Array.isArray(charts.home.studyHours)).toBe(true);
    expect(charts.home.studyHours.length).toBe(7);
    expect(Array.isArray(charts.home.habitCompletionRate)).toBe(true);

    // 学习：日(14)/周(8)/月(6) + 方向堆叠
    expect(charts.study.daily.length).toBe(14);
    expect(charts.study.weekly.length).toBe(8);
    expect(charts.study.monthly.length).toBe(6);
    expect(Array.isArray(charts.study.directionStacked.series)).toBe(true);
    expect(Array.isArray(charts.study.directionStacked.data)).toBe(true);
    expect(charts.study.directionStacked.data.length).toBe(6);

    // 财务：月度收支(6) + 分类饼 + 合同回款
    expect(charts.finance.monthlyIncomeExpense.length).toBe(6);
    expect(Array.isArray(charts.finance.categoryPie)).toBe(true);
    expect(Array.isArray(charts.finance.contractProgress)).toBe(true);

    // 值校验：今日学习时长含样本 2h
    const todayStudy = charts.home.studyHours.find((d) => d.date === todayStr);
    expect(todayStudy.value).toBe(2);
    // 财务月度：当月收入含 100
    const monthKey = todayStr.slice(0, 7);
    const monthFin = charts.finance.monthlyIncomeExpense.find((m) => m.label === monthKey);
    expect(monthFin.income).toBe(100);
  });

  it('getProjectCharts 返回里程碑时间线 + 任务速率', async () => {
    const project = await prisma.project.create({ data: { customerName: `${PREFIX}项目`, phase: '需求沟通' } });
    await prisma.projectMilestone.create({ data: { projectId: project.id, name: '立项', dueDate: todayStr, completed: true } });
    await prisma.projectMilestone.create({ data: { projectId: project.id, name: '交付', dueDate: todayStr, completed: false } });
    await prisma.projectTask.create({ data: { projectId: project.id, name: '任务A', completed: true } });
    await prisma.projectTask.create({ data: { projectId: project.id, name: '任务B', completed: false } });

    const pc = await systemService.getProjectCharts(project.id);
    expect(pc.timeline.length).toBe(2);
    expect(pc.timeline[0].done).toBe(true);
    expect(pc.timeline[1].done).toBe(false);
    expect(pc.taskVelocity.total).toBe(2);
    expect(pc.taskVelocity.done).toBe(1);
    expect(pc.taskVelocity.completionRate).toBe(50);
  });

  it('getProjectCharts 缺 projectId 抛 PARAM_ERROR', async () => {
    await expect(systemService.getProjectCharts()).rejects.toThrow();
  });
});

afterAll(async () => { await prisma.$disconnect(); });

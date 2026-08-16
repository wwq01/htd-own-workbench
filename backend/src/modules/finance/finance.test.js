import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import financeService from './finance.service.js';
import { FINANCE_TYPE, FINANCE_CATEGORY } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';
const MONTH = '2026-08';

describe('Finance Service', () => {
  beforeEach(async () => {
    await prisma.financeRecord.deleteMany({ where: { remark: { contains: PREFIX } } });
  });
  afterEach(async () => {
    await prisma.financeRecord.deleteMany({ where: { remark: { contains: PREFIX } } });
  });

  it('create 写入并保留两位小数、默认 tags', async () => {
    const r = await financeService.create({
      date: '2026-08-10', type: FINANCE_TYPE.EXPENSE, amount: 12.345,
      category: FINANCE_CATEGORY.FOOD, remark: `${PREFIX}午餐`,
    });
    expect(r.id).toBeTruthy();
    expect(r.amount).toBe(12.35);
    expect(r.tags).toBe('[]');
  });

  it('create 缺必填字段被 zod 拒绝', async () => {
    await expect(financeService.create({ date: '2026-08-10' })).rejects.toThrow();
  });

  it('getById 不存在抛错', async () => {
    await expect(financeService.getById('nope')).rejects.toThrow('收支记录不存在');
  });

  it('getById 成功返回记录', async () => {
    const r = await financeService.create({ date: '2026-08-01', type: FINANCE_TYPE.INCOME, amount: 100, category: FINANCE_CATEGORY.SALARY, remark: `${PREFIX}g` });
    const got = await financeService.getById(r.id);
    expect(got.id).toBe(r.id);
    expect(got.amount).toBe(100);
  });

  it('list 按 type 筛选', async () => {
    await financeService.create({ date: '2026-08-01', type: FINANCE_TYPE.INCOME, amount: 100, category: FINANCE_CATEGORY.SALARY, remark: `${PREFIX}a` });
    await financeService.create({ date: '2026-08-02', type: FINANCE_TYPE.EXPENSE, amount: 30, category: FINANCE_CATEGORY.FOOD, remark: `${PREFIX}b` });
    const incomes = await financeService.list({ type: FINANCE_TYPE.INCOME });
    expect(incomes.length).toBe(1);
    expect(incomes[0].type).toBe(FINANCE_TYPE.INCOME);
  });

  it('list 按 keyword 匹配 remark', async () => {
    await financeService.create({ date: '2026-08-01', type: FINANCE_TYPE.EXPENSE, amount: 10, category: FINANCE_CATEGORY.FOOD, remark: `${PREFIX}咖啡杯` });
    const list = await financeService.list({ keyword: '咖啡' });
    expect(list.length).toBe(1);
  });

  it('getMonthlySummary 正确汇总收入/支出/净流入', async () => {
    await financeService.create({ date: '2026-08-01', type: FINANCE_TYPE.INCOME, amount: 100, category: FINANCE_CATEGORY.SALARY, remark: `${PREFIX}g` });
    await financeService.create({ date: '2026-08-02', type: FINANCE_TYPE.EXPENSE, amount: 30, category: FINANCE_CATEGORY.FOOD, remark: `${PREFIX}e` });
    const s = await financeService.getMonthlySummary(MONTH);
    expect(s.income).toBe(100);
    expect(s.expense).toBe(30);
    expect(s.net).toBe(70);
  });

  it('update 支持双形态更新', async () => {
    const r = await financeService.create({ date: '2026-08-01', type: FINANCE_TYPE.EXPENSE, amount: 10, category: FINANCE_CATEGORY.FOOD, remark: `${PREFIX}u` });
    const a = await financeService.update(r.id, { amount: 20 });
    expect(a.amount).toBe(20);
    const b = await financeService.update({ id: r.id, category: FINANCE_CATEGORY.TRANSPORT });
    expect(b.category).toBe(FINANCE_CATEGORY.TRANSPORT);
  });

  it('delete 为软删除', async () => {
    const r = await financeService.create({ date: '2026-08-01', type: FINANCE_TYPE.EXPENSE, amount: 10, category: FINANCE_CATEGORY.FOOD, remark: `${PREFIX}d` });
    await financeService.delete(r.id);
    const raw = await prisma.financeRecord.findUnique({ where: { id: r.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });

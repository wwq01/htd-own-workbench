/**
 * 任务 5 态状态机集成测试（V1.3 §6.2.1）
 * 覆盖 changeStatus 的全部合法/非法迁移，以及 delayTodo 延期行为。
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import todoService from './todo.service.js';
import { TODO_STATUS, TODO_STATUS_TRANSITIONS } from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';
import { tomorrow } from '../../common/utils/date.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_SM_';
const TODAY = '2026-08-10';

// 5 个状态全集
const ALL = Object.values(TODO_STATUS); // pending/in_progress/completed/cancelled/delayed

describe('Todo 5 态状态机', () => {
  let id;
  beforeEach(async () => {
    const t = await todoService.create({ title: `${PREFIX}状态机`, todoDate: TODAY });
    id = t.id;
  });
  afterEach(async () => {
    await prisma.todo.deleteMany({ where: { title: { startsWith: PREFIX } } });
  });

  it('全部 5×5 迁移：合法（含自环）成功、非法抛错', async () => {
    const sm = createStateMachine({ name: 'TodoStatus', ALLOWED_TRANSITIONS: TODO_STATUS_TRANSITIONS });
    let validCount = 0;
    let invalidCount = 0;
    for (const from of ALL) {
      for (const to of ALL) {
        // 重置到源状态（绕过状态机，便于穷举）
        await prisma.todo.update({
          where: { id },
          data: { status: from, completedAt: from === 'completed' ? new Date() : null, delayedUntil: null },
        });
        if (sm.isAllowed(from, to)) {
          validCount += 1;
          const r = await todoService.changeStatus(id, to);
          expect(r.status).toBe(to);
        } else {
          invalidCount += 1;
          await expect(todoService.changeStatus(id, to)).rejects.toThrow();
        }
      }
    }
    // 合法（含 5 个自环）= 13 非自环 + 5 自环 = 18；非法 = 7
    expect(validCount).toBe(18);
    expect(invalidCount).toBe(7);
  });

  it('延期：pending 指定日期应切 DELAYED 并顺延 todoDate', async () => {
    await prisma.todo.update({ where: { id }, data: { status: 'pending' } });
    const r = await todoService.delayTodo(id, { toDate: '2026-08-15' });
    expect(r.status).toBe('delayed');
    expect(r.todoDate).toBe('2026-08-15');
  });

  it('延期：默认顺延到明天（与 date.tomorrow() 一致）', async () => {
    await prisma.todo.update({ where: { id }, data: { status: 'in_progress' } });
    const r = await todoService.delayTodo(id, {});
    expect(r.status).toBe('delayed');
    expect(r.todoDate).toBe(tomorrow());
  });

  it('延期：已完成任务不能延期', async () => {
    await prisma.todo.update({ where: { id }, data: { status: 'completed', completedAt: new Date() } });
    await expect(todoService.delayTodo(id, {})).rejects.toThrow('已完成的任务不能延期');
  });

  it('延期：delayed → in_progress 合法（离开延期态清空 delayedUntil）', async () => {
    await prisma.todo.update({ where: { id }, data: { status: 'delayed', delayedUntil: new Date() } });
    const r = await todoService.changeStatus(id, 'in_progress');
    expect(r.status).toBe('in_progress');
    expect(r.delayedUntil).toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });

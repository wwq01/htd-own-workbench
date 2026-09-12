/**
 * S1-3 状态机收敛测试
 *
 * 目标：证明「配置平台 stateMachines 是唯一生效源，代码常量仅作兜底」，
 * 即消除配置与代码双写。三条主线：
 *   1. 未配置 → 回落默认常量（接入零回归）
 *   2. 配置覆盖 → 业务模块真的按配置走
 *   3. 配置非法 → 回落默认且不抛异常（脏配置不灌进状态机）
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import fieldConfigService, {
  resolveStateMachine,
  resetFieldConfigCache,
} from './fieldConfig.service.js';
import bidService from '../bid/bid.service.js';
import {
  BID_STATUS,
  BID_STATUS_TRANSITIONS,
  TODO_STATUS,
  TODO_STATUS_TRANSITIONS,
} from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });

const TEST_BID_NO = 'TEST_S13_BID';
let originalStateMachines = null;

async function writeStateMachines(stateMachines) {
  const cfg = await fieldConfigService.getConfig();
  await fieldConfigService.updateConfig({ stateMachines });
  return cfg.stateMachines;
}

describe('S1-3 状态机配置化（配置优先，枚举兜底）', () => {
  beforeEach(async () => {
    // 记录初始配置，每个用例后还原，避免污染其他测试
    const cfg = await fieldConfigService.getConfig();
    originalStateMachines = cfg.stateMachines;
    await prisma.bidArchive.deleteMany({ where: { bidNo: { startsWith: TEST_BID_NO } } });
    resetFieldConfigCache();
  });

  afterEach(async () => {
    if (originalStateMachines) {
      await fieldConfigService.updateConfig({ stateMachines: originalStateMachines });
    }
    await prisma.bidArchive.deleteMany({ where: { bidNo: { startsWith: TEST_BID_NO } } });
    resetFieldConfigCache();
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it('未配置时回落默认常量（与 enums 完全一致 → 接入零回归）', async () => {
    const r = await resolveStateMachine('bid.status', {
      states: Object.values(BID_STATUS),
      transitions: BID_STATUS_TRANSITIONS,
    });
    expect(r.transitions).toEqual(BID_STATUS_TRANSITIONS);
    expect(r.states).toEqual(Object.values(BID_STATUS));
  });

  it('全部 8 个状态机域均有合法种子配置', async () => {
    const cfg = await fieldConfigService.getConfig();
    const scopes = [
      'reading.status', 'project.phase', 'todo.status', 'review.status',
      'poc.status', 'bid.status', 'vuln.fixStatus', 'incident.status', 'rfp.status',
    ];
    for (const scope of scopes) {
      const sm = cfg.stateMachines[scope];
      expect(sm, `缺少种子域 ${scope}`).toBeTruthy();
      expect(Array.isArray(sm.states) && sm.states.length > 0, `${scope} states 非法`).toBe(true);
      const ok = sm.transitions && typeof sm.transitions === 'object'
        && Object.values(sm.transitions).every(Array.isArray);
      expect(ok, `${scope} transitions 非法`).toBe(true);
    }
  });

  it('配置覆盖生效：禁用 bid draft→submitted 后该迁移被拒', async () => {
    // 默认路径先证明可用
    const bid = await bidService.create({ bidNo: TEST_BID_NO, status: BID_STATUS.DRAFT });
    await expect(bidService.changeStatus(bid.id, BID_STATUS.SUBMITTED)).resolves.toBeTruthy();

    // 覆盖配置：draft 只允许 archived
    await writeStateMachines({
      ...originalStateMachines,
      'bid.status': {
        states: Object.values(BID_STATUS),
        transitions: { draft: ['archived'], submitted: ['archived'], archived: [] },
        initial: BID_STATUS.DRAFT,
      },
    });
    resetFieldConfigCache();

    const bid2 = await bidService.create({ bidNo: TEST_BID_NO + '_2', status: BID_STATUS.DRAFT });
    await expect(bidService.changeStatus(bid2.id, BID_STATUS.SUBMITTED))
      .rejects.toThrow('非法状态迁移');
    await expect(bidService.changeStatus(bid2.id, BID_STATUS.ARCHIVED))
      .resolves.toBeTruthy();
  });

  it('配置可放开默认不允许的迁移（证明配置是唯一生效源）', async () => {
    await writeStateMachines({
      ...originalStateMachines,
      'bid.status': {
        states: Object.values(BID_STATUS),
        transitions: { draft: ['submitted'], submitted: ['draft', 'archived'], archived: [] },
        initial: BID_STATUS.DRAFT,
      },
    });
    resetFieldConfigCache();

    const bid = await bidService.create({ bidNo: TEST_BID_NO, status: BID_STATUS.DRAFT });
    await bidService.changeStatus(bid.id, BID_STATUS.SUBMITTED);
    // 默认 submitted→draft 非法，配置放开后应成功
    await expect(bidService.changeStatus(bid.id, BID_STATUS.DRAFT)).resolves.toBeTruthy();
  });

  it('配置非法（空对象 / 值非数组）时回落默认，不抛异常', async () => {
    // 注：经 updateConfig API 写入会被 zod 拦截（partialFieldConfigSchema），
    // 故此处直接写库，模拟「历史脏数据 / 手工改库」场景，验证解析层兜底。
    await prisma.systemSetting.upsert({
      where: { key: 'config.stateMachines' },
      create: {
        key: 'config.stateMachines',
        value: JSON.stringify({
          ...originalStateMachines,
          'todo.status': { states: [], transitions: {}, initial: 'x' },
        }),
      },
      update: {
        value: JSON.stringify({
          ...originalStateMachines,
          'todo.status': { states: [], transitions: {}, initial: 'x' },
        }),
      },
    });
    resetFieldConfigCache();
    const empty = await resolveStateMachine('todo.status', {
      states: Object.values(TODO_STATUS),
      transitions: TODO_STATUS_TRANSITIONS,
    });
    expect(empty.transitions).toEqual(TODO_STATUS_TRANSITIONS);
    expect(empty.states).toEqual(Object.values(TODO_STATUS));

    await prisma.systemSetting.upsert({
      where: { key: 'config.stateMachines' },
      create: {
        key: 'config.stateMachines',
        value: JSON.stringify({
          ...originalStateMachines,
          'todo.status': { states: ['pending'], transitions: { pending: 'not-an-array' }, initial: 'pending' },
        }),
      },
      update: {
        value: JSON.stringify({
          ...originalStateMachines,
          'todo.status': { states: ['pending'], transitions: { pending: 'not-an-array' }, initial: 'pending' },
        }),
      },
    });
    resetFieldConfigCache();
    const bad = await resolveStateMachine('todo.status', {
      states: Object.values(TODO_STATUS),
      transitions: TODO_STATUS_TRANSITIONS,
    });
    expect(bad.transitions).toEqual(TODO_STATUS_TRANSITIONS);
  });

  it('缓存未装载时也能正确解析（首请求打库路径）', async () => {
    resetFieldConfigCache();
    const r = await resolveStateMachine('bid.status', {
      states: Object.values(BID_STATUS),
      transitions: BID_STATUS_TRANSITIONS,
    });
    expect(r.transitions).toEqual(BID_STATUS_TRANSITIONS);
  });
});

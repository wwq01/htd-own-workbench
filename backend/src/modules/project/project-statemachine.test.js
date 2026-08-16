/**
 * 项目 6 阶段状态机集成测试（V1.3 §6.2.2）
 * 覆盖 changePhase 全部合法迁移（写 ProjectPhaseTransition）、
 * 交付跟进→项目结项自动生成复盘钩子，以及非法迁移抛错。
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import projectService from './project.service.js';
import { PROJECT_PHASE_TRANSITIONS } from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_SM_';

// 6 个阶段全集（与 PROJECT_PHASE_TRANSITIONS 的键一致）
const PHASES = Object.keys(PROJECT_PHASE_TRANSITIONS);

describe('Project 6 阶段状态机', () => {
  let id;
  beforeEach(async () => {
    const p = await projectService.create({ customerName: `${PREFIX}状态机` });
    id = p.id;
  });
  afterEach(async () => {
    await prisma.projectPhaseTransition.deleteMany({ where: { projectId: id } });
    await prisma.review.deleteMany({ where: { projectId: id } });
    await prisma.project.deleteMany({ where: { customerName: { startsWith: PREFIX } } });
  });

  it('穷举 6×6 迁移矩阵：合法（含自环）=19、非法=17', () => {
    const sm = createStateMachine({ name: 'ProjectPhase', ALLOWED_TRANSITIONS: PROJECT_PHASE_TRANSITIONS });
    let valid = 0;
    let invalid = 0;
    for (const from of PHASES) {
      for (const to of PHASES) {
        if (sm.isAllowed(from, to)) valid += 1;
        else invalid += 1;
      }
    }
    expect(valid).toBe(19);
    expect(invalid).toBe(17);
  });

  it('全部合法非自环迁移：阶段更新成功并写入 ProjectPhaseTransition', async () => {
    let checked = 0;
    for (const from of PHASES) {
      for (const to of PROJECT_PHASE_TRANSITIONS[from]) {
        if (from === to) continue; // 自环跳过（无状态变化、不写历程）
        await prisma.project.update({ where: { id }, data: { phase: from } });
        const r = await projectService.changePhase(id, to, '测试迁移');
        expect(r.phase).toBe(to);
        const rec = await prisma.projectPhaseTransition.findFirst({
          where: { projectId: id, fromPhase: from, toPhase: to },
          orderBy: { createdAt: 'desc' },
        });
        expect(rec).not.toBeNull();
        expect(rec.reason).toBe('测试迁移');
        checked += 1;
      }
    }
    // 合法非自环 = 13
    expect(checked).toBe(13);
  });

  it('结项钩子：交付跟进→项目结项 应自动生成项目复盘草稿', async () => {
    await prisma.project.update({ where: { id }, data: { phase: '交付跟进' } });
    const r = await projectService.changePhase(id, '项目结项', '客户验收通过');
    expect(r.phase).toBe('项目结项');
    const review = await prisma.review.findFirst({ where: { projectId: id } });
    expect(review).not.toBeNull();
    expect(review.type).toBe('project');
    expect(review.deletedAt).toBeNull();
  });

  it('非法迁移应抛 BusinessError(PARAM_ERROR)', async () => {
    const illegalPairs = [];
    for (const from of PHASES) {
      for (const to of PHASES) {
        if (from === to) continue; // 自环在状态机中视为合法 no-op，排除
        const allowed = (PROJECT_PHASE_TRANSITIONS[from] || []).includes(to);
        if (!allowed) illegalPairs.push([from, to]);
      }
    }
    expect(illegalPairs.length).toBe(17);
    for (const [from, to] of illegalPairs) {
      await prisma.project.update({ where: { id }, data: { phase: from } });
      await expect(projectService.changePhase(id, to)).rejects.toThrow();
    }
  });
});

afterAll(async () => { await prisma.$disconnect(); });

/**
 * 复盘 3 态状态机集成测试（V1.3 §6.2.3）
 * 覆盖 submit(draft→submitted)、precipitate(submitted→precipitated)，
 * 以及自动生成/置位沉淀的联动，并穷举 3×3 迁移矩阵。
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import reviewService from './review.service.js';
import { REVIEW_STATUS, REVIEW_STATUS_TRANSITIONS } from '../../common/constants/enums.js';
import { createStateMachine } from '../../lib/stateMachine.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_SM_';

// 3 个状态全集
const ALL = Object.values(REVIEW_STATUS); // draft/submitted/precipitated

describe('Review 3 态状态机', () => {
  let id;
  beforeEach(async () => {
    const r = await reviewService.create({ type: 'week', weekKey: '2026-W88', remark: `${PREFIX}复盘` });
    id = r.id;
  });
  afterEach(async () => {
    await prisma.vaultItem.deleteMany({ where: { sourceId: id } });
    await prisma.review.deleteMany({ where: { remark: { contains: PREFIX } } });
  });

  it('提交 draft→submitted 应成功并自动生成沉淀草稿(DRAFT)', async () => {
    await prisma.review.update({ where: { id }, data: { status: 'draft' } });
    const r = await reviewService.submit(id);
    expect(r.status).toBe('submitted');
    const vault = await prisma.vaultItem.findFirst({ where: { sourceId: id } });
    expect(vault).not.toBeNull();
    expect(vault.status).toBe('DRAFT');
  });

  it('生成沉淀 submitted→precipitated 应成功并置关联沉淀为 PRECIPITATED', async () => {
    await prisma.review.update({ where: { id }, data: { status: 'draft' } });
    await reviewService.submit(id); // 先提交以生成沉淀草稿
    const r = await reviewService.precipitate(id);
    expect(r.status).toBe('precipitated');
    const vault = await prisma.vaultItem.findFirst({ where: { sourceId: id } });
    expect(vault).not.toBeNull();
    expect(vault.status).toBe('PRECIPITATED');
  });

  it('提交：precipitated 状态不可回退（非法）', async () => {
    await prisma.review.update({ where: { id }, data: { status: 'precipitated' } });
    await expect(reviewService.submit(id)).rejects.toThrow();
  });

  it('生成沉淀：draft 状态不可直接沉淀（非法）', async () => {
    await prisma.review.update({ where: { id }, data: { status: 'draft' } });
    await expect(reviewService.precipitate(id)).rejects.toThrow();
  });

  it('穷举 3×3 迁移矩阵：合法/非法与状态机定义一致', () => {
    const sm = createStateMachine({ name: 'ReviewStatus', ALLOWED_TRANSITIONS: REVIEW_STATUS_TRANSITIONS });
    for (const from of ALL) {
      for (const to of ALL) {
        if (from === to) {
          // 自环在工厂层允许，但服务只暴露 submit/precipitate 两个固定目标，不在此穷举
          continue;
        }
        const expected = (REVIEW_STATUS_TRANSITIONS[from] || []).includes(to);
        expect(sm.isAllowed(from, to)).toBe(expected);
      }
    }
    // 合法非自环：draft→submitted, submitted→precipitated = 2
    expect(REVIEW_STATUS_TRANSITIONS.draft).toEqual(['submitted']);
    expect(REVIEW_STATUS_TRANSITIONS.submitted).toEqual(['precipitated']);
    expect(REVIEW_STATUS_TRANSITIONS.precipitated).toEqual([]);
  });
});

afterAll(async () => { await prisma.$disconnect(); });

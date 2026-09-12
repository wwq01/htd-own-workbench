import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import rfpItemService from './rfp.service.js';
import {
  RFP_RESPONSE_TYPE,
  RFP_ITEM_STATUS,
  EVIDENCE_SOURCE_TYPE,
} from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
// 以固定 bidId 隔离测试数据，避免污染业务条目
const BID = 'TEST_BID_001';
const BID_2 = 'TEST_BID_002';

async function clean() {
  await prisma.rfpItem.deleteMany({ where: { bidId: { in: [BID, BID_2] } } });
}

describe('RfpItem Service（S2-5 RFP 条目级应答）', () => {
  beforeEach(clean);
  afterEach(clean);
  afterAll(async () => { await prisma.$disconnect(); });

  it('create 默认 responseType=pending / status=todo / evidence=[]', async () => {
    const item = await rfpItemService.create({ bidId: BID, title: '资质要求' });
    expect(item.bidId).toBe(BID);
    expect(item.responseType).toBe(RFP_RESPONSE_TYPE.PENDING);
    expect(item.status).toBe(RFP_ITEM_STATUS.TODO);
    expect(item.evidence).toEqual([]);
    expect(item.deletedAt).toBeUndefined();
  });

  it('create 拒绝空标题 / 空 bidId（参数校验）', async () => {
    await expect(rfpItemService.create({ bidId: BID, title: '' })).rejects.toThrow('条目标题不能为空');
    await expect(rfpItemService.create({ bidId: '', title: 'x' })).rejects.toThrow('关联投标 ID 不能为空');
  });

  it('create 接受合法 evidence 并按数组返回（对外不暴露 JSON 串）', async () => {
    const item = await rfpItemService.create({
      bidId: BID,
      title: '等保三级资质',
      evidence: [
        { sourceType: EVIDENCE_SOURCE_TYPE.VAULT, sourceId: 'v-001', label: '资质证书扫描件' },
        { sourceType: EVIDENCE_SOURCE_TYPE.POC, sourceId: 'p-009' },
      ],
    });
    expect(item.evidence).toHaveLength(2);
    expect(item.evidence[0]).toEqual({
      sourceType: 'VAULT', sourceId: 'v-001', label: '资质证书扫描件',
    });
    // DB 侧仍为 JSON 字符串
    const raw = await prisma.rfpItem.findUnique({ where: { id: item.id } });
    expect(JSON.parse(raw.evidence)).toHaveLength(2);
  });

  it('create 拒绝非法 evidence（非枚举 sourceType / 空 sourceId / 超 50 条）', async () => {
    await expect(rfpItemService.create({
      bidId: BID, title: 'x', evidence: [{ sourceType: 'NOT_A_TYPE', sourceId: '1' }],
    })).rejects.toThrow();
    await expect(rfpItemService.create({
      bidId: BID, title: 'x', evidence: [{ sourceType: 'VAULT', sourceId: '' }],
    })).rejects.toThrow();
    await expect(rfpItemService.create({
      bidId: BID,
      title: 'x',
      evidence: Array.from({ length: 51 }, (_, i) => ({
        sourceType: 'VAULT', sourceId: `v-${i}`,
      })),
    })).rejects.toThrow();
  });

  it('create 兼容 evidence 的 JSON 字符串入参', async () => {
    const item = await rfpItemService.create({
      bidId: BID,
      title: '应急演练记录',
      evidence: JSON.stringify([{ sourceType: 'MEETING', sourceId: 'm-1', label: '演练纪要' }]),
    });
    expect(item.evidence).toEqual([{ sourceType: 'MEETING', sourceId: 'm-1', label: '演练纪要' }]);
  });

  it('list 按 bidId 精确筛选，且按 sortOrder 升序', async () => {
    await rfpItemService.create({ bidId: BID, title: '第二条', sortOrder: 2 });
    await rfpItemService.create({ bidId: BID_2, title: '别的投标' });
    await rfpItemService.create({ bidId: BID, title: '第一条', sortOrder: 1 });

    const list = await rfpItemService.list({ bidId: BID });
    expect(list).toHaveLength(2);
    expect(list.map((i) => i.title)).toEqual(['第一条', '第二条']);
  });

  it('list 支持 status / responseType 组合筛选', async () => {
    await rfpItemService.create({ bidId: BID, title: 'a', status: 'done', responseType: 'full' });
    await rfpItemService.create({ bidId: BID, title: 'b', status: 'todo', responseType: 'partial' });
    await rfpItemService.create({ bidId: BID, title: 'c', status: 'todo', responseType: 'full' });

    expect(await rfpItemService.list({ bidId: BID, status: 'todo' })).toHaveLength(2);
    expect(await rfpItemService.list({ bidId: BID, responseType: 'full' })).toHaveLength(2);
    expect(await rfpItemService.list({ bidId: BID, status: 'todo', responseType: 'full' })).toHaveLength(1);
  });

  it('list 关键字命中 title / requirement / response / code', async () => {
    await rfpItemService.create({ bidId: BID, title: '等保三级', code: '3.2.1' });
    await rfpItemService.create({ bidId: BID, title: '无关条目', requirement: '要求具备等保资质' });
    await rfpItemService.create({ bidId: BID, title: '交付周期', response: '我方承诺 30 天' });

    expect(await rfpItemService.list({ bidId: BID, q: '等保' })).toHaveLength(2);
    expect(await rfpItemService.list({ bidId: BID, q: '3.2' })).toHaveLength(1);
    expect(await rfpItemService.list({ bidId: BID, q: '30 天' })).toHaveLength(1);
  });

  it('update 部分字段更新，未提交字段保持不变', async () => {
    const item = await rfpItemService.create({ bidId: BID, title: '原要求', requirement: '原文' });
    const updated = await rfpItemService.update(item.id, {
      response: '我方完全满足',
      responseType: RFP_RESPONSE_TYPE.FULL,
      status: RFP_ITEM_STATUS.DONE,
    });
    expect(updated.response).toBe('我方完全满足');
    expect(updated.responseType).toBe('full');
    expect(updated.status).toBe('done');
    expect(updated.requirement).toBe('原文');
    expect(updated.title).toBe('原要求');
  });

  it('update 替换 evidence 为新的挂载集合', async () => {
    const item = await rfpItemService.create({
      bidId: BID, title: 't', evidence: [{ sourceType: 'VAULT', sourceId: 'v-1' }],
    });
    const updated = await rfpItemService.update(item.id, {
      evidence: [{ sourceType: 'NOTE', sourceId: 'n-1', label: '技术说明' }],
    });
    expect(updated.evidence).toEqual([{ sourceType: 'NOTE', sourceId: 'n-1', label: '技术说明' }]);
  });

  it('update 空字段落库为 null（不写空串）', async () => {
    const item = await rfpItemService.create({ bidId: BID, title: 't', owner: '张三' });
    const updated = await rfpItemService.update(item.id, { owner: '' });
    expect(updated.owner).toBeNull();
  });

  it('update 不存在 id 抛 DB_NOT_FOUND', async () => {
    await expect(rfpItemService.update('NOT_EXIST_ID', { response: 'x' }))
      .rejects.toThrow('RFP 条目不存在');
  });

  it('update 状态迁移受状态机约束（done → todo 非法）', async () => {
    const item = await rfpItemService.create({ bidId: BID, title: 't', status: 'done' });
    await expect(rfpItemService.update(item.id, { status: 'todo' }))
      .rejects.toThrow('非法状态迁移');
    // done → doing 合法
    const ok = await rfpItemService.update(item.id, { status: 'doing' });
    expect(ok.status).toBe('doing');
  });

  it('changeStatus 合法迁移生效，非法迁移抛 PARAM_ERROR', async () => {
    const item = await rfpItemService.create({ bidId: BID, title: 't' });
    expect((await rfpItemService.changeStatus(item.id, 'doing')).status).toBe('doing');
    expect((await rfpItemService.changeStatus(item.id, 'done')).status).toBe('done');
    await expect(rfpItemService.changeStatus(item.id, 'todo')).rejects.toThrow('非法状态迁移');
  });

  it('delete 软删除后列表不可见', async () => {
    const item = await rfpItemService.create({ bidId: BID, title: '待删除' });
    await rfpItemService.delete(item.id);
    const list = await rfpItemService.list({ bidId: BID });
    expect(list).toHaveLength(0);
    // 物理行仍在，仅打软删标记
    const raw = await prisma.rfpItem.findUnique({ where: { id: item.id } });
    expect(raw.deletedAt).not.toBeNull();
  });

  it('delete 不存在 id 抛 DB_NOT_FOUND', async () => {
    await expect(rfpItemService.delete('NOT_EXIST_ID')).rejects.toThrow('RFP 条目不存在');
  });

  it('stats 聚合进度 / 应答类型 / 证据数', async () => {
    await rfpItemService.create({ bidId: BID, title: 'a', status: 'done', responseType: 'full' });
    await rfpItemService.create({
      bidId: BID, title: 'b', status: 'done', responseType: 'full',
      evidence: [{ sourceType: 'VAULT', sourceId: 'v-1' }],
    });
    await rfpItemService.create({ bidId: BID, title: 'c', status: 'todo', responseType: 'pending' });
    await rfpItemService.create({ bidId: BID_2, title: '别的投标', status: 'done' });

    const s = await rfpItemService.stats(BID);
    expect(s.total).toBe(3);
    expect(s.byStatus).toEqual({ todo: 1, doing: 0, done: 2 });
    expect(s.byResponseType.full).toBe(2);
    expect(s.byResponseType.pending).toBe(1);
    expect(s.answered).toBe(2);
    expect(s.pendingCount).toBe(1);
    expect(s.evidenceCount).toBe(1);
    expect(s.progress).toBe(67); // 2/3
  });

  it('stats 空结果不产生 NaN（progress=0）', async () => {
    const s = await rfpItemService.stats(BID);
    expect(s.total).toBe(0);
    expect(s.progress).toBe(0);
    expect(s.answered).toBe(0);
  });

  it('stats 拒绝空 bidId', async () => {
    await expect(rfpItemService.stats('')).rejects.toThrow('关联投标 ID 不能为空');
  });
});

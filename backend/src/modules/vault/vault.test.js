import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import vaultService from './vault.service.js';
import { VAULT_STATUS, VAULT_SOURCE_TYPE } from '../../common/constants/enums.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });
const PREFIX = 'TEST_';

describe('Vault Service', () => {
  beforeEach(async () => {
    await prisma.vaultItem.deleteMany({ where: { topic: { contains: PREFIX } } });
  });
  afterEach(async () => {
    await prisma.vaultItem.deleteMany({ where: { topic: { contains: PREFIX } } });
  });

  it('create 默认 DRAFT / MANUAL', async () => {
    const v = await vaultService.create({ topic: `${PREFIX}默认` });
    expect(v.status).toBe(VAULT_STATUS.DRAFT);
    expect(v.sourceType).toBe(VAULT_SOURCE_TYPE.MANUAL);
  });

  it('create 主题为空抛错', async () => {
    await expect(vaultService.create({ topic: '' })).rejects.toThrow('沉淀主题不能为空');
  });

  it('create 序列化 tags', async () => {
    const v = await vaultService.create({ topic: `${PREFIX}标签`, tags: ['安全', '售前'] });
    expect(v.tags).toBe('["安全","售前"]');
  });

  it('list 按 tag 子串筛选', async () => {
    await vaultService.create({ topic: `${PREFIX}标签测试`, tags: ['安全', '售前'], sourceType: VAULT_SOURCE_TYPE.MANUAL });
    const list = await vaultService.list({ tag: '售前' });
    expect(list.length).toBe(1);
  });

  it('autoCreateFromReview 幂等：重复调用不重复创建', async () => {
    const p = { sourceType: VAULT_SOURCE_TYPE.PROJECT_REVIEW, reviewId: 'rv-001', title: `${PREFIX}复盘A`, content: '摘要' };
    const a = await vaultService.autoCreateFromReview(p);
    const b = await vaultService.autoCreateFromReview(p);
    expect(b.id).toBe(a.id);
    const all = await vaultService.list({ sourceType: VAULT_SOURCE_TYPE.PROJECT_REVIEW });
    expect(all.length).toBe(1);
  });

  it('markPrecipitatedBySource 沉淀并回写状态', async () => {
    const p = { sourceType: VAULT_SOURCE_TYPE.PROJECT_REVIEW, reviewId: 'rv-002', title: `${PREFIX}复盘B` };
    await vaultService.autoCreateFromReview(p);
    const marked = await vaultService.markPrecipitatedBySource(VAULT_SOURCE_TYPE.PROJECT_REVIEW, 'rv-002');
    expect(marked.status).toBe(VAULT_STATUS.PRECIPITATED);
    const none = await vaultService.markPrecipitatedBySource(VAULT_SOURCE_TYPE.PROJECT_REVIEW, 'rv-999');
    expect(none).toBeNull();
  });

  it('update 重新序列化 tags 并支持状态流转', async () => {
    const v = await vaultService.create({ topic: `${PREFIX}更新`, tags: ['a'] });
    const upd = await vaultService.update(v.id, { tags: ['b', 'c'], status: VAULT_STATUS.ARCHIVED });
    expect(upd.tags).toBe('["b","c"]');
    expect(upd.status).toBe(VAULT_STATUS.ARCHIVED);
  });

  it('delete 软删除', async () => {
    const v = await vaultService.create({ topic: `${PREFIX}删` });
    await vaultService.delete(v.id);
    const raw = await prisma.vaultItem.findUnique({ where: { id: v.id } });
    expect(raw.deletedAt).not.toBeNull();
  });
});

afterAll(async () => { await prisma.$disconnect(); });

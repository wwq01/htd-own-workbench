/**
 * Secret 模块测试（阶段5）
 * 覆盖：Schema 校验 + Service CRUD + Repository 查询
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createSecretSchema,
  updateSecretSchema,
  listSecretSchema,
} from './secret.schema.js';
import secretService from './secret.service.js';
import { SECRET_TYPE } from '../../common/constants/enums.js';

const prisma = new PrismaClient({
  datasourceUrl: 'file:D:\\荒天帝工作台\\data\\workbench.db',
  log: ['error'],
});

// 测试数据前缀，便于清理
const PREFIX = 'TEST_';

// ============ Schema 校验测试 ============
describe('Secret Schema 校验', () => {
  describe('createSecretSchema', () => {
    it('合法数据应通过校验', () => {
      const data = createSecretSchema.parse({
        name: `${PREFIX}测试账号`,
        type: SECRET_TYPE.ENV_ACCOUNT,
        content: 'admin / password123',
        usageScenario: '测试环境登录',
        remark: '备注信息',
        expiryDate: '2026-12-31',
      });
      expect(data.name).toBe(`${PREFIX}测试账号`);
      expect(data.type).toBe('环境账号');
      expect(data.sortOrder).toBe(0); // 默认值
    });

    it('名称为空应拒绝', () => {
      const result = createSecretSchema.safeParse({ name: '', content: 'test' });
      expect(result.success).toBe(false);
    });

    it('名称超长应拒绝', () => {
      const result = createSecretSchema.safeParse({
        name: 'x'.repeat(201),
        content: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('content 为空应拒绝', () => {
      const result = createSecretSchema.safeParse({
        name: `${PREFIX}test`,
        content: '',
      });
      expect(result.success).toBe(false);
    });

    it('非法 type 应拒绝', () => {
      const result = createSecretSchema.safeParse({
        name: `${PREFIX}test`,
        content: 'test',
        type: '不存在的类型',
      });
      expect(result.success).toBe(false);
    });

    it('空字符串可选字段应被规范化为 null', () => {
      const data = createSecretSchema.parse({
        name: `${PREFIX}test`,
        content: 'test',
        usageScenario: '',
        remark: '',
        expiryDate: '',
      });
      // schema 层面空字符串是允许的（or(z.literal(''))），service 层做规范化
      expect(data.usageScenario).toBe('');
      expect(data.remark).toBe('');
    });
  });

  describe('updateSecretSchema', () => {
    it('带 id 的部分更新应通过', () => {
      const data = updateSecretSchema.parse({
        id: 'test-id',
        name: '更新后的名称',
      });
      expect(data.id).toBe('test-id');
      expect(data.name).toBe('更新后的名称');
    });

    it('缺少 id 应拒绝', () => {
      const result = updateSecretSchema.safeParse({ name: 'test' });
      expect(result.success).toBe(false);
    });
  });

  describe('listSecretSchema', () => {
    it('空 query 应通过', () => {
      const data = listSecretSchema.parse({});
      expect(data).toEqual({});
    });

    it('page 为字符串数字应被 coerce', () => {
      const data = listSecretSchema.parse({ page: '1', pageSize: '20' });
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(20);
    });

    it('非法 type 应拒绝', () => {
      const result = listSecretSchema.safeParse({ type: '不存在' });
      expect(result.success).toBe(false);
    });
  });
});

// ============ Service 层集成测试（真实数据库） ============
describe('Secret Service 集成测试', () => {
  // 每个测试前清理 TEST_ 前缀数据
  beforeEach(async () => {
    await prisma.secret.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  afterEach(async () => {
    await prisma.secret.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  describe('create', () => {
    it('应成功创建凭据并返回完整数据', async () => {
      const created = await secretService.create({
        name: `${PREFIX}创建测试`,
        type: 'API密钥',
        content: 'ghp_test123456',
        usageScenario: 'CI/CD',
        remark: '测试备注',
        expiryDate: '2026-12-31',
      });

      expect(created).toBeDefined();
      expect(created.id).toBeTruthy();
      expect(created.name).toBe(`${PREFIX}创建测试`);
      expect(created.type).toBe('API密钥');
      expect(created.content).toBe('ghp_test123456');
      expect(created.usageScenario).toBe('CI/CD');
      expect(created.remark).toBe('测试备注');
      expect(created.expiryDate).toBe('2026-12-31');
      expect(created.sortOrder).toBe(0);
      expect(created.deletedAt).toBeNull();
      expect(created.createdAt).toBeDefined();
    });

    it('空字符串字段应被规范化为 null', async () => {
      const created = await secretService.create({
        name: `${PREFIX}规范化测试`,
        type: '其他',
        content: 'content',
        usageScenario: '',
        remark: '',
        expiryDate: '',
      });

      expect(created.usageScenario).toBeNull();
      expect(created.remark).toBeNull();
      expect(created.expiryDate).toBeNull();
    });

    it('缺少必填字段应抛出 ZodError', async () => {
      await expect(
        secretService.create({ type: '其他' })
      ).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('应返回列表数据', async () => {
      await secretService.create({
        name: `${PREFIX}列表测试1`,
        type: '环境账号',
        content: 'content1',
      });
      await secretService.create({
        name: `${PREFIX}列表测试2`,
        type: 'API密钥',
        content: 'content2',
      });

      const list = await secretService.list({});
      const testItems = list.filter(item => item.name.startsWith(PREFIX));
      expect(testItems.length).toBe(2);
    });

    it('应支持按类型筛选', async () => {
      await secretService.create({
        name: `${PREFIX}筛选_环境账号`,
        type: '环境账号',
        content: 'c1',
      });
      await secretService.create({
        name: `${PREFIX}筛选_API密钥`,
        type: 'API密钥',
        content: 'c2',
      });

      const list = await secretService.list({ type: 'API密钥' });
      const testItems = list.filter(item => item.name.startsWith(PREFIX));
      expect(testItems.length).toBe(1);
      expect(testItems[0].type).toBe('API密钥');
    });

    it('应支持关键字搜索（name/usageScenario/remark）', async () => {
      await secretService.create({
        name: `${PREFIX}搜索_名称包含关键字`,
        type: '其他',
        content: 'c1',
        usageScenario: '场景A',
      });
      await secretService.create({
        name: `${PREFIX}搜索_其他`,
        type: '其他',
        content: 'c2',
        remark: '备注包含特殊关键字',
      });

      const list = await secretService.list({ keyword: '关键字' });
      const testItems = list.filter(item => item.name.startsWith(PREFIX));
      expect(testItems.length).toBe(2);
    });
  });

  describe('getById', () => {
    it('应返回指定凭据详情', async () => {
      const created = await secretService.create({
        name: `${PREFIX}详情测试`,
        type: '授权码',
        content: 'LICENSE-XXXX',
      });

      const found = await secretService.getById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.name).toBe(`${PREFIX}详情测试`);
      expect(found.content).toBe('LICENSE-XXXX');
    });

    it('不存在的 ID 应抛出 BusinessError', async () => {
      await expect(
        secretService.getById('non-existent-id-12345')
      ).rejects.toThrow('凭据不存在');
    });
  });

  describe('update', () => {
    it('应成功更新凭据字段', async () => {
      const created = await secretService.create({
        name: `${PREFIX}更新前`,
        type: '其他',
        content: 'old_content',
        remark: '旧备注',
      });

      const updated = await secretService.update({
        id: created.id,
        name: `${PREFIX}更新后`,
        content: 'new_content',
        remark: '新备注',
      });

      expect(updated.name).toBe(`${PREFIX}更新后`);
      expect(updated.content).toBe('new_content');
      expect(updated.remark).toBe('新备注');
    });

    it('更新不存在的 ID 应抛出 BusinessError', async () => {
      await expect(
        secretService.update({ id: 'non-existent-id', name: 'test' })
      ).rejects.toThrow('凭据不存在');
    });
  });

  describe('delete', () => {
    it('应成功软删除凭据', async () => {
      const created = await secretService.create({
        name: `${PREFIX}删除测试`,
        type: '其他',
        content: 'to_delete',
      });

      await secretService.delete(created.id);

      // 验证软删除：deletedAt 不为 null
      const raw = await prisma.secret.findUnique({ where: { id: created.id } });
      expect(raw).toBeDefined();
      expect(raw.deletedAt).not.toBeNull();
    });

    it('删除不存在的 ID 应抛出 BusinessError', async () => {
      await expect(
        secretService.delete('non-existent-id-12345')
      ).rejects.toThrow('凭据不存在');
    });
  });

  describe('getTypeStats', () => {
    it('应返回各类型数量统计', async () => {
      await secretService.create({
        name: `${PREFIX}统计1`,
        type: '环境账号',
        content: 'c1',
      });
      await secretService.create({
        name: `${PREFIX}统计2`,
        type: '环境账号',
        content: 'c2',
      });
      await secretService.create({
        name: `${PREFIX}统计3`,
        type: 'API密钥',
        content: 'c3',
      });

      const stats = await secretService.getTypeStats();
      expect(stats['环境账号']).toBeGreaterThanOrEqual(2);
      expect(stats['API密钥']).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============ 清理全局连接 ============
afterAll(async () => {
  await prisma.$disconnect();
});

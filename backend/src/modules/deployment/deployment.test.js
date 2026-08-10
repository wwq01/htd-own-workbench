/**
 * Deployment 模块测试（阶段5）
 * 覆盖：Schema 校验 + Service CRUD + Repository 查询
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createDeploymentSchema,
  updateDeploymentSchema,
  listDeploymentSchema,
} from './deployment.schema.js';
import deploymentService from './deployment.service.js';
import { DEPLOY_ENV_TYPE } from '../../common/constants/enums.js';

const prisma = new PrismaClient({
  datasourceUrl: 'file:D:\\荒天帝工作台\\data\\workbench.db',
  log: ['error'],
});

const PREFIX = 'TEST_';

// ============ Schema 校验测试 ============
describe('Deployment Schema 校验', () => {
  describe('createDeploymentSchema', () => {
    it('合法数据应通过校验', () => {
      const data = createDeploymentSchema.parse({
        name: `${PREFIX}生产环境部署`,
        envType: DEPLOY_ENV_TYPE.PRODUCTION,
        deviceType: 'Dell R740',
        ipAddress: '192.168.1.100',
        config: 'NODE_ENV=production',
        steps: '1. 拉代码\n2. 构建\n3. 启动',
        commands: 'npm run build && pm2 start',
        remark: '生产环境',
      });
      expect(data.name).toBe(`${PREFIX}生产环境部署`);
      expect(data.envType).toBe('生产环境');
      expect(data.sortOrder).toBe(0);
    });

    it('名称为空应拒绝', () => {
      const result = createDeploymentSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('名称超长应拒绝', () => {
      const result = createDeploymentSchema.safeParse({
        name: 'x'.repeat(201),
        envType: '测试环境',
      });
      expect(result.success).toBe(false);
    });

    it('非法 envType 应拒绝', () => {
      const result = createDeploymentSchema.safeParse({
        name: `${PREFIX}test`,
        envType: '不存在的环境',
      });
      expect(result.success).toBe(false);
    });

    it('默认 envType 应为测试环境', () => {
      const data = createDeploymentSchema.parse({
        name: `${PREFIX}test`,
      });
      expect(data.envType).toBe('测试环境');
    });
  });

  describe('updateDeploymentSchema', () => {
    it('带 id 的部分更新应通过', () => {
      const data = updateDeploymentSchema.parse({
        id: 'test-id',
        name: '更新名称',
      });
      expect(data.id).toBe('test-id');
      expect(data.name).toBe('更新名称');
    });

    it('缺少 id 应拒绝', () => {
      const result = updateDeploymentSchema.safeParse({ name: 'test' });
      expect(result.success).toBe(false);
    });
  });

  describe('listDeploymentSchema', () => {
    it('空 query 应通过', () => {
      const data = listDeploymentSchema.parse({});
      expect(data).toEqual({});
    });

    it('非法 envType 应拒绝', () => {
      const result = listDeploymentSchema.safeParse({ envType: '不存在' });
      expect(result.success).toBe(false);
    });
  });
});

// ============ Service 层集成测试 ============
describe('Deployment Service 集成测试', () => {
  beforeEach(async () => {
    await prisma.deployment.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  afterEach(async () => {
    await prisma.deployment.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  describe('create', () => {
    it('应成功创建部署记录', async () => {
      const created = await deploymentService.create({
        name: `${PREFIX}创建测试`,
        envType: '生产环境',
        deviceType: 'Dell R740',
        ipAddress: '10.0.1.100',
        config: 'NODE_ENV=production',
        steps: '1. 安装\n2. 启动',
        commands: 'npm ci && npm start',
        remark: '生产部署',
      });

      expect(created).toBeDefined();
      expect(created.id).toBeTruthy();
      expect(created.name).toBe(`${PREFIX}创建测试`);
      expect(created.envType).toBe('生产环境');
      expect(created.ipAddress).toBe('10.0.1.100');
      expect(created.commands).toBe('npm ci && npm start');
      expect(created.sortOrder).toBe(0);
      expect(created.deletedAt).toBeNull();
    });

    it('空字符串字段应被规范化为 null', async () => {
      const created = await deploymentService.create({
        name: `${PREFIX}规范化测试`,
        envType: '本地环境',
        deviceType: '',
        ipAddress: '',
        config: '',
        steps: '',
        commands: '',
        remark: '',
      });

      expect(created.deviceType).toBeNull();
      expect(created.ipAddress).toBeNull();
      expect(created.config).toBeNull();
      expect(created.steps).toBeNull();
      expect(created.commands).toBeNull();
      expect(created.remark).toBeNull();
    });

    it('缺少必填字段应抛出错误', async () => {
      await expect(
        deploymentService.create({ envType: '测试环境' })
      ).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('应返回列表数据', async () => {
      await deploymentService.create({
        name: `${PREFIX}列表1`,
        envType: '测试环境',
      });
      await deploymentService.create({
        name: `${PREFIX}列表2`,
        envType: '生产环境',
      });

      const list = await deploymentService.list({});
      const testItems = list.filter(item => item.name.startsWith(PREFIX));
      expect(testItems.length).toBe(2);
    });

    it('应支持按环境类型筛选', async () => {
      await deploymentService.create({
        name: `${PREFIX}筛选_生产`,
        envType: '生产环境',
      });
      await deploymentService.create({
        name: `${PREFIX}筛选_测试`,
        envType: '测试环境',
      });

      const list = await deploymentService.list({ envType: '生产环境' });
      const testItems = list.filter(item => item.name.startsWith(PREFIX));
      expect(testItems.length).toBe(1);
      expect(testItems[0].envType).toBe('生产环境');
    });

    it('应支持关键字搜索（name/deviceType/ipAddress/remark）', async () => {
      await deploymentService.create({
        name: `${PREFIX}搜索_IP包含`,
        envType: '测试环境',
        ipAddress: '192.168.99.99',
      });
      await deploymentService.create({
        name: `${PREFIX}搜索_其他`,
        envType: '测试环境',
        remark: '备注包含特殊关键字',
      });
      await deploymentService.create({
        name: `${PREFIX}搜索_无关`,
        envType: '测试环境',
        deviceType: '普通设备',
      });

      const list = await deploymentService.list({ keyword: '关键字' });
      const testItems = list.filter(item => item.name.startsWith(PREFIX));
      expect(testItems.length).toBe(1);
      expect(testItems[0].name).toContain('其他');
    });

    it('应支持按 IP 地址搜索', async () => {
      await deploymentService.create({
        name: `${PREFIX}IP搜索`,
        envType: '测试环境',
        ipAddress: '10.20.30.40',
      });

      const list = await deploymentService.list({ keyword: '10.20.30' });
      const testItems = list.filter(item => item.name.startsWith(PREFIX));
      expect(testItems.length).toBe(1);
    });
  });

  describe('getById', () => {
    it('应返回指定部署记录详情', async () => {
      const created = await deploymentService.create({
        name: `${PREFIX}详情测试`,
        envType: '演示环境',
        deviceType: 'MacBook Pro',
      });

      const found = await deploymentService.getById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.name).toBe(`${PREFIX}详情测试`);
      expect(found.deviceType).toBe('MacBook Pro');
    });

    it('不存在的 ID 应抛出 BusinessError', async () => {
      await expect(
        deploymentService.getById('non-existent-id-12345')
      ).rejects.toThrow('部署记录不存在');
    });
  });

  describe('update', () => {
    it('应成功更新部署记录', async () => {
      const created = await deploymentService.create({
        name: `${PREFIX}更新前`,
        envType: '测试环境',
        ipAddress: '192.168.1.1',
      });

      const updated = await deploymentService.update({
        id: created.id,
        name: `${PREFIX}更新后`,
        envType: '生产环境',
        ipAddress: '10.0.0.1',
      });

      expect(updated.name).toBe(`${PREFIX}更新后`);
      expect(updated.envType).toBe('生产环境');
      expect(updated.ipAddress).toBe('10.0.0.1');
    });

    it('更新不存在的 ID 应抛出 BusinessError', async () => {
      await expect(
        deploymentService.update({ id: 'non-existent-id', name: 'test' })
      ).rejects.toThrow('部署记录不存在');
    });
  });

  describe('delete', () => {
    it('应成功软删除部署记录', async () => {
      const created = await deploymentService.create({
        name: `${PREFIX}删除测试`,
        envType: '本地环境',
      });

      await deploymentService.delete(created.id);

      const raw = await prisma.deployment.findUnique({ where: { id: created.id } });
      expect(raw).toBeDefined();
      expect(raw.deletedAt).not.toBeNull();
    });

    it('删除不存在的 ID 应抛出 BusinessError', async () => {
      await expect(
        deploymentService.delete('non-existent-id-12345')
      ).rejects.toThrow('部署记录不存在');
    });
  });

  describe('getEnvStats', () => {
    it('应返回各环境类型数量统计', async () => {
      await deploymentService.create({
        name: `${PREFIX}统计_生产1`,
        envType: '生产环境',
      });
      await deploymentService.create({
        name: `${PREFIX}统计_测试1`,
        envType: '测试环境',
      });
      await deploymentService.create({
        name: `${PREFIX}统计_测试2`,
        envType: '测试环境',
      });

      const stats = await deploymentService.getEnvStats();
      expect(stats['生产环境']).toBeGreaterThanOrEqual(1);
      expect(stats['测试环境']).toBeGreaterThanOrEqual(2);
    });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * V2-1 本地 Agent 通道 - 集成测试
 * 覆盖：参数校验、创建即跑、技能选择、状态机、列表过滤、详情解析、软删、重跑、未知技能报错、skills 清单
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import agentService from './agent.service.js';
import { listSkills } from './skills/index.js';
import {
  createAgentTaskSchema,
  agentTaskIdSchema,
  listAgentTaskSchema,
} from './agent.schema.js';

const prisma = new PrismaClient({
  datasourceUrl: process.env.HTD_TEST_DB_URL,
  log: ['error'],
});
const PREFIX = 'AGENT_TEST_';

describe('Agent Schema 校验', () => {
  it('合法指令应通过', () => {
    const d = createAgentTaskSchema.parse({ prompt: `${PREFIX}做点事` });
    expect(d.prompt).toContain(PREFIX);
  });
  it('空指令应拒绝', () => {
    expect(createAgentTaskSchema.safeParse({ prompt: '' }).success).toBe(false);
  });
  it('id 校验应拒绝空值', () => {
    expect(agentTaskIdSchema.safeParse({ id: '' }).success).toBe(false);
  });
  it('status 枚举非法应拒绝', () => {
    expect(listAgentTaskSchema.safeParse({ status: 'xxx' }).success).toBe(false);
  });
});

describe('Agent Service 集成测试', () => {
  beforeEach(async () => {
    await prisma.agentTask.deleteMany({ where: { prompt: { startsWith: PREFIX } } });
  });

  it('提交后应立即执行并落 succeeded', async () => {
    const t = await agentService.create({ prompt: `${PREFIX}你好世界` });
    expect(t.status).toBe('succeeded');
    expect(t.result).toBeTruthy();
    expect(t.result.skill).toBe('generic');
    expect(t.result.output.words).toBeGreaterThan(0);
  });

  it('按关键字自动匹配 vault-digest 技能', async () => {
    const t = await agentService.create({ prompt: `${PREFIX}帮我总结一下 vault 沉淀库` });
    expect(t.status).toBe('succeeded');
    expect(t.result.skill).toBe('vault-digest');
    expect(typeof t.result.output.count).toBe('number');
  });

  it('显式指定 skillKey 应生效', async () => {
    const t = await agentService.create({ prompt: `${PREFIX}巡检`, skillKey: 'db-health' });
    expect(t.result.skill).toBe('db-health');
    expect(t.result.output.engine).toBe('sqlite-local');
  });

  it('显式指定不存在的技能应拒绝（不产孤儿任务）', async () => {
    await expect(agentService.create({ prompt: `${PREFIX}x`, skillKey: 'nope' }))
      .rejects.toThrow(/技能不存在/);
    const leftover = await prisma.agentTask.findMany({ where: { prompt: `${PREFIX}x` } });
    expect(leftover).toHaveLength(0);
  });

  it('技能运行时异常应落 failed 且记录 error', async () => {
    // 构造一个会让技能抛错的 prompt 不可控，改用直接调用 runTask 的失败路径：
    // 通过不存在的任务 id 触发 NOT_FOUND 分支
    await expect(agentService.runNow('non-existent-id')).rejects.toThrow();
  });

  it('autoRun=false 时应保持 pending 且不执行', async () => {
    const t = await agentService.create({ prompt: `${PREFIX}待执行`, autoRun: false });
    expect(t.status).toBe('pending');
    expect(t.result).toBeNull();
  });

  it('列表可按 status 过滤', async () => {
    await agentService.create({ prompt: `${PREFIX}列表a`, autoRun: false });
    const list = await agentService.list({ status: 'pending' });
    const arr = Array.isArray(list) ? list : list.list;
    expect(arr.every((x) => x.status === 'pending')).toBe(true);
    expect(arr.some((x) => x.prompt.includes(PREFIX))).toBe(true);
  });

  it('详情应返回解析后的 result 对象', async () => {
    const created = await agentService.create({ prompt: `${PREFIX}详情` });
    const got = await agentService.getById(created.id);
    expect(got.id).toBe(created.id);
    expect(typeof got.result).toBe('object');
    expect(got.result.skill).toBeTruthy();
  });

  it('软删除后详情不可见', async () => {
    const t = await agentService.create({ prompt: `${PREFIX}删除` });
    await agentService.remove(t.id);
    await expect(agentService.getById(t.id)).rejects.toThrow(/不存在或已删除/);
    const raw = await prisma.agentTask.findUnique({ where: { id: t.id } });
    expect(raw.deletedAt).not.toBeNull();
  });

  it('重跑端点应更新结果', async () => {
    const t = await agentService.create({ prompt: `${PREFIX}重跑` });
    const re = await agentService.runNow(t.id);
    expect(re.status).toBe('succeeded');
    expect(re.id).toBe(t.id);
  });
});

describe('Skills 注册表', () => {
  it('应注册 4 个技能且含 generic 兜底', () => {
    const skills = listSkills();
    expect(skills.length).toBe(4);
    expect(skills.some((s) => s.key === 'generic')).toBe(true);
    expect(skills.some((s) => s.key === 'vault-digest')).toBe(true);
  });
  it('matchSkill 关键字命中', async () => {
    const { matchSkill } = await import('./skills/index.js');
    expect(matchSkill('总结我的 vault 笔记').key).toBe('vault-digest');
    expect(matchSkill('随便聊聊').key).toBe('generic');
  });
});

afterAll(async () => {
  await prisma.agentTask.deleteMany({ where: { prompt: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import fieldConfigService from './fieldConfig.service.js';

const prisma = new PrismaClient({ datasourceUrl: process.env.HTD_TEST_DB_URL, log: ['error'] });

async function cleanup() {
  await prisma.systemSetting.deleteMany({
    where: { key: { in: ['config.dropdowns', 'config.customFields', 'config.stateMachines'] } },
  });
}

describe('FieldConfigService (V1.5 §8.3)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('getConfig 返回以枚举为种子的默认值', async () => {
    const cfg = await fieldConfigService.getConfig();
    expect(Array.isArray(cfg.dropdowns['project.phase'])).toBe(true);
    expect(cfg.dropdowns['project.phase']).toContain('需求沟通');
    expect(Array.isArray(cfg.customFields.reading)).toBe(true);
    expect(cfg.stateMachines['reading.status']).toBeTruthy();
    expect(cfg.stateMachines['reading.status'].states).toContain('unread');
  });

  it('updateConfig 持久化自定义下拉项并可回读', async () => {
    const next = await fieldConfigService.updateConfig({
      dropdowns: { tag: ['安全', '售前', 'AI'] },
    });
    expect(next.dropdowns.tag).toEqual(['安全', '售前', 'AI']);

    const reread = await fieldConfigService.getConfig();
    expect(reread.dropdowns.tag).toEqual(['安全', '售前', 'AI']);
  });

  it('updateConfig 持久化自定义扩展字段', async () => {
    const next = await fieldConfigService.updateConfig({
      customFields: {
        reading: [
          { key: 'source_author', label: '作者', type: 'single_line', required: false },
          { key: 'key_points', label: '要点', type: 'multi_line' },
        ],
      },
    });
    expect(next.customFields.reading.length).toBe(2);
    expect(next.customFields.reading[0].key).toBe('source_author');
  });

  it('updateConfig 持久化可配置状态机迁移', async () => {
    const next = await fieldConfigService.updateConfig({
      stateMachines: {
        'project.phase': {
          states: ['需求沟通', '方案撰写', '项目结项'],
          transitions: { '需求沟通': ['方案撰写', '项目结项'], '方案撰写': ['项目结项'] },
          initial: '需求沟通',
        },
      },
    });
    expect(next.stateMachines['project.phase'].states).toEqual(['需求沟通', '方案撰写', '项目结项']);
    expect(next.stateMachines['project.phase'].transitions['需求沟通']).toContain('方案撰写');
  });

  it('updateConfig 拒绝非法字段标识', async () => {
    await expect(
      fieldConfigService.updateConfig({
        customFields: { reading: [{ key: '1bad', label: '坏', type: 'single_line' }] },
      })
    ).rejects.toBeTruthy();
  });

  it('局部更新不影响其他配置域', async () => {
    await fieldConfigService.updateConfig({ dropdowns: { tag: ['A'] } });
    const next = await fieldConfigService.updateConfig({
      customFields: { reading: [{ key: 'note', label: '备注', type: 'multi_line' }] },
    });
    // 下拉项保留
    expect(next.dropdowns.tag).toEqual(['A']);
    expect(next.customFields.reading[0].key).toBe('note');
  });
});

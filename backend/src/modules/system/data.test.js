import { describe, expect, it } from 'vitest';
import { destructiveActionSchema, importDataSchema } from './data.schema.js';

describe('数据管理 Schema 校验', () => {
  it('应接受带确认标记的导入包', () => {
    const result = importDataSchema.parse({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      confirm: true,
      tables: { memos: [{ id: 'memo-1', content: 'test' }] },
    });
    expect(result.confirm).toBe(true);
  });

  it('导入和清空都必须显式确认', () => {
    expect(importDataSchema.safeParse({ version: '1.0', exportedAt: 'now', tables: {} }).success).toBe(false);
    expect(destructiveActionSchema.safeParse({ confirm: false, confirmationText: '确认清空' }).success).toBe(false);
    expect(destructiveActionSchema.safeParse({ confirm: true, confirmationText: '确认清空' }).success).toBe(true);
  });

  it('导入文件应包含完整的数据表集合', () => {
    const partial = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      confirm: true,
      tables: { memos: [] },
    };
    expect(importDataSchema.parse(partial).tables.memos).toEqual([]);
  });
});

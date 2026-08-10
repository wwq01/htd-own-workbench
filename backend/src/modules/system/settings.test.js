import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings.service.js';
import { settingsUpdateSchema } from './settings.schema.js';

describe('系统设置', () => {
  it('应提供稳定的默认设置', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('dark');
    expect(DEFAULT_SETTINGS.backupFrequency).toBe('startup');
    expect(DEFAULT_SETTINGS.maxBackups).toBeGreaterThan(0);
  });

  it('应规范化合法设置并拒绝非法值', () => {
    expect(normalizeSettings({ theme: 'light', backupFrequency: 'weekly', maxBackups: 10 })).toMatchObject({
      theme: 'light', backupFrequency: 'weekly', maxBackups: 10,
    });
    expect(settingsUpdateSchema.safeParse({ theme: 'blue' }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ maxBackups: 31 }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ dataRoot: 'relative/path' }).success).toBe(false);
  });
});

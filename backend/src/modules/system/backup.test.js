import { describe, expect, it } from 'vitest';
import backupService, { createManualBackupFileName, isSafeBackupFileName } from './backup.service.js';

describe('SQLite 备份管理', () => {
  it('应生成符合约定的手动备份文件名', () => {
    expect(createManualBackupFileName(new Date(2026, 7, 10, 14, 50, 3)))
      .toBe('workbench_manual_20260810_145003.db');
  });

  it('应拒绝路径穿越和非 db 文件名', () => {
    expect(isSafeBackupFileName('workbench_20260810.db')).toBe(true);
    expect(isSafeBackupFileName('../workbench_20260810.db')).toBe(false);
    expect(isSafeBackupFileName('workbench_20260810.json')).toBe(false);
  });

  it('应能读取备份目录列表且只返回安全 db 文件', async () => {
    const backups = await backupService.listBackups();
    expect(Array.isArray(backups)).toBe(true);
    expect(backups.every((item) => isSafeBackupFileName(item.fileName))).toBe(true);
  });

  it('应能创建并删除一个真实 SQLite 备份文件', async () => {
    const created = await backupService.createBackup();
    expect(isSafeBackupFileName(created.fileName)).toBe(true);
    expect(created.size).toBeGreaterThan(0);
    expect(backupService.getBackupPath(created.fileName)).toContain(created.fileName);

    const removed = await backupService.removeBackup(created.fileName);
    expect(removed.fileName).toBe(created.fileName);
  });
});

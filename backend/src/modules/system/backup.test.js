/**
 * 备份服务测试（V1.2）
 * 使用内存 mock fs（依赖注入），不触碰真实文件系统，
 * 因此在本机与沙箱环境均能稳定通过（避免环境级文件删除拦截干扰）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { createBackupService } from './backup.service.js';
import { Observable } from '../../lib/observable.js';

const SQLITE_MAGIC = 'SQLite format 3\0';

function createMockFs(opts = {}) {
  const store = new Map(); // 归一化路径 -> Buffer
  let writeCounter = 0;
  const norm = (p) => String(p).replace(/\\/g, '/');
  const fs = {
    _store: store,
    existsSync(p) { return store.has(norm(p)); },
    readdirSync(dir) {
      const d = norm(dir).replace(/\/$/, '');
      const out = [];
      for (const k of store.keys()) {
        if (k.startsWith(d + '/')) out.push(k.slice(d.length + 1).split('/')[0]);
      }
      return [...new Set(out)];
    },
    statSync(p) {
      const b = store.get(norm(p));
      if (!b) throw new Error('ENOENT');
      return { size: b.length, birthtime: new Date(), mtime: new Date(), mtimeMs: Date.now() + writeCounter };
    },
    mkdirSync() { /* no-op */ },
    copyFileSync(src, dest) {
      if (opts.failCopy) throw new Error('ENOSPC: no space left on device');
      const b = store.get(norm(src));
      if (!b) throw new Error('ENOENT');
      store.set(norm(dest), Buffer.from(b));
      writeCounter++;
    },
    unlinkSync(p) {
      if (!store.has(norm(p))) throw new Error('ENOENT');
      store.delete(norm(p));
    },
    writeFileSync(p, content) {
      store.set(norm(p), Buffer.isBuffer(content) ? content : Buffer.from(String(content)));
      writeCounter++;
    },
    readFileSync(p) {
      const b = store.get(norm(p));
      if (!b) throw new Error('ENOENT');
      return b.toString('utf8');
    },
    openSync(p) {
      if (!store.has(norm(p))) throw new Error('ENOENT');
      return norm(p);
    },
    readSync(fd, buf, off, len, pos) {
      const b = store.get(fd);
      if (!b) throw new Error('ENOENT');
      b.copy(buf, off, pos, pos + len);
      return len;
    },
    closeSync() { /* no-op */ },
  };
  return fs;
}

function makeService(opts = {}) {
  const fs = opts.fs || createMockFs(opts);
  const appConfig = { dbPath: '/data/workbench.db', backupDir: '/backups' };
  // 预置主库（合法 SQLite 魔数头）
  fs.writeFileSync(appConfig.dbPath, Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.from('MAIN_DATA')]));
  const svc = createBackupService({
    fs,
    path,
    appConfig,
    clock: () => new Date('2026-08-16T10:00:00'),
    eventBus: new Observable(),
  });
  return { svc, fs, appConfig };
}

function seedBackup(svc, appConfig, content = 'BACKUP_DATA') {
  return svc.createManualBackup('seed').then((info) => {
    // 用指定内容覆盖刚生成的备份文件，便于校验恢复内容
    svc.fs.writeFileSync(svc.path.join(appConfig.backupDir, info.fileName),
      Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.from(content)]));
    return info;
  });
}

describe('BackupService - 每日自动备份懒触发', () => {
  it('首次触发创建 1 份，同日二次触发不再重复', async () => {
    const { svc, appConfig } = makeService();
    await svc.maybeDailyBackup();
    const after1 = svc.fs.readdirSync(appConfig.backupDir).filter((f) => f.startsWith('workbench_daily-') && f.endsWith('.db')).length;
    expect(after1).toBe(1);
    await svc.maybeDailyBackup();
    const after2 = svc.fs.readdirSync(appConfig.backupDir).filter((f) => f.startsWith('workbench_daily-') && f.endsWith('.db')).length;
    expect(after2).toBe(1);
  });
});

describe('BackupService - 保留 30 份策略', () => {
  it('35 份每日备份清理后剩 30，手动备份不受影响', async () => {
    const { svc, appConfig } = makeService();
    for (let i = 0; i < 35; i++) await svc.createDailyBackup();
    await svc.createManualBackup('重要');
    const removed = svc.pruneDailyBackups(30);
    expect(removed).toBe(5);
    const daily = svc.fs.readdirSync(appConfig.backupDir).filter((f) => f.startsWith('workbench_daily-') && f.endsWith('.db')).length;
    const manual = svc.fs.readdirSync(appConfig.backupDir).filter((f) => f.startsWith('workbench_manual-') && f.endsWith('.db')).length;
    expect(daily).toBe(30);
    expect(manual).toBe(1);
  });
});

describe('BackupService - 恢复前安全快照', () => {
  it('恢复后存在 pre-restore 快照且内容等于恢复前主库', async () => {
    const { svc, fs, appConfig } = makeService();
    const info = await svc.createManualBackup('restore-src');
    // 覆盖备份内容
    fs.writeFileSync(path.join(appConfig.backupDir, info.fileName),
      Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.from('BACKUP_CONTENT')]));
    // 修改主库内容
    fs.writeFileSync(appConfig.dbPath, Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.from('MAIN_BEFORE')]));
    const mainBefore = Buffer.from(fs.readFileSync(appConfig.dbPath));
    await svc.restoreBackup(info.fileName);
    const snap = fs.readdirSync(appConfig.backupDir).find((f) => f.startsWith('workbench_pre-restore-') && f.endsWith('.db'));
    expect(snap).toBeTruthy();
    expect(Buffer.from(fs.readFileSync(path.join(appConfig.backupDir, snap)))).toEqual(mainBefore);
    // 主库已被备份内容覆盖
    expect(fs.readFileSync(appConfig.dbPath)).toContain('BACKUP_CONTENT');
  });
});

describe('BackupService - 损坏文件拒绝', () => {
  it('损坏 SQLite 拒绝覆盖，主库内容不变', async () => {
    const { svc, fs, appConfig } = makeService();
    await svc.createManualBackup('good');
    // 构造损坏备份
    const bad = 'workbench_corrupt.db';
    fs.writeFileSync(path.join(appConfig.backupDir, bad), Buffer.from('this is not sqlite'));
    const mainBefore = Buffer.from(fs.readFileSync(appConfig.dbPath));
    await expect(svc.restoreBackup(bad)).rejects.toThrow();
    expect(Buffer.from(fs.readFileSync(appConfig.dbPath))).toEqual(mainBefore);
  });
});

describe('BackupService - 版本过高拒绝', () => {
  it('备份版本 > 当前版本拒绝覆盖，主库不变', async () => {
    const { svc, fs, appConfig } = makeService();
    const info = await svc.createManualBackup('old');
    // 篡改 meta 为更高版本
    const metaPath = path.join(appConfig.backupDir, info.fileName.replace(/\.db$/, '.meta.json'));
    fs.writeFileSync(metaPath, JSON.stringify({ schemaVersion: 999 }));
    const mainBefore = Buffer.from(fs.readFileSync(appConfig.dbPath));
    await expect(svc.restoreBackup(info.fileName)).rejects.toThrow();
    expect(Buffer.from(fs.readFileSync(appConfig.dbPath))).toEqual(mainBefore);
  });
});

describe('BackupService - 手动备份命名', () => {
  it('带备注 / 不带备注命名正确', async () => {
    const { svc } = makeService();
    const withNote = await svc.createManualBackup('项目数据');
    const noNote = await svc.createManualBackup();
    expect(withNote.fileName).toContain('项目数据');
    expect(withNote.fileName.startsWith('workbench_manual-')).toBe(true);
    expect(noNote.fileName.startsWith('workbench_manual-')).toBe(true);
  });
});

describe('BackupService - 失败状态', () => {
  it('模拟磁盘满时状态点为 error', async () => {
    const { svc } = makeService({ failCopy: true });
    await expect(svc.createManualBackup('x')).rejects.toThrow();
    expect(svc.getStatus().status).toBe('error');
  });
});

/**
 * 备份静态加密测试（V2-3 配套）
 *
 * 覆盖「启用数据库加密后，本地备份必须同样落密文」这条自洽性要求。
 * 未启用加密（不注入主密码）时行为必须与旧版完全一致，由 backup.test.js 守住；
 * 本文件重点守住新引入的加密路径与其失败模式。
 *
 * 说明：mock fs 的 readFileSync 返回 Buffer（与真实 fs 一致）。
 * 备份服务走「注入 fs 读 → 内存加解密 → 注入 fs 写」，因此加密路径可完整 mock，
 * 不触碰真实文件系统，也不依赖 scrypt 之外的任何东西。
 */
import { describe, it, expect, afterAll } from 'vitest';
import path from 'path';
import realFs from 'node:fs';
import os from 'node:os';
import { createBackupService } from './backup.service.js';
import { Observable } from '../../lib/observable.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { ErrorCodes } from '../../common/constants/index.js';

const SQLITE_MAGIC = 'SQLite format 3\0';
const PASS = 'correct horse battery staple';

/** 二进制安全的内存 fs：readFileSync 返回 Buffer（区别于 backup.test.js 的文本 mock） */
function createBinaryMockFs(opts = {}) {
  const store = new Map();
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
      return Buffer.from(b);
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

const MAIN_DB = Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.from('MAIN_DATA')]);

function makeService({ passphrase = PASS, mainDb = MAIN_DB } = {}) {
  const fs = createBinaryMockFs();
  const appConfig = { dbPath: '/data/workbench.db', backupDir: '/backups' };
  fs.writeFileSync(appConfig.dbPath, mainDb);
  const svc = createBackupService({
    fs,
    path,
    appConfig,
    clock: () => new Date('2026-09-13T10:00:00'),
    eventBus: new Observable(),
  });
  if (passphrase) svc.setPassphrase(passphrase);
  return { svc, fs, appConfig };
}

const filesOf = (fs, dir) => fs.readdirSync(dir);
const plainDbs = (fs, dir) => filesOf(fs, dir).filter((f) => f.endsWith('.db') && !f.startsWith('.'));

describe('备份加密 · 产物形态', () => {
  it('注入主密码后产物是 .db.enc，且备份目录不留任何明文库', async () => {
    const { svc, fs, appConfig } = makeService();
    const info = await svc.createManualBackup('加密');
    expect(info.fileName.endsWith('.db.enc')).toBe(true);
    expect(info.encrypted).toBe(true);
    // 明文副本只是加密过程中的临时物，必须已被清理
    expect(plainDbs(fs, appConfig.backupDir)).toEqual([]);
    expect(filesOf(fs, appConfig.backupDir).filter((f) => f.startsWith('.tmp-'))).toEqual([]);
  });

  it('密文用同一口令可解密回与源库完全一致的字节', async () => {
    const { svc, fs, appConfig } = makeService();
    const info = await svc.createDailyBackup();
    const envelope = fs.readFileSync(path.join(appConfig.backupDir, info.fileName));
    expect(envelope.subarray(0, 4).toString('ascii')).toBe('HTD1'); // 信封魔数
    expect(decrypt(envelope, PASS)).toEqual(MAIN_DB);
  });

  it('未注入主密码时产物仍是明文 .db（零回归，与旧行为一致）', async () => {
    const { svc, fs, appConfig } = makeService({ passphrase: '' });
    const info = await svc.createManualBackup('明文');
    expect(info.fileName.endsWith('.db')).toBe(true);
    expect(info.fileName.endsWith('.enc')).toBe(false);
    expect(info.encrypted).toBe(false);
    expect(fs.readFileSync(path.join(appConfig.backupDir, info.fileName))).toEqual(MAIN_DB);
  });

  it('meta 记录 encrypted，列表接口可据此展示', async () => {
    const { svc, appConfig } = makeService();
    const info = await svc.createManualBackup('标记');
    const meta = JSON.parse(
      svc.fs.readFileSync(path.join(appConfig.backupDir, info.fileName.replace(/\.db\.enc$/, '.meta.json'))).toString('utf8'),
    );
    expect(meta.encrypted).toBe(true);
    const list = await svc.listBackups();
    expect(list).toHaveLength(1);
    expect(list[0].encrypted).toBe(true);
  });
});

describe('备份加密 · 每日节奏与清理', () => {
  it('isDailyToday 认 .db.enc，加密模式下不会重复备份', async () => {
    const { svc } = makeService();
    await svc.maybeDailyBackup();
    expect(svc.isDailyToday()).toBe(true);
    await svc.maybeDailyBackup();
    // 只数备份本体，不数配套 meta（meta 同样以 workbench_daily- 开头）
    const daily = filesOf(svc.fs, '/backups').filter((f) => f.startsWith('workbench_daily-') && f.endsWith('.db.enc'));
    expect(daily).toHaveLength(1);
  });

  it('保留策略能清理 .db.enc 与配套 meta', async () => {
    const { svc, appConfig } = makeService();
    for (let i = 0; i < 5; i++) {
      await svc.createDailyBackup();
    }
    const removed = svc.pruneDailyBackups(2);
    expect(removed).toBe(3);
    const left = filesOf(svc.fs, appConfig.backupDir);
    expect(left.filter((f) => f.endsWith('.db.enc'))).toHaveLength(2);
    // meta 必须同步清理，否则目录会积累孤儿 json
    expect(left.filter((f) => f.endsWith('.meta.json'))).toHaveLength(2);
  });
});

describe('备份加密 · 恢复路径', () => {
  it('恢复密文备份：主库还原为备份内容，过程不落明文', async () => {
    const { svc, fs, appConfig } = makeService();
    const info = await svc.createManualBackup('可恢复');
    // 改动主库，确认恢复后被覆盖
    fs.writeFileSync(appConfig.dbPath, Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.from('DIRTY')]));

    const res = await svc.restoreBackup(info.fileName);
    expect(res.encrypted).toBe(true);
    expect(fs.readFileSync(appConfig.dbPath)).toEqual(MAIN_DB);
    // 解密用的临时明文必须已清理
    expect(filesOf(fs, appConfig.backupDir).filter((f) => f.startsWith('.tmp-'))).toEqual([]);
  });

  it('恢复前安全快照在加密模式下同样是密文（目录内无明文）', async () => {
    const { svc, fs, appConfig } = makeService();
    const info = await svc.createManualBackup('快照');
    fs.writeFileSync(appConfig.dbPath, Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.from('BEFORE')]));
    const before = Buffer.from(fs.readFileSync(appConfig.dbPath));

    const res = await svc.restoreBackup(info.fileName);
    expect(res.snapshot.endsWith('.db.enc')).toBe(true);
    expect(plainDbs(fs, appConfig.backupDir)).toEqual([]);
    // 快照解密后应等于恢复前的主库
    const snap = fs.readFileSync(path.join(appConfig.backupDir, res.snapshot));
    expect(decrypt(snap, PASS)).toEqual(before);
  });

  it('无主密码时恢复密文备份：显式报错且主库分毫不动', async () => {
    const { svc, fs, appConfig } = makeService();
    const info = await svc.createManualBackup('无密码');
    fs.writeFileSync(appConfig.dbPath, Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.from('KEEP')]));
    const before = Buffer.from(fs.readFileSync(appConfig.dbPath));

    svc.setPassphrase(''); // 模拟未启用加密的进程拿到一份密文备份
    await expect(svc.restoreBackup(info.fileName)).rejects.toMatchObject({
      code: ErrorCodes.BACKUP_PASSPHRASE_REQUIRED,
    });
    expect(fs.readFileSync(appConfig.dbPath)).toEqual(before);
  });

  it('口令错误：报解密失败且主库不动（绝不拿密文覆盖主库）', async () => {
    const { svc, fs, appConfig } = makeService();
    const info = await svc.createManualBackup('错口令');
    fs.writeFileSync(appConfig.dbPath, Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.from('KEEP')]));
    const before = Buffer.from(fs.readFileSync(appConfig.dbPath));

    svc.setPassphrase('wrong-passphrase');
    await expect(svc.restoreBackup(info.fileName)).rejects.toMatchObject({
      code: ErrorCodes.BACKUP_DECRYPT_FAILED,
    });
    expect(fs.readFileSync(appConfig.dbPath)).toEqual(before);
  });

  it('信封内是损坏库时拒绝恢复（加密不掩盖损坏，解密后仍需过魔数校验）', async () => {
    const { svc, fs, appConfig } = makeService();
    const badName = 'workbench_manual-损坏内容-20260913_100000.db.enc';
    fs.writeFileSync(path.join(appConfig.backupDir, badName), encrypt(Buffer.from('not a sqlite file'), PASS));
    const before = Buffer.from(fs.readFileSync(appConfig.dbPath));

    await expect(svc.restoreBackup(badName)).rejects.toMatchObject({ code: ErrorCodes.BACKUP_CORRUPTED });
    expect(fs.readFileSync(appConfig.dbPath)).toEqual(before);
  });

  it('主库损坏时仍能恢复：快照不因校验失败而阻断自救', async () => {
    const { svc, fs, appConfig } = makeService();
    const info = await svc.createManualBackup('自救');
    // 主库头损坏：这正是用户最需要恢复的时刻
    fs.writeFileSync(appConfig.dbPath, Buffer.from('BROKEN-MAIN-DB'));

    const res = await svc.restoreBackup(info.fileName);
    expect(res.fileName).toBe(info.fileName);
    expect(fs.readFileSync(appConfig.dbPath)).toEqual(MAIN_DB);
  });
});

describe('备份加密 · 边界', () => {
  it('源库非 SQLite 时中止备份，不产出信封', async () => {
    const broken = Buffer.from('BROKEN-MAIN-DB');
    const { svc, fs, appConfig } = makeService({ mainDb: broken });
    await expect(svc.createManualBackup('坏库')).rejects.toMatchObject({ code: ErrorCodes.BACKUP_CORRUPTED });
    // 失败后不得留下任何备份产物
    expect(filesOf(fs, appConfig.backupDir).filter((f) => f.endsWith('.db.enc'))).toEqual([]);
  });

  it('文件名安全校验同时放行 .db 与 .db.enc，仍拒绝路径穿越', async () => {
    const { svc } = makeService();
    await expect(svc.restoreBackup('../evil.db.enc')).rejects.toThrow();
    await expect(svc.restoreBackup('workbench_x.db.exe')).rejects.toThrow();
  });
});

/**
 * 真实文件系统冒烟：mock fs 无法覆盖「真实 fs + 真实加密」的组合路径
 * （例如路径拼接、二进制读写、临时文件删除是否真的生效）。
 * 只跑最关键的两条：产物是密文、以及能恢复回来。
 */
describe('备份加密 · 真实文件系统冒烟', () => {
  let roots = [];

  function makeRealRoot() {
    const root = realFs.mkdtempSync(path.join(os.tmpdir(), 'htd-bkenc-'));
    roots.push(root);
    const dbDir = path.join(root, 'data');
    const backupDir = path.join(root, 'backups');
    realFs.mkdirSync(dbDir, { recursive: true });
    realFs.mkdirSync(backupDir, { recursive: true });
    return { root, dbDir, backupDir };
  }

  afterAll(() => {
    for (const r of roots) realFs.rmSync(r, { recursive: true, force: true });
    roots = [];
  });

  it('真实磁盘上产物为 .db.enc，目录内无明文、无临时残留', async () => {
    const { dbDir, backupDir } = makeRealRoot();
    const dbPath = path.join(dbDir, 'workbench.db');
    const mainDb = Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.alloc(2048, 7)]);
    realFs.writeFileSync(dbPath, mainDb);

    const svc = createBackupService({
      appConfig: { dbPath, backupDir },
      clock: () => new Date('2026-09-13T11:00:00'),
      eventBus: new Observable(),
    });
    svc.setPassphrase(PASS);
    const info = await svc.createManualBackup('真实');

    const left = realFs.readdirSync(backupDir);
    expect(info.fileName.endsWith('.db.enc')).toBe(true);
    expect(left.filter((f) => f.endsWith('.db'))).toEqual([]);
    expect(left.filter((f) => f.startsWith('.tmp-'))).toEqual([]);
    expect(decrypt(realFs.readFileSync(path.join(backupDir, info.fileName)), PASS).equals(mainDb)).toBe(true);
  });

  it('真实磁盘上恢复密文备份后主库字节完全一致', async () => {
    const { dbDir, backupDir } = makeRealRoot();
    const dbPath = path.join(dbDir, 'workbench.db');
    const mainDb = Buffer.concat([Buffer.from(SQLITE_MAGIC, 'latin1'), Buffer.alloc(1024, 3)]);
    realFs.writeFileSync(dbPath, mainDb);

    const svc = createBackupService({
      appConfig: { dbPath, backupDir },
      clock: () => new Date('2026-09-13T12:00:00'),
      eventBus: new Observable(),
    });
    svc.setPassphrase(PASS);
    const info = await svc.createManualBackup('真实恢复');

    // 弄脏主库再恢复
    realFs.writeFileSync(dbPath, Buffer.from('DIRTY-DIRTY-DIRTY'));
    await svc.restoreBackup(info.fileName);
    expect(realFs.readFileSync(dbPath).equals(mainDb)).toBe(true);
    // 恢复过程不得留下解密临时文件
    expect(realFs.readdirSync(backupDir).filter((f) => f.startsWith('.tmp-'))).toEqual([]);
  });
});

/**
 * V2-2 异地备份服务测试
 *
 * 覆盖重点：
 *  1. 默认关闭（零行为变化）——这是不改坏既有测试的前提
 *  2. 上传前魔数校验——损坏备份绝不能覆盖远端好备份（最危险的失败模式）
 *  3. local / webdav 两个适配器的上传、列举、清理（webdav 走真实 HTTP mock）
 *  4. 清理只碰 workbench_daily-*，手动备份永久保留
 *  5. 状态接口不泄露凭据
 *  6. 与 V2-3 加密协同：启用加密后上传的必须是密文副本
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRemoteBackupService } from './remote-backup.service.js';
import { decryptFile } from '../../lib/crypto.js';

const MAGIC = 'SQLite format 3\0';
let tmpRoots = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'htd-remote-'));
  tmpRoots.push(root);
  const backupDir = path.join(root, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  return { root, backupDir };
}

function writeBackup(dir, name, magic = MAGIC) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, Buffer.concat([Buffer.from(magic, 'latin1'), Buffer.alloc(64, 0)]));
  return p;
}

function cfgOf(backupDir, dataRoot, remoteCfg) {
  return {
    dataRoot,
    backupDir,
    remoteBackup: {
      target: '', dir: 'htd-backups', keep: 30, url: '', user: '', pass: '', path: '',
      ...remoteCfg,
    },
  };
}

afterEach(() => {
  for (const r of tmpRoots) fs.rmSync(r, { recursive: true, force: true });
  tmpRoots = [];
});

describe('remote-backup · 默认关闭', () => {
  it('未配置 target 时不启用，上传/同步均跳过且不发任何请求', async () => {
    const { root, backupDir } = makeRoot();
    writeBackup(backupDir, 'workbench_daily-20260913_010000.db');
    const svc = createRemoteBackupService({
      appConfig: cfgOf(backupDir, root, {}),
      fetchImpl: () => { throw new Error('不该发起任何网络请求'); },
    });

    expect(svc.isEnabled()).toBe(false);
    await expect(svc.uploadLatest()).resolves.toEqual({ skipped: true, reason: 'disabled' });
    await expect(svc.maybeSync()).resolves.toEqual({ skipped: true, reason: 'disabled' });
  });

  it('未知 target 报配置错误而不是静默成功', async () => {
    const { root, backupDir } = makeRoot();
    writeBackup(backupDir, 'workbench_daily-20260913_010000.db');
    const svc = createRemoteBackupService({
      appConfig: cfgOf(backupDir, root, { target: 's3' }),
    });
    // 配置意图存在即视为启用——错误配置必须暴露，不能退化成静默跳过
    expect(svc.isEnabled()).toBe(true);
    await expect(svc.uploadLatest()).rejects.toThrow(/不支持的异地备份目标/);
  });

  it('getStatus 不返回 url / user / pass', () => {
    const { root, backupDir } = makeRoot();
    const svc = createRemoteBackupService({
      appConfig: cfgOf(backupDir, root, {
        target: 'webdav', url: 'https://dav.example.com/dav/', user: 'u', pass: 'secret-pw',
      }),
    });
    const status = svc.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.target).toBe('webdav');
    const dumped = JSON.stringify(status);
    expect(dumped).not.toContain('secret-pw');
    expect(dumped).not.toContain('dav.example.com');
  });
});

describe('remote-backup · local 适配器', () => {
  let root; let backupDir; let remotePath; let svc;

  beforeEach(() => {
    const r = makeRoot();
    root = r.root; backupDir = r.backupDir;
    remotePath = path.join(root, 'remote');
    svc = createRemoteBackupService({
      appConfig: cfgOf(backupDir, root, { target: 'local', path: remotePath, keep: 2 }),
    });
  });

  it('上传最新一份备份到远端目录（文件名与本地同名）', async () => {
    writeBackup(backupDir, 'workbench_daily-20260912_010000.db');
    writeBackup(backupDir, 'workbench_daily-20260913_010000.db');
    const res = await svc.uploadLatest();
    expect(res.uploaded).toBe('workbench_daily-20260913_010000.db');
    expect(fs.existsSync(path.join(remotePath, 'htd-backups', res.uploaded))).toBe(true);
  });

  it('本地备份损坏时拒绝上传，且远端不产生文件', async () => {
    writeBackup(backupDir, 'workbench_daily-20260913_010000.db', 'NOTSQLITE FILE 000');
    await expect(svc.uploadLatest()).rejects.toThrow(/跳过异地上传/);
    expect(fs.existsSync(path.join(remotePath, 'htd-backups'))).toBe(false);
    expect(svc.getStatus().state).toBe('error');
  });

  it('清理只删 workbench_daily-*，手动备份永久保留', async () => {
    const dir = path.join(remotePath, 'htd-backups');
    fs.mkdirSync(dir, { recursive: true });
    for (const n of [
      'workbench_daily-20260910_010000.db',
      'workbench_daily-20260911_010000.db',
      'workbench_daily-20260912_010000.db',
      'workbench_daily-20260913_010000.db',
      'workbench_manual-重要节点.db',
      'someone-elses-file.db',
    ]) fs.writeFileSync(path.join(dir, n), 'x');

    const res = await svc.pruneRemote(2);
    expect(res.removed.sort()).toEqual([
      'workbench_daily-20260910_010000.db',
      'workbench_daily-20260911_010000.db',
    ]);
    expect(fs.existsSync(path.join(dir, 'workbench_manual-重要节点.db'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'someone-elses-file.db'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'workbench_daily-20260913_010000.db'))).toBe(true);
  });

  it('maybeSync 每天只同步一次', async () => {
    writeBackup(backupDir, 'workbench_daily-20260913_010000.db');
    const first = await svc.maybeSync();
    expect(first.uploaded).toBe('workbench_daily-20260913_010000.db');
    const second = await svc.maybeSync();
    expect(second).toEqual({ skipped: true, reason: 'already-synced-today' });
  });

  it('syncLatest 上传后顺带清理，超过保留份数的被删除', async () => {
    writeBackup(backupDir, 'workbench_daily-20260913_010000.db');
    const dir = path.join(remotePath, 'htd-backups');
    fs.mkdirSync(dir, { recursive: true });
    for (let d = 1; d <= 5; d += 1) {
      fs.writeFileSync(path.join(dir, `workbench_daily-2026090${d}_010000.db`), 'x');
    }
    const res = await svc.syncLatest();
    expect(res.uploaded).toBe('workbench_daily-20260913_010000.db');
    // keep=2 → 远端 6 份 daily 中保留最新 2 份
    const left = fs.readdirSync(dir).filter((f) => f.startsWith('workbench_daily-'));
    expect(left).toHaveLength(2);
  });
});

describe('remote-backup · webdav 适配器（真实 HTTP mock）', () => {
  let server; let baseUrl; let store; let requests;

  beforeEach(async () => {
    store = new Map();
    requests = [];
    server = http.createServer((req, res) => {
      const name = decodeURIComponent(req.url.split('/').pop());
      requests.push(`${req.method} ${req.url}`);
      if (req.method === 'PUT') {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          store.set(name, Buffer.concat(chunks));
          res.writeHead(201); res.end();
        });
        return;
      }
      if (req.method === 'PROPFIND') {
        const hrefs = [...store.keys()]
          .map((n) => `<d:href>/dav/htd-backups/${encodeURIComponent(n)}</d:href>`)
          .join('');
        res.writeHead(207, { 'Content-Type': 'application/xml' });
        res.end(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${hrefs}</d:multistatus>`);
        return;
      }
      if (req.method === 'DELETE') {
        if (!store.has(name)) { res.writeHead(404); res.end(); return; }
        store.delete(name); res.writeHead(204); res.end();
        return;
      }
      res.writeHead(405); res.end();
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${server.address().port}/dav/`;
  });

  afterEach(async () => {
    await new Promise((r) => server.close(r));
  });

  it('PUT 上传 + PROPFIND 列举 + DELETE 清理', async () => {
    const { root, backupDir } = makeRoot();
    writeBackup(backupDir, 'workbench_daily-20260913_010000.db');
    const svc = createRemoteBackupService({
      appConfig: cfgOf(backupDir, root, {
        target: 'webdav', url: baseUrl, user: 'u', pass: 'p', keep: 1,
      }),
    });

    const up = await svc.uploadLatest();
    expect(up.uploaded).toBe('workbench_daily-20260913_010000.db');
    expect(store.has('workbench_daily-20260913_010000.db')).toBe(true);
    expect(requests.some((r) => r.startsWith('PUT'))).toBe(true);

    const listed = await svc.check();
    expect(listed.ok).toBe(true);

    // 再放两个更旧的 daily，keep=1 应只留最新
    store.set('workbench_daily-20260911_010000.db', Buffer.from('x'));
    store.set('workbench_daily-20260912_010000.db', Buffer.from('x'));
    const pruned = await svc.pruneRemote(1);
    expect(pruned.removed.sort()).toEqual([
      'workbench_daily-20260911_010000.db',
      'workbench_daily-20260912_010000.db',
    ]);
    expect(store.has('workbench_daily-20260913_010000.db')).toBe(true);
  });

  it('服务端返回 5xx 时上传失败且不吞掉错误', async () => {
    const { root, backupDir } = makeRoot();
    writeBackup(backupDir, 'workbench_daily-20260913_010000.db');
    await new Promise((r) => server.close(r));
    server = http.createServer((_req, res) => { res.writeHead(500); res.end(); });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const badUrl = `http://127.0.0.1:${server.address().port}/dav/`;

    const svc = createRemoteBackupService({
      appConfig: cfgOf(backupDir, root, { target: 'webdav', url: badUrl, user: 'u', pass: 'p' }),
    });
    await expect(svc.uploadLatest()).rejects.toThrow(/HTTP 500/);
    expect(svc.getStatus().state).toBe('error');
  });

  it('maybeSyncFireAndForget 失败不外泄（不抛、只记状态）', async () => {
    const { root, backupDir } = makeRoot();
    writeBackup(backupDir, 'workbench_daily-20260913_010000.db');
    const svc = createRemoteBackupService({
      appConfig: cfgOf(backupDir, root, { target: 'webdav', url: 'http://127.0.0.1:1/dav/' }),
    });
    expect(() => svc.maybeSyncFireAndForget()).not.toThrow();
    await new Promise((r) => setTimeout(r, 200));
    expect(svc.getStatus().state).toBe('error');
  });
});

describe('remote-backup · 与 V2-3 加密协同', () => {
  it('注入主密码后上传密文副本：远端不含明文，且可解密回原库', async () => {
    const { root, backupDir } = makeRoot();
    const plain = writeBackup(backupDir, 'workbench_daily-20260913_010000.db');
    const remotePath = path.join(root, 'remote');
    const svc = createRemoteBackupService({
      appConfig: cfgOf(backupDir, root, { target: 'local', path: remotePath }),
    });
    svc.setPassphrase('master-pw-2026');

    const res = await svc.uploadLatest();
    expect(res.encrypted).toBe(true);
    expect(res.uploaded).toBe('workbench_daily-20260913_010000.db.enc');

    const dir = path.join(remotePath, 'htd-backups');
    // 远端不得出现明文库
    expect(fs.existsSync(path.join(dir, 'workbench_daily-20260913_010000.db'))).toBe(false);
    // 远端内容不得包含 SQLite 魔数（否则等于明文外泄）
    const uploaded = fs.readFileSync(path.join(dir, res.uploaded));
    expect(uploaded.toString('latin1')).not.toContain('SQLite format 3');

    // 用主密码可解密回与本地一致的库
    const out = path.join(root, 'decrypted.db');
    decryptFile(path.join(dir, res.uploaded), out, 'master-pw-2026');
    expect(fs.readFileSync(out).equals(fs.readFileSync(plain))).toBe(true);
  });

  it('加密副本是临时文件，上传后必须清理（不在磁盘留第二份）', async () => {
    const { root, backupDir } = makeRoot();
    writeBackup(backupDir, 'workbench_daily-20260913_010000.db');
    const remotePath = path.join(root, 'remote');
    const svc = createRemoteBackupService({
      appConfig: cfgOf(backupDir, root, { target: 'local', path: remotePath }),
    });
    svc.setPassphrase('pw');
    await svc.uploadLatest();
    const leftovers = fs.readdirSync(root).filter((f) => f.startsWith('.remote-upload-'));
    expect(leftovers).toEqual([]);
  });

  it('状态接口回显 encrypted，便于确认「异地是密文」', () => {
    const { root, backupDir } = makeRoot();
    const svc = createRemoteBackupService({
      appConfig: cfgOf(backupDir, root, { target: 'local', path: path.join(root, 'r') }),
    });
    expect(svc.getStatus().encrypted).toBe(false);
    svc.setPassphrase('pw');
    expect(svc.getStatus().encrypted).toBe(true);
  });
});

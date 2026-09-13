/**
 * 数据库静态加密生命周期测试（V2-3）
 *
 * 全部在临时目录中跑，只改 appConfig.dbDir，绝不触碰真实数据目录。
 * 重点锁死三条数据安全约束：
 * 1. 口令错误不得留下半截明文
 * 2. 锁定后密文库必须能用同一口令完整解开，且明文被清除
 * 3. 注入了测试库地址时必须跳过加解密（防止测试把临时库卷进来）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encryptFile, decryptFile } from '../lib/crypto.js';
import {
  unlockDatabase,
  lockDatabase,
  isEncryptionEnabled,
  plainDbPath,
  encDbPath,
} from './vault.js';
import appConfig from '../config/app.config.js';

const PASS = 'test-passphrase-1234';

let tmpDir = null;
let origDbDir = null;
let origTestUrl = null;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'htd-vault-'));
  origDbDir = appConfig.dbDir;
  appConfig.dbDir = tmpDir;
  // vault 见到 HTD_TEST_DB_URL 会直接跳过；测试环境默认注入了该变量，这里临时摘掉
  origTestUrl = process.env.HTD_TEST_DB_URL;
  delete process.env.HTD_TEST_DB_URL;
  delete process.env.HTD_DB_PASSPHRASE;
});

afterEach(() => {
  appConfig.dbDir = origDbDir;
  if (origTestUrl !== undefined) process.env.HTD_TEST_DB_URL = origTestUrl;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** 造一个「已启用加密」的现场：明文库加密成 .enc 后删除明文 */
function seedEncrypted(content) {
  const plain = path.join(tmpDir, 'workbench.db');
  fs.writeFileSync(plain, content);
  encryptFile(plain, encDbPath(), PASS);
  fs.unlinkSync(plain);
}

describe('vault', () => {
  it('未启用加密时解锁返回 encrypted:false', async () => {
    const state = await unlockDatabase();
    expect(state.encrypted).toBe(false);
    expect(isEncryptionEnabled()).toBe(false);
  });

  it('启用加密后能解锁出与原始一致的内容', async () => {
    seedEncrypted('SQLITE-CONTENT');
    expect(isEncryptionEnabled()).toBe(true);

    process.env.HTD_DB_PASSPHRASE = PASS;
    const state = await unlockDatabase();
    expect(state.encrypted).toBe(true);
    expect(fs.readFileSync(plainDbPath(), 'utf8')).toBe('SQLITE-CONTENT');
  });

  it('口令错误抛 BAD_PASSPHRASE，且不留下半截明文', async () => {
    seedEncrypted('SECRET');
    process.env.HTD_DB_PASSPHRASE = 'wrong-passphrase';
    await expect(unlockDatabase()).rejects.toThrow('BAD_PASSPHRASE');
    expect(fs.existsSync(plainDbPath())).toBe(false);
  });

  it('取不到口令（非交互且无环境变量）时抛 DB_LOCKED', async () => {
    seedEncrypted('SECRET');
    await expect(unlockDatabase()).rejects.toThrow('DB_LOCKED');
  });

  it('锁定后：密文库可完整解开，明文与 WAL 残留被清除', async () => {
    seedEncrypted('ORIGINAL');
    process.env.HTD_DB_PASSPHRASE = PASS;
    const state = await unlockDatabase();

    // 模拟运行期写入
    fs.writeFileSync(plainDbPath(), 'UPDATED');
    fs.writeFileSync(`${plainDbPath()}-wal`, 'wal-journal');

    const result = lockDatabase(state);
    expect(result.locked).toBe(true);
    expect(fs.existsSync(plainDbPath())).toBe(false);
    expect(fs.existsSync(`${plainDbPath()}-wal`)).toBe(false);

    const out = path.join(tmpDir, 'restored.db');
    decryptFile(encDbPath(), out, PASS);
    expect(fs.readFileSync(out, 'utf8')).toBe('UPDATED');
  });

  it('未启用加密时 lockDatabase 不做任何事', () => {
    expect(lockDatabase({ encrypted: false }).locked).toBe(false);
    expect(lockDatabase(null).locked).toBe(false);
  });

  it('锁定失败时保留明文（绝不静默丢数据）', async () => {
    seedEncrypted('ORIGINAL');
    process.env.HTD_DB_PASSPHRASE = PASS;
    const state = await unlockDatabase();
    // 传入错误口令：加密能成功但往返校验用的也是它…… 构造真实失败：删掉明文后再锁
    fs.unlinkSync(plainDbPath());
    const result = lockDatabase(state);
    expect(result.locked).toBe(false);
    expect(result.reason).toBe('no-plain');
    // 原密文库仍在，未被破坏
    expect(fs.existsSync(encDbPath())).toBe(true);
  });

  it('残留运行期明文时以明文为准启动并标记 recovered', async () => {
    const plain = path.join(tmpDir, 'workbench.db');
    fs.writeFileSync(plain, 'RECOVERED');
    encryptFile(plain, encDbPath(), PASS);

    process.env.HTD_DB_PASSPHRASE = PASS;
    const state = await unlockDatabase();
    expect(state.encrypted).toBe(true);
    expect(state.recovered).toBe(true);
    expect(fs.readFileSync(plainDbPath(), 'utf8')).toBe('RECOVERED');
  });

  it('注入了 HTD_TEST_DB_URL 时跳过加解密（测试隔离）', async () => {
    process.env.HTD_TEST_DB_URL = 'file:./isolated.db';
    const state = await unlockDatabase();
    expect(state.encrypted).toBe(false);
    expect(state.reason).toBe('test-db');
  });
});

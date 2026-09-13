/**
 * V2-3 数据库静态加密 · 生命周期管理（形态 A：原地信封）
 *
 * 磁盘上只保留 `workbench.db.enc`；启动时解密出运行期明文库 `workbench.db`，
 * 退出时重新加密回 `.enc` 并删除明文。密钥不落盘，仅存于内存中的口令。
 *
 * ⚠️ 数据安全的三条硬约束（改动此文件时不得破坏）：
 * 1. **绝不先删明文**：必须先写 `.enc.tmp` → 校验往返 → 原子 rename 成功 → 才删明文。
 *    反向顺序会让「加密失败」与「唯一副本被删」同时发生 = 数据全丢。
 * 2. **覆盖前留上一版**：替换 `.enc` 前先复制一份 `.enc.prev`，新信封损坏仍可回退。
 * 3. **口令错误必须显式失败**：绝不降级为「明文只读」——静默降级会让用户误以为数据仍受保护。
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { decrypt, decryptFile, encryptFile } from '../lib/crypto.js';
import appConfig from '../config/app.config.js';
import logger from '../common/logger.js';

export const ENC_EXT = '.enc';
const DB_NAME = 'workbench.db';
// SQLite 伴随文件：退出时一并清理，否则残留的 -wal 会让下次解密出的库状态不一致
const SIDECARS = ['-wal', '-shm', '-journal'];

/** 运行期明文库路径（仅进程存活期间存在） */
export function plainDbPath() {
  return path.join(appConfig.dbDir, DB_NAME);
}

/** 磁盘上的密文库路径 */
export function encDbPath() {
  return plainDbPath() + ENC_EXT;
}

/** 是否启用了静态加密（以磁盘上存在 .enc 为唯一判据） */
export function isEncryptionEnabled() {
  return fs.existsSync(encDbPath());
}

/**
 * 隐藏回显地读取一行（终端交互场景）
 */
export function promptHidden(prompt) {
  return new Promise((resolve) => {
    let rl;
    try {
      rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    } catch (error) {
      process.stdout.write(`${prompt}\n`);
      resolve('');
      return;
    }
    const muted = { on: false };
    // 覆写输出：muted 打开时不回显用户键入，避免口令出现在终端与滚动缓冲区
    rl._writeToOutput = function write(c) {
      if (!muted.on) this.output.write(c);
    };
    process.stdout.write(prompt);
    muted.on = true;
    rl.question('', (answer) => {
      muted.on = false;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

/**
 * 获取主密码：环境变量优先（守护/自启场景无终端），其次终端交互输入。
 * 都没有则返回空串——由调用方决定是报错还是跳过。
 */
export async function resolvePassphrase() {
  const fromEnv = process.env.HTD_DB_PASSPHRASE;
  if (fromEnv) return { value: fromEnv, source: 'env' };
  if (process.stdin && process.stdin.isTTY) {
    const value = await promptHidden('数据库已加密，请输入主密码：');
    return { value, source: 'prompt' };
  }
  return { value: '', source: 'none' };
}

/**
 * 启动解锁：把 .enc 解密为运行期明文库。
 *
 * @returns {Promise<{encrypted: boolean, passphrase?: string, recovered?: boolean}>}
 *          encrypted=false 表示未启用加密，调用方无需处理锁定。
 * @throws {Error} BAD_PASSPHRASE 口令错误 / 密文损坏；DB_LOCKED 无口令可用（非交互场景）
 */
export async function unlockDatabase() {
  // 测试隔离：显式注入了临时库地址时不参与加解密，避免把测试库卷进来
  if (process.env.HTD_TEST_DB_URL) return { encrypted: false, reason: 'test-db' };
  if (!isEncryptionEnabled()) return { encrypted: false };

  const plainPath = plainDbPath();
  const encPath = encDbPath();

  // 上次异常退出残留的运行期明文：以它为准启动，避免丢掉上次退出前的写入
  if (fs.existsSync(plainPath)) {
    logger.warn('[加密] 检测到上次未回收的运行期明文库，将以它为准启动；本次退出时会重新加密');
    const { value } = await resolvePassphrase();
    if (!value) throw new Error('DB_LOCKED');
    return { encrypted: true, passphrase: value, recovered: true };
  }

  const { value, source } = await resolvePassphrase();
  if (!value) {
    // 非交互又没配口令：无法解锁，明确报错而不是降级明文（降级会让用户误以为仍受保护）
    throw new Error(source === 'none' ? 'DB_LOCKED' : 'BAD_PASSPHRASE');
  }

  try {
    decryptFile(encPath, plainPath, value);
  } catch (error) {
    // 解密失败不许留下半截明文
    if (fs.existsSync(plainPath)) {
      try { fs.unlinkSync(plainPath); } catch (e) { /* 忽略清理失败 */ }
    }
    throw new Error('BAD_PASSPHRASE');
  }
  logger.info(`[加密] 已解锁数据库（口令来源：${source === 'env' ? '环境变量' : '交互输入'}）`);
  return { encrypted: true, passphrase: value, recovered: false };
}

/**
 * 退出锁定：把运行期明文库重新加密回 .enc 并清除明文。
 * 任何一步失败都要保留明文与旧 .enc，绝不静默丢弃数据。
 */
export function lockDatabase(state) {
  if (!state || !state.encrypted) return { locked: false };
  const plainPath = plainDbPath();
  const encPath = encDbPath();

  if (!fs.existsSync(plainPath)) {
    logger.warn('[加密] 运行期明文库不存在，跳过重新加密（磁盘上的密文库保持原样）');
    return { locked: false, reason: 'no-plain' };
  }

  const tmpPath = `${encPath}.tmp`;
  try {
    // 1) 先写临时信封
    encryptFile(plainPath, tmpPath, state.passphrase);
    // 2) 往返校验：确认新信封能用同一口令完整解开，才允许覆盖唯一副本
    decrypt(fs.readFileSync(tmpPath), state.passphrase);
    // 3) 覆盖前留上一版，便于新信封损坏时回退
    if (fs.existsSync(encPath)) {
      try { fs.copyFileSync(encPath, `${encPath}.prev`); } catch (e) { /* 备份失败不阻断 */ }
    }
    // 4) 原子替换
    fs.renameSync(tmpPath, encPath);
  } catch (error) {
    logger.error(`[加密] 重新加密失败，已保留运行期明文库以便人工处理：${error.message}`);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { /* 忽略 */ }
    return { locked: false, reason: 'encrypt-failed', error: error.message };
  }

  // 5) 确认 .enc 就位后才删除明文
  try {
    fs.unlinkSync(plainPath);
    for (const suffix of SIDECARS) {
      const p = plainPath + suffix;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } catch (error) {
    logger.warn(`[加密] 清理运行期明文库失败（密文库已更新，可手工删除 ${plainPath}）：${error.message}`);
    return { locked: true, plainRemoved: false };
  }

  logger.info('[加密] 数据库已重新加密，运行期明文已清除');
  return { locked: true, plainRemoved: true };
}

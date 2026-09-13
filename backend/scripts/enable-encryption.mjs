#!/usr/bin/env node
/**
 * V2-3 数据库静态加密开关（形态 A：原地信封）
 *
 *   node backend/scripts/enable-encryption.mjs                # 启用（交互设置主密码）
 *   node backend/scripts/enable-encryption.mjs --password xxx # 非交互（口令会进 shell 历史，慎用）
 *   node backend/scripts/enable-encryption.mjs --verify       # 校验口令能否解开
 *   node backend/scripts/enable-encryption.mjs --disable      # 回滚为明文库
 *
 * 与 vault.js 一致的三条数据安全约束：
 * 1. 加密前必定先备份明文库为 `workbench.db.bak-<时间戳>`
 * 2. 先写 `.enc.tmp` → 往返校验 → 原子 rename → 才删明文（绝不先删明文）
 * 3. 覆盖已有 `.enc` 前留一份 `.enc.prev`
 *
 * 红线（项目约束 #22）：本脚本只做文件级加解密，不做任何 schema 变更，
 * 绝不执行 `prisma db push --accept-data-loss`。
 */
import fs from 'node:fs';
import path from 'node:path';
import { encryptFile, decrypt, decryptFile } from '../src/lib/crypto.js';
import { promptHidden } from '../src/database/vault.js';
import appConfig from '../src/config/app.config.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const dbPath = appConfig.dbPath;
const dbDir = path.dirname(dbPath);
const encPath = `${dbPath}.enc`;
const SIDECARS = ['-wal', '-shm', '-journal'];
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

async function askPassword(needConfirm) {
  const fromArgs = value('--password');
  if (fromArgs) return fromArgs;
  if (process.env.HTD_DB_PASSPHRASE) return process.env.HTD_DB_PASSPHRASE;
  if (!process.stdin.isTTY) {
    console.error('非交互环境：请用 --password 或环境变量 HTD_DB_PASSPHRASE 提供主密码');
    process.exit(1);
  }
  const first = await promptHidden('请设置数据库主密码（遗忘将无法恢复，务必先备份）：');
  if (first.length < 8) {
    console.error('主密码至少 8 位');
    process.exit(1);
  }
  if (needConfirm) {
    const second = await promptHidden('请再输入一次：');
    if (first !== second) {
      console.error('两次输入不一致');
      process.exit(1);
    }
  }
  return first;
}

function removeSidecars(base) {
  for (const suffix of SIDECARS) {
    const p = base + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

async function enable() {
  if (fs.existsSync(encPath) && !flag('--force')) {
    console.error(`已启用加密（存在 ${encPath}）。如需重设请先 --disable，或加 --force 覆盖。`);
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`未找到明文库：${dbPath}`);
    process.exit(1);
  }

  const password = await askPassword(true);

  const backup = path.join(dbDir, `workbench.db.bak-${stamp()}`);
  fs.copyFileSync(dbPath, backup);
  console.log(`1/4 已备份明文库 → ${backup}`);

  const tmp = `${encPath}.tmp`;
  encryptFile(dbPath, tmp, password);
  decrypt(fs.readFileSync(tmp), password); // 往返校验：解不开就不允许覆盖唯一副本
  if (fs.existsSync(encPath)) fs.copyFileSync(encPath, `${encPath}.prev`);
  fs.renameSync(tmp, encPath);
  console.log(`2/4 已生成密文库 → ${encPath}（${fs.statSync(encPath).size} 字节）`);

  fs.unlinkSync(dbPath);
  removeSidecars(dbPath);
  console.log('3/4 已清除运行期明文库');

  console.log('4/4 完成。后续启动方式：');
  console.log('   交互启动：npm start（会提示输入主密码）');
  console.log('   常驻部署：设置环境变量 HTD_DB_PASSPHRASE 后用 deploy/start.cmd / start.sh 启动');
  console.log('   校验口令：node backend/scripts/enable-encryption.mjs --verify');
  console.log('   回滚明文：node backend/scripts/enable-encryption.mjs --disable');
}

async function disable() {
  if (!fs.existsSync(encPath)) {
    console.error('未启用加密（未找到 .enc 文件）');
    process.exit(1);
  }
  // 明文残留（上次被强杀）时的回滚：默认拒绝，--force 则在校验文件头后直接采用它
  const hasPlain = fs.existsSync(dbPath);
  if (hasPlain && !flag('--force')) {
    console.error(`明文库已存在，拒绝覆盖：${dbPath}`);
    console.error('若确认它就是最新数据，加 --force 直接采用并归档密文库；否则请先手工核对再处理。');
    process.exit(1);
  }

  if (hasPlain) {
    const head = fs.readFileSync(dbPath).subarray(0, 15).toString('ascii');
    if (head !== 'SQLite format 3') {
      console.error(`现有明文库不是合法 SQLite 文件（文件头：${JSON.stringify(head)}），已中止`);
      process.exit(1);
    }
    console.log('检测到上次残留的运行期明文库，--force 模式下直接采用它');
  } else {
    const password = await askPassword(false);
    try {
      decryptFile(encPath, dbPath, password);
    } catch (error) {
      console.error('主密码错误或密文已损坏，回滚中止（密文库保持原样）');
      process.exit(1);
    }
  }

  const disabled = `${encPath}.disabled-${stamp()}`;
  fs.renameSync(encPath, disabled);
  console.log(`已还原明文库 → ${dbPath}`);
  console.log(`原密文库已重命名为 ${disabled}，确认无误后可手工删除`);
}

async function verify() {
  if (!fs.existsSync(encPath)) {
    console.error('未启用加密（未找到 .enc 文件）');
    process.exit(1);
  }
  const password = await askPassword(false);
  try {
    decrypt(fs.readFileSync(encPath), password);
    console.log('口令正确，密文库可正常解开');
  } catch (error) {
    console.error('口令错误或密文已损坏');
    process.exit(1);
  }
}

console.log(`数据目录：${appConfig.dataRoot}`);
console.log(`数据库：${dbPath}`);
console.log(`当前状态：${fs.existsSync(encPath) ? '已加密' : '未加密'}\n`);

if (flag('--disable')) await disable();
else if (flag('--verify')) await verify();
else await enable();

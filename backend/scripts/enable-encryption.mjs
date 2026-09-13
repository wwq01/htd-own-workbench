#!/usr/bin/env node
/**
 * V2-3 数据库静态加密开关（形态 A：原地信封）
 *
 *   node backend/scripts/enable-encryption.mjs                # 启用（交互设置主密码）
 *   node backend/scripts/enable-encryption.mjs --password xxx # 非交互（口令会进 shell 历史，慎用）
 *   node backend/scripts/enable-encryption.mjs --verify       # 校验口令能否解开
 *   node backend/scripts/enable-encryption.mjs --encrypt-backups # 把历史明文备份批量转密文
 *   node backend/scripts/enable-encryption.mjs --disable      # 回滚为明文库
 *
 * 为什么需要 `--encrypt-backups`：
 *   启用加密**不会**自动改写此前已存在的明文备份。若不管它们，备份目录里仍躺着
 *   可直接读走的完整数据副本，等于加密只锁了前门。启用加密后必须跑一次这个子命令。
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
  console.log('');
  // 历史明文备份不会自动改写，必须显式跑一次，否则备份目录仍是完整明文副本
  console.log('⚠️ 启用前已有的明文备份尚未加密，请立即执行：');
  console.log('   node backend/scripts/enable-encryption.mjs --encrypt-backups');
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

/**
 * 把备份目录里既有的明文备份批量转成密文 `.db.enc`。
 *
 * 安全顺序（与 vault.js 同源）：写 `.enc.tmp` → 往返校验 → rename 就位 → 才删明文。
 * 任何一份失败都不影响其它份，失败清单会列出并让进程以非 0 退出。
 */
async function encryptBackups() {
  const dir = appConfig.backupDir;
  if (!fs.existsSync(dir)) {
    console.error(`备份目录不存在：${dir}`);
    process.exit(1);
  }
  const password = await askPassword(false);
  const plains = fs.readdirSync(dir).filter((f) => /^workbench_[^/\\]+\.db$/i.test(f));
  if (!plains.length) {
    console.log('没有需要加密的明文备份（已经是密文或目录为空）');
    return;
  }

  console.log(`发现 ${plains.length} 份明文备份，开始转换（原文件在密文校验通过后才删除）`);
  const failed = [];
  let ok = 0;
  for (const f of plains) {
    const src = path.join(dir, f);
    const target = path.join(dir, `${f}.enc`);
    if (fs.existsSync(target)) {
      console.log(`  跳过（已存在密文）：${f}`);
      continue;
    }
    const tmp = `${target}.tmp`;
    try {
      const head = fs.readFileSync(src).subarray(0, 15).toString('ascii');
      if (head !== 'SQLite format 3') {
        // 损坏文件不加密也不删除：留给用户人工判断，避免「加密后看起来正常」的假象
        failed.push(`${f}：不是合法 SQLite 文件，已跳过（未改动）`);
        continue;
      }
      encryptFile(src, tmp, password);
      decrypt(fs.readFileSync(tmp), password); // 往返校验
      fs.renameSync(tmp, target);
      fs.unlinkSync(src); // 密文已就位才删明文
      // meta 文件名与明文时期相同（.db/.db.enc 共用 xxx.meta.json），原地补标记即可
      const metaPath = path.join(dir, f.replace(/\.db$/i, '.meta.json'));
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          meta.encrypted = true;
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        } catch (e) {
          console.log(`  警告：${f} 的 meta 更新失败（不影响备份本身）：${e.message}`);
        }
      }
      ok += 1;
      console.log(`  已加密：${f} → ${f}.enc`);
    } catch (error) {
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) { /* ignore */ }
      failed.push(`${f}：${error.message}`);
    }
  }

  console.log(`\n完成：${ok} 份已转为密文`);
  if (failed.length) {
    console.error(`失败 ${failed.length} 份（明文原样保留，未丢失）：`);
    for (const line of failed) console.error(`  - ${line}`);
    process.exit(1);
  }
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
else if (flag('--encrypt-backups')) await encryptBackups();
else await enable();

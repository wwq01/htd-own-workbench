/**
 * V2-3 安全加密预览脚本（仅作用于副本，绝不修改活跃库）。
 *
 * 行为：
 *   1. 解析活跃库路径（与运行时 app.config.js 完全一致：settings.json.dataRoot + /data/workbench.db）。
 *   2. 把活跃库复制为临时副本（源文件只读，不改动）。
 *   3. 用主密码加密副本 → 临时密文。
 *   4. 解密密文做往返校验，确认字节完全一致。
 *   5. 默认清理临时产物；--keep 可保留密文供自查。
 *
 * 关键红线：本脚本不替换、不删除、不迁移活跃库。真实上线所需的「启动时解密、关闭时加密」
 * 由后续在 server 启动流程接入，需用户确认 UX 后再做。
 *
 * 运行：
 *   HTD_MASTER_PASSWORD=你的主密码 node backend/scripts/encrypt-db.mjs [--keep]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { encrypt, decrypt } from '../src/lib/crypto.js';

const keep = process.argv.includes('--keep');

// 与 src/config/app.config.js 的 resolveDataRoot 保持一致
function resolveDataRoot() {
  if (process.env.HTD_DATA_ROOT) return process.env.HTD_DATA_ROOT;
  const settingsPath = path.join('D:\\荒天帝工作台', 'settings.json');
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (typeof settings.dataRoot === 'string' && settings.dataRoot.trim()) {
      return settings.dataRoot.trim();
    }
  } catch {
    // 设置文件缺失/损坏时使用默认路径
  }
  return 'D:\\荒天帝工作台';
}

async function getPassword() {
  if (process.env.HTD_MASTER_PASSWORD) return process.env.HTD_MASTER_PASSWORD;
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const pw = await rl.question('请输入主密码（仅用于本地验证，不会存储）: ');
  rl.close();
  return pw;
}

(async () => {
  const dataRoot = resolveDataRoot();
  const dbPath = path.join(dataRoot, 'data', 'workbench.db');
  if (!fs.existsSync(dbPath)) {
    console.error('✗ 未找到活跃库:', dbPath);
    process.exit(2);
  }
  const password = await getPassword();
  const stamp = Date.now();
  const tmpPlain = path.join(os.tmpdir(), `htd-enc-verify-${stamp}.db`);
  const tmpEnc = path.join(os.tmpdir(), `htd-enc-verify-${stamp}.enc`);
  try {
    fs.copyFileSync(dbPath, tmpPlain); // 只读副本
    const plain = fs.readFileSync(tmpPlain);
    const envelope = encrypt(plain, password);
    fs.writeFileSync(tmpEnc, envelope);
    const back = decrypt(fs.readFileSync(tmpEnc), password);
    if (Buffer.compare(back, plain) !== 0) throw new Error('往返校验不一致');
    console.log('✓ 加密往返校验通过');
    console.log('  源库 :', dbPath, `(${plain.length} 字节)`);
    console.log('  密文 :', tmpEnc, `(${envelope.length} 字节，信封开销 ${envelope.length - plain.length} 字节)`);
    console.log('  红线 : 活跃库未被修改 / 替换 / 删除。');
  } catch (e) {
    console.error('✗ 加密预览失败:', e.message);
    process.exit(1);
  } finally {
    for (const f of [tmpPlain, tmpEnc]) {
      try { if (!keep) fs.unlinkSync(f); } catch { /* 忽略清理失败 */ }
    }
  }
  if (keep) console.log('  (--keep) 密文已保留于临时目录，可自行验证后删除。');
})();

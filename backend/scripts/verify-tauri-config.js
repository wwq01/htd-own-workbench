/**
 * S3-1 桌面壳（Tauri）配置一致性门禁
 *
 * 目的：壳（Rust 侧）与后端（Node 侧）之间靠三样东西对齐——
 *   ① 就绪行前缀 HTD_READY   ② 起始端口 17388   ③ sidecar 名称 htd-backend
 * 任一侧改动而另一侧没跟上，都要等打包后才暴露，排查成本极高。
 * 本脚本把这些跨语言契约固化成静态断言，接入 npm run lint 后即时拦截。
 *
 * 用法：node scripts/verify-tauri-config.js（已接入 npm run lint）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..', '..');

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass += 1; console.log('  PASS ' + name); }
  else { fail += 1; console.log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); }
}

console.log('=== S3-1 tauri config verification ===\n');

const tauriDir = path.join(ROOT, 'src-tauri');
const confPath = path.join(tauriDir, 'tauri.conf.json');
const capPath = path.join(tauriDir, 'capabilities', 'default.json');
const mainRsPath = path.join(tauriDir, 'src', 'main.rs');
const cargoPath = path.join(tauriDir, 'Cargo.toml');
const prepScript = path.join(__dirname, 'prepare-tauri-sidecar.mjs');
const serverJs = path.join(ROOT, 'backend', 'src', 'server.js');
const portJs = path.join(ROOT, 'backend', 'src', 'common', 'utils', 'port.js');

// ---------- 1. 骨架文件齐备 ----------
for (const [label, p] of [
  ['tauri.conf.json', confPath],
  ['capabilities/default.json', capPath],
  ['src/main.rs', mainRsPath],
  ['Cargo.toml', cargoPath],
  ['prepare-tauri-sidecar.mjs', prepScript],
]) {
  check(`存在 ${label}`, fs.existsSync(p), p);
}

// ---------- 2. 就绪行前缀：Rust 侧常量必须与 Node 侧输出字面量一致 ----------
const serverSrc = fs.readFileSync(serverJs, 'utf8');
const mainRs = fs.readFileSync(mainRsPath, 'utf8');

const readyInServer = /HTD_READY \$\{JSON\.stringify\(/.test(serverSrc);
check('server.js 输出 HTD_READY 就绪行', readyInServer);

const rsPrefixMatch = mainRs.match(/const READY_PREFIX: &str = "([^"]+)"/);
check('main.rs 声明 READY_PREFIX', !!rsPrefixMatch);
if (rsPrefixMatch) {
  const rsPrefix = rsPrefixMatch[1];
  check(
    'READY_PREFIX 与 server.js 输出前缀一致',
    serverSrc.includes(rsPrefix),
    `rust="${rsPrefix}"`,
  );
  check('READY_PREFIX 以空格结尾（否则 strip_prefix 会误切 JSON）', rsPrefix.endsWith(' '), `"${rsPrefix}"`);
}

// ---------- 3. 起始端口：必须与 port.js 的 FIXED_PORTS 首项一致 ----------
const portSrc = fs.readFileSync(portJs, 'utf8');
const fixedPortsMatch = portSrc.match(/FIXED_PORTS\s*=\s*\[([^\]]+)\]/);
check('port.js 声明 FIXED_PORTS', !!fixedPortsMatch);
if (fixedPortsMatch) {
  const ports = fixedPortsMatch[1].split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
  const rsPortMatch = mainRs.match(/const START_PORT: u16 = (\d+)/);
  check('main.rs 声明 START_PORT', !!rsPortMatch);
  if (rsPortMatch) {
    const startPort = parseInt(rsPortMatch[1], 10);
    check(
      'START_PORT 等于 FIXED_PORTS 首项',
      startPort === ports[0],
      `rust=${startPort} node=${ports[0]}`,
    );
    check(
      'START_PORT 属于固定端口集合（传其它值后端会拒绝启动）',
      ports.includes(startPort),
      `rust=${startPort} fixed=${ports.join('/')}`,
    );
  }
}

// ---------- 4. sidecar 名称三处一致：externalBin / capabilities / 准备脚本 ----------
const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
const externalBins = (conf.bundle && conf.bundle.externalBin) || [];
check('externalBin 已声明 sidecar', externalBins.length > 0);

const sidecarEntry = externalBins.find((b) => b.includes('htd-backend'));
check('externalBin 含 htd-backend', !!sidecarEntry, JSON.stringify(externalBins));

if (sidecarEntry) {
  const baseName = sidecarEntry.split('/').pop();

  // capabilities 里的 name 必须是 externalBin 中声明的完整字符串
  const caps = JSON.parse(fs.readFileSync(capPath, 'utf8'));
  const perms = (caps.permissions || []).filter((p) => typeof p === 'object');
  const spawnPerm = perms.find((p) => p.identifier === 'shell:allow-spawn');
  check('capabilities 声明 shell:allow-spawn', !!spawnPerm);
  if (spawnPerm) {
    const allowed = (spawnPerm.allow || []).map((a) => a.name);
    check(
      'capabilities 放行 externalBin 的 sidecar 名',
      allowed.includes(sidecarEntry),
      `allow=${JSON.stringify(allowed)} expect=${sidecarEntry}`,
    );
  }

  // Rust 侧 sidecar() 传的是「基础名」，不含路径
  check(
    'main.rs 使用 sidecar 基础名调用',
    mainRs.includes(`sidecar("${baseName}")`),
    `expect sidecar("${baseName}")`,
  );

  // 准备脚本产出的文件名前缀必须匹配
  const prepSrc = fs.readFileSync(prepScript, 'utf8');
  const nameMatch = prepSrc.match(/const SIDECAR_NAME = '([^']+)'/);
  check('准备脚本声明 SIDECAR_NAME', !!nameMatch);
  if (nameMatch) {
    check('SIDECAR_NAME 与 externalBin 基础名一致', nameMatch[1] === baseName, `${nameMatch[1]} vs ${baseName}`);
  }
}

// ---------- 5. 依赖与桌面模式 env 契约 ----------
const cargo = fs.readFileSync(cargoPath, 'utf8');
check('Cargo.toml 依赖 tauri-plugin-shell', /tauri-plugin-shell\s*=/.test(cargo));
check('Cargo.toml 依赖 tauri-plugin-single-instance', /tauri-plugin-single-instance\s*=/.test(cargo));
check('Cargo.toml 无 [lib] 段（桌面端仅需 bin，缺 lib.rs 会编译失败）', !/^\s*\[lib\]/m.test(cargo));

for (const envKey of ['HTD_DESKTOP', 'HTD_PORT', 'HTD_DATA_ROOT']) {
  check(`main.rs 注入 ${envKey}`, mainRs.includes(`"${envKey}"`));
}

// ---------- 6. 退出必须回收 sidecar（孤儿进程会持有 SQLite 写锁） ----------
check('main.rs 在退出事件中 kill 子进程', /RunEvent::Exit/.test(mainRs) && /\.kill\(\)/.test(mainRs));

// ---------- 7. S3-2 系统集成契约（托盘 / 关闭到托盘 / 快捷键 / 通知） ----------
// 这些能力散落在 Rust 代码、Cargo 依赖、capabilities 三处，任一一处漏改都要等
// 打包运行后才暴露（托盘不出现、通知静默失败、快捷键无响应），故同样固化为静态断言。
const capsAll = JSON.parse(fs.readFileSync(capPath, 'utf8'));
const capPerms = (capsAll.permissions || []).map((p) => (typeof p === 'string' ? p : p.identifier));
check('main.rs 构建系统托盘', /TrayIconBuilder::/.test(mainRs));
check('main.rs 托盘绑定菜单事件', /\.on_menu_event\(/.test(mainRs));
check(
  'main.rs 关闭请求走 prevent_close（点 X 隐藏到托盘而非退出）',
  /WindowEvent::CloseRequested/.test(mainRs) && /prevent_close\(\)/.test(mainRs),
);
check('main.rs 用 Quitting 标记区分「真正退出」与「隐藏」', /Quitting/.test(mainRs));

// 托盘菜单项：id 常量必须在 main.rs 中定义且被 on_menu_event 分支消费
for (const menuConst of ['MENU_TOGGLE', 'MENU_OPEN_DATA', 'MENU_QUIT']) {
  check(`main.rs 定义托盘菜单常量 ${menuConst}`, mainRs.includes(`const ${menuConst}: &str =`));
}
check(
  'main.rs 托盘菜单分支消费全部菜单 id',
  ['MENU_TOGGLE', 'MENU_OPEN_DATA', 'MENU_QUIT'].every((c) =>
    new RegExp(`\\b${c}\\s*=>`).test(mainRs),
  ),
);

// 全局快捷键：global-hotkey 只接受「修饰词 + 主键（主键必须最后）」的格式，
// 写反了编译能过、运行时注册失败且静默无提示，故在此静态校验格式。
const hotkeyMatch = mainRs.match(/const HOTKEY_TOGGLE: &str = "([^"]+)"/);
check('main.rs 声明全局快捷键 HOTKEY_TOGGLE', !!hotkeyMatch);
if (hotkeyMatch) {
  const MODS = new Set(['CTRL', 'CONTROL', 'ALT', 'OPTION', 'SHIFT', 'SUPER', 'COMMAND', 'CMD']);
  const tokens = hotkeyMatch[1].split('+').map((t) => t.trim().toUpperCase());
  check(
    `全局快捷键格式合法（修饰词在前、主键在最后）：${hotkeyMatch[1]}`,
    tokens.length >= 2 &&
      !MODS.has(tokens[tokens.length - 1]) &&
      tokens.slice(0, -1).every((t) => MODS.has(t)),
    '修饰词仅支持 CTRL/ALT/SHIFT/SUPER，主键必须为最后一个 token',
  );
}
check('main.rs 注册全局快捷键', /global_shortcut\(\)\.register\(/.test(mainRs));
check('main.rs 仅在按下时响应快捷键（避免长按重复切换）', /ShortcutState::Pressed/.test(mainRs));

// 通知与「打开数据目录」依赖 Rust 侧插件 + capabilities 双侧就位
check('main.rs 发送系统通知', /\.notification\(\)/.test(mainRs));
check('Cargo.toml 依赖 tauri-plugin-notification', /tauri-plugin-notification\s*=/.test(cargo));
check('Cargo.toml 依赖 tauri-plugin-global-shortcut', /tauri-plugin-global-shortcut\s*=/.test(cargo));
check('main.rs 引入 NotificationExt（与 Cargo 依赖对应）', /NotificationExt/.test(mainRs));
check('main.rs 引入 GlobalShortcutExt（与 Cargo 依赖对应）', /GlobalShortcutExt/.test(mainRs));
check('capabilities 声明 notification:default', capPerms.includes('notification:default'));
check('capabilities 声明 shell:allow-open（托盘「打开数据目录」）', capPerms.includes('shell:allow-open'));

console.log('\n=== RESULT: ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail === 0 ? 0 : 1);

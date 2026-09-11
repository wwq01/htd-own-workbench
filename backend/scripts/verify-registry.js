/**
 * S1 注册自动化验证脚本（前端模块注册表一致性守护）
 *
 * 目的：registry.js 是前端模块注册的唯一数据源，router.js / app.js(NAV_ITEMS) /
 *       app.js(pageComponents) / HtpCommandPalette.js(COMMANDS) 全部由它派生。
 *       本脚本校验派生结果与约定完全等价，防止「注册漂移」复发。
 *
 * 用法：node scripts/verify-registry.js（已接入 npm run lint）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 前端根目录（backend/scripts -> ../.. -> 仓库根 -> frontend）
const ROOT = path.join(__dirname, '..', '..', 'frontend');

// 模拟 window 环境加载 registry.js（无构建全局脚本，靠 window 挂载导出）
global.window = {};
const registryCode = fs.readFileSync(path.join(ROOT, 'js/registry.js'), 'utf8');
// eslint-disable-next-line no-eval
eval(registryCode);
const reg = global.window.htdRegistry;
if (!reg) { console.log('FAIL: registry not mounted on window'); process.exit(1); }

const MODULE_META = reg.MODULE_META;

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); }
}

console.log('=== S1 registry verification ===\n');

// 1. 模块数量
check('MODULE_META 有 21 个模块', MODULE_META.length === 21, 'actual=' + MODULE_META.length);

// 2. 改造前 router.js 注册的 21 个 path（从 git 历史/原文件约定）
const EXPECTED_PATHS = [
  '/', '/todo', '/project', '/develop', '/entertainment', '/study', '/review',
  '/secret', '/data', '/settings', '/meeting', '/habit', '/time-block',
  '/finance', '/vault', '/system/recycle-bin', '/poc', '/bid', '/vuln',
  '/incident', '/reading',
];
const actualPaths = MODULE_META.map((m) => m.path);
const missingPaths = EXPECTED_PATHS.filter((p) => !actualPaths.includes(p));
const extraPaths = actualPaths.filter((p) => !EXPECTED_PATHS.includes(p));
check('21 个路由路径全部覆盖（无缺失）', missingPaths.length === 0, 'missing=' + JSON.stringify(missingPaths));
check('无多余路由路径', extraPaths.length === 0, 'extra=' + JSON.stringify(extraPaths));

// 3. 改造前 pageComponents 的 21 个 key
const EXPECTED_KEYS = [
  'home', 'todo', 'project', 'develop', 'entertainment', 'study', 'review',
  'secret', 'data', 'settings', 'meeting', 'habit', 'time-block', 'finance',
  'vault', 'recycle-bin', 'poc', 'bid', 'vuln', 'incident', 'reading',
];
const actualKeys = MODULE_META.map((m) => m.key);
const missingKeys = EXPECTED_KEYS.filter((k) => !actualKeys.includes(k));
check('21 个模块 key 与 pageComponents 一致', missingKeys.length === 0, 'missing=' + JSON.stringify(missingKeys));

// 4. 字段完整性
const noComponent = MODULE_META.filter((m) => !m.component);
check('所有模块都有 component 字段', noComponent.length === 0, JSON.stringify(noComponent.map((m) => m.key)));
const noTitle = MODULE_META.filter((m) => !m.title);
check('所有模块都有 title 字段', noTitle.length === 0, JSON.stringify(noTitle.map((m) => m.key)));
const noIcon = MODULE_META.filter((m) => !m.icon);
check('所有模块都有 icon 字段', noIcon.length === 0, JSON.stringify(noIcon.map((m) => m.key)));
const noPinyin = MODULE_META.filter((m) => !m.pinyin || m.pinyin.length === 0);
check('所有模块都有 pinyin 索引', noPinyin.length === 0, JSON.stringify(noPinyin.map((m) => m.key)));

// 5. 派生函数
const navItems = reg.buildNavItems();
check('buildNavItems 产出 21 项', navItems.length === 21, 'actual=' + navItems.length);
const navBad = navItems.filter((n) => !n.path || !n.label || !n.icon);
check('buildNavItems 每项含 path/label/icon', navBad.length === 0, JSON.stringify(navBad));

const cmds = reg.buildNavCommands('<svg/>');
check('buildNavCommands 产出 21 项', cmds.length === 21, 'actual=' + cmds.length);
const cmdBad = cmds.filter((c) => !c.id || !c.path || c.type !== 'nav' || !c.pinyinKeys || c.pinyinKeys.length === 0);
check('buildNavCommands 每项含 id/path/type/pinyinKeys', cmdBad.length === 0, JSON.stringify(cmdBad.map((c) => c.id)));

// 6. pageComponents 延迟求值（模拟全局组件变量）
MODULE_META.forEach((m) => { global.window[m.component] = { name: m.component }; });
const comps = reg.buildPageComponents();
check('buildPageComponents 解析出 21 个组件', Object.keys(comps).length === 21, 'actual=' + Object.keys(comps).length);
const missingComp = EXPECTED_KEYS.filter((k) => !comps[k]);
check('21 个 key 全部映射到组件', missingComp.length === 0, 'missing=' + JSON.stringify(missingComp));

// 7. 唯一性
const dupKeys = actualKeys.filter((k, i) => actualKeys.indexOf(k) !== i);
check('模块 key 无重复', dupKeys.length === 0, JSON.stringify(dupKeys));
const dupPaths = actualPaths.filter((p, i) => actualPaths.indexOf(p) !== i);
check('路由 path 无重复', dupPaths.length === 0, JSON.stringify(dupPaths));
const dupCmdIds = cmds.map((c) => c.id).filter((id, i) => cmds.map((c) => c.id).indexOf(id) !== i);
check('命令 id 无重复', dupCmdIds.length === 0, JSON.stringify(dupCmdIds));

// 8. 加载顺序（S2-1：index.html 已收敛为单模块入口 <script type="module" src="/src/entry.js">，
//    各文件加载顺序改由 frontend/src/entry.js 的 import 顺序保障；此处将不变量重定向到 entry.js）
const entry = fs.readFileSync(path.join(ROOT, 'src/entry.js'), 'utf8');
const iReg = entry.indexOf("'../js/registry.js'");
const iRouter = entry.indexOf("'../js/router.js'");
const iPalette = entry.indexOf("'../js/components/HtpCommandPalette.js'");
const iApp = entry.indexOf("'../js/app.js'");
check('registry.js 已引入 entry.js', iReg > -1);
check('registry.js 先于 router.js', iReg > -1 && iReg < iRouter, `reg=${iReg} router=${iRouter}`);
check('registry.js 先于 HtpCommandPalette.js', iReg > -1 && iReg < iPalette, `reg=${iReg} palette=${iPalette}`);
check('registry.js 先于 app.js', iReg > -1 && iReg < iApp, `reg=${iReg} app=${iApp}`);

// 9. entry.js 须引入全部 21 个页面模块（防止 S2 收敛时漏引导致页面注册漂移）
const expectedModules = [
  'HomePage', 'TodoPage', 'ProjectPage', 'DevelopPage', 'EntertainmentPage', 'StudyPage',
  'ReviewPage', 'SecretPage', 'DataPage', 'SettingsPage', 'MeetingPage', 'HabitPage',
  'TimeBlockPage', 'FinancePage', 'VaultPage', 'RecycleBinPage', 'PocPage', 'BidPage',
  'VulnPage', 'IncidentPage', 'ReadingPage',
];
const missingModules = expectedModules.filter((m) => !entry.includes(`'../js/modules/${m}.js'`));
check('entry.js 引入全部 21 个页面模块', missingModules.length === 0, 'missing=' + JSON.stringify(missingModules));

console.log('\n=== RESULT: ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail === 0 ? 0 : 1);

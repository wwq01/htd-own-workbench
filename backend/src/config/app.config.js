/**
 * 应用配置：端口、运行环境、数据路径
 */
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const moduleDir = typeof __dirname === 'string'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

// 数据根目录（D:\荒天帝工作台）。无环境变量时读取固定默认目录中的设置，
// 使前端修改数据路径后在重启时真正生效。
const DEFAULT_DATA_ROOT = 'D:\\荒天帝工作台';
function resolveDataRoot() {
  if (process.env.HTD_DATA_ROOT) return process.env.HTD_DATA_ROOT;
  const settingsPath = path.join(DEFAULT_DATA_ROOT, 'settings.json');
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (typeof settings.dataRoot === 'string' && settings.dataRoot.trim()) {
      return settings.dataRoot.trim();
    }
  } catch (error) {
    // 首次运行或设置文件损坏时使用默认路径。
  }
  return DEFAULT_DATA_ROOT;
}
const DATA_ROOT = resolveDataRoot();

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
function isTruthy(value) {
  return TRUTHY.has(String(value || '').trim().toLowerCase());
}
function parseList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const appConfig = {
  // 运行环境
  env: process.env.NODE_ENV || 'development',

  // 服务端口
  port: parseInt(process.env.HTD_PORT, 10) || 17388,

  // 监听地址（S4 服务端部署）。默认仍为回环地址——保持「仅本机可访问」的既有安全边界。
  // 需要局域网/其他设备访问时设置 HTD_HOST=0.0.0.0。
  host: process.env.HTD_HOST || '127.0.0.1',

  // 服务端常驻模式（S4）：HTD_SERVER=1
  // 与桌面模式一致的差异：不自动打开浏览器、不做「同端口已有实例则复用并退出」。
  // 常驻场景下复用退出会让守护脚本误判「启动即成功实则已退出」。
  server: isTruthy(process.env.HTD_SERVER),

  // 运行模式：desktop = 被桌面壳（Tauri）以 sidecar 方式拉起
  // 与普通启动的差异（S3-0 契约，详见 docs/产品迭代/S3-执行方案.md）：
  //   1. 不自动打开系统浏览器（页面由壳内 webview 加载）
  //   2. 不做「同端口已有实例则复用并退出」（由壳的 single-instance 保证唯一）
  //   3. 监听就绪后向 stdout 输出机器可读的 HTD_READY 行，供壳读取实际端口
  desktop: process.env.HTD_DESKTOP === '1' || process.env.HTD_DESKTOP === 'true',

  // 数据目录
  dataRoot: DATA_ROOT,
  dbDir: path.join(DATA_ROOT, 'data'),
  logDir: path.join(DATA_ROOT, 'logs'),
  backupDir: path.join(DATA_ROOT, 'backups'),
  settingsPath: path.join(DATA_ROOT, 'settings.json'),

  // 数据库文件路径
  dbPath: path.join(DATA_ROOT, 'data', 'workbench.db'),

  // 前端静态资源目录（从 src/config/ 向上三级到项目根目录，再进入 frontend）
  frontendDir: process.pkg
    ? path.resolve(moduleDir, '../../frontend')
    : path.resolve(moduleDir, '../../../frontend'),
  templateDbPath: process.pkg
    ? path.resolve(moduleDir, '../prisma/template.db')
    : path.resolve(moduleDir, '../../prisma/template.db'),

  // 允许的来源白名单（S4）：非回环访问时，Origin 校验与 CORS 都需要显式放行。
  //   例：HTD_ALLOWED_ORIGINS=http://192.168.1.10:17388,https://htd.example.com
  //   填 `*` 表示放行任意来源（仅建议在已启用访问令牌 / 前置反向代理时使用）。
  allowedOrigins: parseList(process.env.HTD_ALLOWED_ORIGINS),

  // 局域网模式（S4）：HTD_LAN=1 时自动把本机所有非回环 IPv4 加入来源白名单，
  // 免去手工列举内网 IP（DHCP 变更 IP 后不会失效）。
  lan: isTruthy(process.env.HTD_LAN),

  // 访问令牌（S4）：HTD_ACCESS_TOKEN 为空 = 不鉴权（维持既有本机模式，零回归）；
  // 一旦设置，全站需先凭令牌换取会话 Cookie 才能访问。
  // 服务暴露到非本机（0.0.0.0 / 公网域名）时必须设置，否则个人数据无任何门禁。
  accessToken: process.env.HTD_ACCESS_TOKEN || '',

  // 反向代理信任（S4）：HTD_TRUST_PROXY=1 时启用 express trust proxy，
  // 使 req.ip 取到 X-Forwarded-For 真实客户端 IP（日志与限流准确）。
  trustProxy: isTruthy(process.env.HTD_TRUST_PROXY),

  // 应用版本
  version: '1.5.0',

  // API 前缀
  apiPrefix: '/api/v1',
};

export default appConfig;

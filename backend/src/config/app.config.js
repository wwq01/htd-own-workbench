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

const appConfig = {
  // 运行环境
  env: process.env.NODE_ENV || 'development',

  // 服务端口
  port: parseInt(process.env.HTD_PORT, 10) || 17388,

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

  // 应用版本
  version: '1.5.0',

  // API 前缀
  apiPrefix: '/api/v1',

  // 主机地址
  host: '127.0.0.1',
};

export default appConfig;

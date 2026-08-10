/**
 * 启动引导：数据库初始化、迁移执行、环境自检
 */
import fs from 'fs';
import path from 'path';
import appConfig from './config/app.config.js';
import dbConfig from './config/db.config.js';
import { ensureDir, copyFile } from './common/utils/file.js';
import logger from './common/logger.js';
import settingsService from './modules/system/settings.service.js';

/**
 * 启动自检
 */
export async function bootstrap() {
  logger.info('========== 荒天帝工作台启动中 ==========');

  // 1. 校验/创建数据目录
  logger.info(`数据根目录: ${appConfig.dataRoot}`);
  ensureDir(appConfig.dataRoot);
  ensureDir(appConfig.dbDir);
  ensureDir(appConfig.logDir);
  ensureDir(appConfig.backupDir);

  // 首次启动时复制随程序发布的空库模板，确保脱离开发环境也能直接使用。
  if (!fs.existsSync(appConfig.dbPath) && fs.existsSync(appConfig.templateDbPath)) {
    copyFile(appConfig.templateDbPath, appConfig.dbPath);
    logger.info(`已初始化数据库结构: ${appConfig.dbPath}`);
  }

  // 2. 校验前端资源目录
  const indexPath = path.join(appConfig.frontendDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    logger.warn(`前端入口文件不存在: ${indexPath}（前端资源可能尚未部署）`);
  } else {
    logger.info('前端资源目录校验通过');
  }

  // 3. 启动时自动备份数据库（如果数据库文件存在）
  const settings = await settingsService.getSettings();
  if (dbConfig.backup.autoBackupOnStart && shouldAutoBackup(settings)) {
    await autoBackup(settings.maxBackups);
  }

  logger.info('========== 启动自检完成 ==========');
}

/**
 * 自动备份数据库
 */
async function autoBackup(maxBackups = dbConfig.backup.maxBackups) {
  const dbPath = appConfig.dbPath;
  if (!fs.existsSync(dbPath)) {
    logger.info('数据库文件尚未创建，跳过自动备份');
    return;
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const backupFileName = `workbench_${dateStr}.db`;
  const backupPath = path.join(appConfig.backupDir, backupFileName);

  try {
    copyFile(dbPath, backupPath);
    logger.info(`数据库自动备份完成: ${backupPath}`);

    // 清理过期备份（保留最近 maxBackups 个）
    const backups = fs.readdirSync(appConfig.backupDir)
      .filter(f => f.startsWith('workbench_') && f.endsWith('.db'))
      .sort()
      .reverse();

    if (backups.length > maxBackups) {
      const toDelete = backups.slice(maxBackups);
      for (const f of toDelete) {
        fs.unlinkSync(path.join(appConfig.backupDir, f));
        logger.info(`清理过期备份: ${f}`);
      }
    }
  } catch (error) {
    logger.error(`数据库自动备份失败: ${error.message}`);
  }
}

function shouldAutoBackup(settings) {
  if (settings.backupFrequency === 'manual') return false;
  if (settings.backupFrequency === 'startup') return true;

  if (!fs.existsSync(appConfig.backupDir)) return true;
  const threshold = settings.backupFrequency === 'weekly' ? 7 : 1;
  const cutoff = Date.now() - threshold * 24 * 60 * 60 * 1000;
  const recent = fs.readdirSync(appConfig.backupDir)
    .filter((fileName) => fileName.startsWith('workbench_') && fileName.endsWith('.db'))
    .some((fileName) => fs.statSync(path.join(appConfig.backupDir, fileName)).mtimeMs >= cutoff);
  return !recent;
}

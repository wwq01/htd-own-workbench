/**
 * SQLite 文件备份管理。
 * 启动自动备份与页面手动备份都使用同一个目录和文件命名规则。
 */
import fs from 'fs';
import path from 'path';
import appConfig from '../../config/app.config.js';
import { ensureDir, copyFile, formatSize } from '../../common/utils/file.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';

const BACKUP_FILE_REGEX = /^workbench_[a-zA-Z0-9_-]+\.db$/;

export function isSafeBackupFileName(fileName) {
  return typeof fileName === 'string'
    && BACKUP_FILE_REGEX.test(fileName)
    && path.basename(fileName) === fileName;
}

export function createManualBackupFileName(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('') + '_' + [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');
  return `workbench_manual_${stamp}.db`;
}

function getBackupPath(fileName) {
  if (!isSafeBackupFileName(fileName)) {
    throw new BusinessError(ErrorCodes.PARAM_ERROR, '备份文件名无效');
  }
  return path.join(appConfig.backupDir, fileName);
}

class BackupService {
  async listBackups() {
    ensureDir(appConfig.backupDir);
    return fs.readdirSync(appConfig.backupDir)
      .filter(isSafeBackupFileName)
      .map((fileName) => {
        const filePath = path.join(appConfig.backupDir, fileName);
        const stat = fs.statSync(filePath);
        return {
          fileName,
          size: stat.size,
          sizeText: formatSize(stat.size),
          createdAt: stat.birthtime.toISOString(),
          updatedAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createBackup() {
    if (!fs.existsSync(appConfig.dbPath)) {
      throw new BusinessError(ErrorCodes.FILE_NOT_FOUND, '数据库文件不存在，暂时无法备份');
    }
    ensureDir(appConfig.backupDir);
    let fileName = createManualBackupFileName();
    let index = 1;
    while (fs.existsSync(path.join(appConfig.backupDir, fileName))) {
      fileName = `${createManualBackupFileName()}_${index++}.db`;
    }
    const filePath = path.join(appConfig.backupDir, fileName);
    copyFile(appConfig.dbPath, filePath);
    const stat = fs.statSync(filePath);
    return {
      fileName,
      size: stat.size,
      sizeText: formatSize(stat.size),
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  }

  getBackupPath(fileName) {
    const filePath = getBackupPath(fileName);
    if (!fs.existsSync(filePath)) {
      throw new BusinessError(ErrorCodes.FILE_NOT_FOUND, '备份文件不存在');
    }
    return filePath;
  }

  async removeBackup(fileName) {
    const filePath = this.getBackupPath(fileName);
    fs.unlinkSync(filePath);
    return { fileName };
  }
}

export default new BackupService();

import fs from 'fs';
import path from 'path';
import appConfig from '../../config/app.config.js';
import dbConfig from '../../config/db.config.js';
import { ensureDir } from '../../common/utils/file.js';
import { copyFile } from '../../common/utils/file.js';
import { BusinessError } from '../../common/error.js';
import { ErrorCodes } from '../../common/constants/index.js';
import { settingsUpdateSchema } from './settings.schema.js';

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  dataRoot: appConfig.dataRoot,
  backupFrequency: 'startup',
  maxBackups: dbConfig.backup.maxBackups,
};

function readStoredSettings() {
  try {
    if (!fs.existsSync(appConfig.settingsPath)) return {};
    const raw = JSON.parse(fs.readFileSync(appConfig.settingsPath, 'utf8'));
    return settingsUpdateSchema.parse(raw);
  } catch (error) {
    return {};
  }
}

export function normalizeSettings(value = {}) {
  return { ...DEFAULT_SETTINGS, ...settingsUpdateSchema.parse(value) };
}

class SettingsService {
  async getSettings() {
    const settings = normalizeSettings(readStoredSettings());
    return {
      ...settings,
      effectiveDataRoot: appConfig.dataRoot,
      dbPath: appConfig.dbPath,
      settingsPath: appConfig.settingsPath,
      restartRequired: settings.dataRoot !== appConfig.dataRoot,
    };
  }

  async updateSettings(payload) {
    const next = normalizeSettings({ ...readStoredSettings(), ...payload });
    if (next.dataRoot !== appConfig.dataRoot) {
      const targetDbDir = path.join(next.dataRoot, 'data');
      const targetDbPath = path.join(targetDbDir, 'workbench.db');
      if (fs.existsSync(targetDbPath)) {
        throw new BusinessError(ErrorCodes.BUSINESS_ERROR, '目标数据路径已存在数据库，为避免覆盖数据，修改已取消');
      }
      ensureDir(targetDbDir);
      if (fs.existsSync(appConfig.dbPath)) {
        copyFile(appConfig.dbPath, targetDbPath);
      }
    }
    ensureDir(path.dirname(appConfig.settingsPath));
    fs.writeFileSync(appConfig.settingsPath, JSON.stringify(next, null, 2), 'utf8');
    if (next.dataRoot !== appConfig.dataRoot) {
      ensureDir(next.dataRoot);
      fs.writeFileSync(path.join(next.dataRoot, 'settings.json'), JSON.stringify(next, null, 2), 'utf8');
    }
    return {
      ...next,
      effectiveDataRoot: appConfig.dataRoot,
      dbPath: appConfig.dbPath,
      settingsPath: appConfig.settingsPath,
      restartRequired: next.dataRoot !== appConfig.dataRoot,
    };
  }
}

export default new SettingsService();

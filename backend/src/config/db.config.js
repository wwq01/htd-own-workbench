/**
 * 数据库配置
 */
import path from 'path';
import appConfig from './app.config.js';

const dbConfig = {
  // Prisma 数据库 URL（SQLite）
  url: `file:${appConfig.dbPath}`,

  // 备份策略
  backup: {
    // 启动时自动备份
    autoBackupOnStart: true,
    // 保留最近备份数量
    maxBackups: 7,
  },

  // 软删除字段名
  softDeleteField: 'deletedAt',

  // 分页默认值
  pagination: {
    defaultPage: 1,
    defaultPageSize: 20,
    maxPageSize: 100,
  },
};

export default dbConfig;

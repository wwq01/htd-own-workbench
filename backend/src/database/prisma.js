/**
 * Prisma 客户端单例
 * 保证全局唯一数据库连接
 * 显式指定 datasourceUrl，避免 .env 文件中文路径编码问题
 */
import { PrismaClient } from '@prisma/client';
import logger from '../common/logger.js';
import appConfig from '../config/app.config.js';
import fs from 'fs';
import path from 'path';

// 确保数据库目录存在
const dbDir = path.dirname(appConfig.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 显式设置 DATABASE_URL（从 JS 配置读取，避免 .env 编码问题）
const datasourceUrl = `file:${appConfig.dbPath}`;
process.env.DATABASE_URL = datasourceUrl;

// 全局单例标记
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    datasourceUrl,
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

// 监听日志事件
prisma.$on('warn', (e) => {
  logger.warn(`[Prisma] ${e.message}`);
});
prisma.$on('error', (e) => {
  logger.error(`[Prisma] ${e.message}`);
});

// 开发环境下挂载到全局，避免热重载时重复创建连接
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

/**
 * 确保数据库连接
 */
export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('数据库连接成功');
    return prisma;
  } catch (error) {
    logger.error('数据库连接失败:', error.message);
    throw error;
  }
}

/**
 * 断开数据库连接
 */
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('数据库连接已断开');
  } catch (error) {
    logger.error('断开数据库连接失败:', error.message);
  }
}

export default prisma;

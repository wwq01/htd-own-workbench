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

// 数据源可切换：测试环境通过 HTD_TEST_DB_URL 注入隔离用的临时库，
// 避免测试直接读写生产数据库（D:\荒天帝工作台\data\workbench.db）
const datasourceUrl = process.env.HTD_TEST_DB_URL || `file:${appConfig.dbPath}`;
// 仅当未显式设置时才回填 DATABASE_URL，避免覆盖测试注入的临时库地址
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = datasourceUrl;
}

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
    // V1.3：幂等对齐运行中的真实库与当前 schema（补齐新增表/列，保护老库）
    try {
      const { ensureSchema } = await import('./migrate.js');
      await ensureSchema();
    } catch (migrateErr) {
      logger.error('Schema 对齐失败（已忽略，不影响启动）:', migrateErr.message);
    }
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

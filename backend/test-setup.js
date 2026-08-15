/**
 * Vitest 全局 setup：测试数据库隔离
 * 复制 prisma/template.db 到操作系统临时目录下的独立库，
 * 通过 HTD_TEST_DB_URL 注入，使服务层 Prisma 单例与测试内 PrismaClient
 * 全部指向该临时库，确保测试永不读写生产数据库。
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const templateDb = path.join(__dirname, 'prisma', 'template.db');
const testDir = path.join(os.tmpdir(), 'htd-workbench-test');
fs.mkdirSync(testDir, { recursive: true });
const testDb = path.join(testDir, 'workbench.test.db');

// 每次测试运行前用干净的模板库覆盖，保证用例幂等、互不污染
fs.copyFileSync(templateDb, testDb);

const testUrl = `file:${testDb}`;
process.env.HTD_TEST_DB_URL = testUrl;
process.env.DATABASE_URL = testUrl;

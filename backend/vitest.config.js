/**
 * Vitest 配置
 * 测试隔离：由 test-setup.js 复制 prisma/template.db 到临时库，
 * 并通过 HTD_TEST_DB_URL 注入，所有测试（含服务层单例）均读写该临时库，
 * 绝不触碰生产数据库（D:\荒天帝工作台\data\workbench.db）。
 * 测试数据统一用 TEST_ 前缀，afterEach/afterAll 自动清理。
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 测试文件匹配规则
    include: ['src/**/*.test.js'],
    // 串行执行（避免数据库写冲突）
    fileParallelism: false,
    // 单个测试超时 30s
    testTimeout: 30000,
    // hook 超时 30s
    hookTimeout: 30000,
    // 全局 setup：注入隔离用临时数据库
    setupFiles: ['./test-setup.js'],
  },
});

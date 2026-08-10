/**
 * Vitest 配置
 * 使用真实数据库（D:\荒天帝工作台\data\workbench.db）做集成测试
 * 测试数据统一用 TEST_ 前缀，afterEach/afterAll 自动清理
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
    // 全局 setup
    setupFiles: [],
  },
});

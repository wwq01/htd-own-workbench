import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// 前端组件测试配置（S2-6 补齐）：jsdom 环境 + vue 插件 + esm-bundler alias（与 vite.config 对齐）
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.js'],
  },
});

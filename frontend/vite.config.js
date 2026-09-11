import { fileURLToPath } from 'url';
import path from 'path';
import vue from '@vitejs/plugin-vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 荒天帝工作台 · S2 阶段 Vite 配置（路线 B：Vue ESM + SFC）
// - vue/pinia 改为 ESM 依赖，构建期打包进 dist（运行时零网络，守离线优先红线）
// - src/globals.js 把 ESM Vue/Pinia 挂到 window，兼容旧 JS 组件裸 `Vue.xxx`（零改动）
// - alias 指向 vue.esm-bundler.js 保留运行时模板编译，兼容旧 template 字符串组件
//   （否则默认 runtime-only 构建会因模板字符串缺编译器而白屏）
// - @vitejs/plugin-vue 处理新建的 .vue（SFC）组件
export default {
  root: __dirname,
base: './',
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
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: 'index.html',
    },
  },
};

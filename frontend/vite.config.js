import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 把「运行时以经典 <script> 引用的 IIFE 全局包」在构建后拷贝进 dist。
// 原因：Vite 不会打包非 module 的 <script src="...">（会留下悬空引用导致白屏），
// 这些文件必须作为静态资源随 dist 一同发布；保持 index.html 的 assets/lib/... 引用不变。
function copyIifeLibs() {
  return {
    name: 'copy-iife-libs',
    closeBundle() {
      const src = path.join(__dirname, 'assets/lib');
      const dest = path.join(__dirname, 'dist/assets/lib');
      if (!fs.existsSync(src)) return;
      fs.mkdirSync(dest, { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
    },
  };
}

// 荒天帝工作台 · S2-1 Vite 构建化配置
// 策略：源文件保持「无构建全局脚本」写法（window.X = X 自附着，使用 window.Vue / window.Pinia 全局）。
// vue/pinia 不通过 npm 安装，直接复用 index.html 注入的 IIFE 全局包，离线优先、零网络依赖。
// entry.js 按 index.html 原脚本顺序 import 各文件触发副作用；Vite 仅做模块聚合 + 内容哈希 + 相对路径。
export default {
  root: __dirname,
  base: './',
  plugins: [copyIifeLibs()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: 'index.html',
    },
  },
};

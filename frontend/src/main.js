/**
 * main.js - S2 阶段入口（路线 B：Vue ESM + SFC）
 * 加载顺序敏感：先 globals.js（设 window.Vue / window.htdPinia），再 entry.js（触发 21 模块副作用，
 * app.js 末尾 Vue.createApp(App) + app.use(window.htdPinia) 依赖已就绪的全局）。
 */
import './globals.js';
import './entry.js';

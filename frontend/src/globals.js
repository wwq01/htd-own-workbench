/**
 * globals.js - S2 阶段兼容层（路线 B 起点）
 * 把 ESM 的 Vue / Pinia 挂到 window，兼容旧 JS 组件里的裸 `Vue.xxx` / `window.htdPinia` 写法，
 * 使 29 个旧文件无需改动即可在 ESM 构建下工作。
 * 必须在 entry.js 之前加载（见 main.js 的 import 顺序）。
 */
import * as Vue from 'vue';
import * as Pinia from 'pinia';
import { createPinia } from 'pinia';

window.Vue = Vue;
window.Pinia = Pinia;
window.htdPinia = createPinia();

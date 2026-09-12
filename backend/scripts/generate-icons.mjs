// 生成 Tauri 全套图标（不依赖 Rust 工具链）。
// 唯一真源：src-tauri/icons/icon.svg（矢量，品牌盾徽+星徽）。
// 依赖（纯 JS，装在 managed node 工作区，不写入项目 package.json）：
//   @resvg/resvg-js  —— SVG → PNG（任意尺寸，无系统字体依赖）
//   png2icons        —— PNG → .ico / .icns
// 运行（在本机 managed 工作区）：
//   NODE_PATH=C:/Users/weiwq/.workbuddy/binaries/node/workspace/node_modules \
//     node backend/scripts/generate-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// 依赖装在 managed node 工作区（不写入项目 package.json），用 createRequire 指向它解析
const require = createRequire('C:/Users/weiwq/.workbuddy/binaries/node/workspace/node_modules/index.js');
const { Resvg } = require('@resvg/resvg-js');
const png2icons = require('png2icons');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/scripts → ../../src-tauri/icons
const ICON_DIR = path.resolve(__dirname, '../../src-tauri/icons');
const svg = fs.readFileSync(path.join(ICON_DIR, 'icon.svg'), 'utf8');

function renderPng(size) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  return resvg.render().asPng();
}

const png32 = renderPng(32);
const png128 = renderPng(128);
const png256 = renderPng(256); // 128x128@2x
const png1024 = renderPng(1024); // png2icons 源

fs.writeFileSync(path.join(ICON_DIR, '32x32.png'), png32);
fs.writeFileSync(path.join(ICON_DIR, '128x128.png'), png128);
fs.writeFileSync(path.join(ICON_DIR, '128x128@2x.png'), png256);

const ico = png2icons.createICO(png1024, png2icons.BICUBIC);
const icns = png2icons.createICNS(png1024, png2icons.BICUBIC);
if (!ico) throw new Error('createICO 返回空（PNG 非法？）');
if (!icns) throw new Error('createICNS 返回空（PNG 非法？）');
fs.writeFileSync(path.join(ICON_DIR, 'icon.ico'), ico);
fs.writeFileSync(path.join(ICON_DIR, 'icon.icns'), icns);

console.log('✓ 图标已生成：', {
  '32x32.png': `${png32.length} B`,
  '128x128.png': `${png128.length} B`,
  '128x128@2x.png': `${png256.length} B`,
  'icon.ico': `${ico.length} B`,
  'icon.icns': `${icns.length} B`,
});

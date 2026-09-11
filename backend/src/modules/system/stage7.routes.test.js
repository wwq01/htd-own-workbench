import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

describe('阶段 7 路由与交付资源清单', () => {
  it('应注册系统设置和全部业务前端路由', () => {
    // S1-1 后：路由改由 registry.js 单一数据源声明，router.js 遍历派生注册，
    // 故断言目标从 router.js 源码文本改为 registry.js 声明 + router.js 消费关系。
    const registry = fs.readFileSync(path.join(repoRoot, 'frontend/js/registry.js'), 'utf8');
    const router = fs.readFileSync(path.join(repoRoot, 'frontend/js/router.js'), 'utf8');
    expect(router).toContain('htdRegistry');
    expect(router).toContain('registerRoute');
    for (const route of ['/', '/todo', '/project', '/develop', '/entertainment', '/study', '/review', '/secret', '/data', '/settings']) {
      expect(registry).toContain(`path: '${route}'`);
    }
  });

  it('应加载设置页面并注册到应用页面映射', () => {
    // S2-1：index.html 已收敛为单模块入口，各页面/registry 的加载顺序改由 frontend/src/entry.js 的 import 保障
    const entry = fs.readFileSync(path.join(repoRoot, 'frontend/src/entry.js'), 'utf8');
    const registry = fs.readFileSync(path.join(repoRoot, 'frontend/js/registry.js'), 'utf8');
    const app = fs.readFileSync(path.join(repoRoot, 'frontend/js/app.js'), 'utf8');
    expect(entry).toContain('../js/modules/SettingsPage.js');
    expect(entry).toContain('../js/registry.js');
    // S1-1 后页面映射由 registry 派生（buildPageComponents 延迟求值 window[component]）
    expect(registry).toContain("component: 'SettingsPage'");
    expect(app).toContain('buildPageComponents');
  });

  it('应存在可执行的 Windows 与 macOS 打包脚本', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'backend/package.json'), 'utf8'));
    expect(pkg.scripts['build:win']).toContain('node24-win-x64');
    expect(pkg.scripts['build:mac']).toContain('node22-macos-x64');
    expect(pkg.pkg.assets).toContain('../frontend/dist/**/*');
  });
});

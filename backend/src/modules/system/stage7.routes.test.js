import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

describe('阶段 7 路由与交付资源清单', () => {
  it('应注册系统设置和全部业务前端路由', () => {
    const router = fs.readFileSync(path.join(repoRoot, 'frontend/js/router.js'), 'utf8');
    for (const route of ['/', '/todo', '/project', '/develop', '/entertainment', '/study', '/review', '/secret', '/data', '/settings']) {
      expect(router).toContain(`registerRoute('${route}'`);
    }
  });

  it('应加载设置页面并注册到应用页面映射', () => {
    const index = fs.readFileSync(path.join(repoRoot, 'frontend/index.html'), 'utf8');
    const app = fs.readFileSync(path.join(repoRoot, 'frontend/js/app.js'), 'utf8');
    expect(index).toContain('js/modules/SettingsPage.js');
    expect(app).toContain('settings: SettingsPage');
  });

  it('应存在可执行的 Windows 与 macOS 打包脚本', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'backend/package.json'), 'utf8'));
    expect(pkg.scripts['build:win']).toContain('node24-win-x64');
    expect(pkg.scripts['build:mac']).toContain('node22-macos-x64');
    expect(pkg.pkg.assets).toContain('../frontend/**/*');
  });
});

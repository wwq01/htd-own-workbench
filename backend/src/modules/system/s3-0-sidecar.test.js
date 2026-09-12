/**
 * S3-0 · 桌面壳（Tauri）Node sidecar 启动契约测试
 *
 * 覆盖三件事：
 *   1. appConfig.desktop 由 HTD_DESKTOP 环境变量正确解析（默认 false，零回归）
 *   2. 端口顺延时 originGuard 白名单必须跟随实际端口（回归防护）
 *   3. 桌面模式下 server.js 输出机器可读的 HTD_READY 行，且不弹系统浏览器
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import createApp from '../../app.js';
import appConfig from '../../config/app.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../../..');

describe('S3-0 sidecar 启动契约', () => {
  describe('appConfig.desktop 开关', () => {
    afterEach(() => {
      vi.resetModules();
      delete process.env.HTD_DESKTOP;
    });

    it('未设置 HTD_DESKTOP 时 desktop 为 false（默认行为不变）', async () => {
      delete process.env.HTD_DESKTOP;
      vi.resetModules();
      const { default: cfg } = await import('../../config/app.config.js');
      expect(cfg.desktop).toBe(false);
    });

    it.each(['1', 'true'])('HTD_DESKTOP=%s 时 desktop 为 true', async (v) => {
      process.env.HTD_DESKTOP = v;
      vi.resetModules();
      const { default: cfg } = await import('../../config/app.config.js');
      expect(cfg.desktop).toBe(true);
    });

    it('HTD_DESKTOP 为其他值时 desktop 为 false', async () => {
      process.env.HTD_DESKTOP = '0';
      vi.resetModules();
      const { default: cfg } = await import('../../config/app.config.js');
      expect(cfg.desktop).toBe(false);
    });
  });

  describe('端口顺延与 originGuard 白名单', () => {
    let server;
    let actualPort;
    const originalPort = appConfig.port;

    beforeAll(async () => {
      const app = createApp();
      server = app.listen(0, '127.0.0.1');
      await new Promise((r) => server.once('listening', r));
      actualPort = server.address().port;
    });

    afterAll(async () => {
      appConfig.port = originalPort;
      await new Promise((r) => server.close(r));
    });

    /**
     * 以给定 Origin 发一个写入请求，返回状态码。
     * 用 notes 接口（写入类、必过 originGuard）。
     */
    async function postWithOrigin(origin) {
      const res = await fetch(`http://127.0.0.1:${actualPort}/api/v1/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
        body: JSON.stringify({ content: 's3-0 probe', sourceId: 'S3_0_PROBE' }),
      });
      // 读取并丢弃 body，避免连接悬挂
      await res.text().catch(() => {});
      return res.status;
    }

    it('端口顺延后若不同步配置，originGuard 会拒绝实际端口的写入（证明缺陷存在）', async () => {
      // 模拟「未回写」的旧行为：配置端口仍是默认值，而实际监听在别处
      appConfig.port = 17388;
      const status = await postWithOrigin(`http://127.0.0.1:${actualPort}`);
      expect(status).toBe(403);
    });

    it('回写实际端口后，originGuard 接受该端口的写入（缺陷已修）', async () => {
      // server.js 在 listen 前执行的正是这一步：appConfig.port = port
      appConfig.port = actualPort;
      const status = await postWithOrigin(`http://127.0.0.1:${actualPort}`);
      expect(status).not.toBe(403);
    });

    it('仍拒绝非本机来源 Origin', async () => {
      appConfig.port = actualPort;
      const status = await postWithOrigin('http://evil.example.com');
      expect(status).toBe(403);
    });

    it('server.js 已在监听前回写实际端口', () => {
      const src = fs.readFileSync(path.join(backendRoot, 'src/server.js'), 'utf8');
      expect(src).toContain('appConfig.port = port');
    });
  });

  describe('桌面模式行为约定（源码契约）', () => {
    const serverSrc = fs.readFileSync(path.join(backendRoot, 'src/server.js'), 'utf8');

    it('就绪后输出 HTD_READY 行，含端口与 API 前缀', () => {
      expect(serverSrc).toContain('HTD_READY');
      expect(serverSrc).toContain('apiPrefix');
      expect(serverSrc).toMatch(/HTD_READY \$\{JSON\.stringify\(/);
    });

    it('桌面模式下不自动打开系统浏览器', () => {
      // openBrowser 调用必须被 desktop 条件包裹
      expect(serverSrc).toContain('if (!appConfig.desktop) {');
      expect(serverSrc).toContain('openBrowser(url)');
    });

    it('桌面模式下跳过「复用已有实例并退出」分支', () => {
      // 该分支含 process.exit(0)，若被壳拉起时会让壳误判子进程异常终止
      const reuseBlock = serverSrc.slice(
        serverSrc.indexOf('进程复用'),
        serverSrc.indexOf('检测可用端口'),
      );
      expect(reuseBlock).toContain('if (!appConfig.desktop)');
      expect(reuseBlock).toContain('process.exit(0)');
    });
  });

  describe('桌面模式端到端（真实子进程）', () => {
    it(
      '以 HTD_DESKTOP=1 拉起后输出可解析的 HTD_READY，且未打开浏览器',
      async () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'htd-s3-0-'));
        // 端口严格限定在固定三端口（originGuard 白名单与 pkg 打包一致性要求），
        // 传其它端口会被 findAvailablePort 直接拒绝启动，故从中挑一个当前空闲的。
        const net = await import('net');
        const FIXED_PORTS = [17388, 17389, 17390];
        async function isFree(port) {
          return new Promise((resolve) => {
            const s = net.createServer();
            s.unref();
            s.once('error', () => resolve(false));
            s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
          });
        }
        let freePort = 0;
        for (const p of FIXED_PORTS) {
          if (await isFree(p)) { freePort = p; break; }
        }
        expect(freePort, '固定三端口均被占用，无法执行端到端用例').toBeGreaterThan(0);

        const child = spawn(process.execPath, [path.join(backendRoot, 'src/server.js')], {
          cwd: backendRoot,
          env: {
            ...process.env,
            HTD_DESKTOP: '1',
            HTD_PORT: String(freePort),
            HTD_DATA_ROOT: tmpRoot,
            HTD_TEST_DB_URL: undefined, // 子进程用真实数据目录，避免测试库注入
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (c) => { stdout += c.toString(); });
        child.stderr.on('data', (c) => { stderr += c.toString(); });

        const ready = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve(null), 60000);
          const onData = () => {
            const line = stdout.split('\n').find((l) => l.startsWith('HTD_READY '));
            if (line) {
              clearTimeout(timer);
              child.stdout.off('data', onData);
              resolve(line);
            }
          };
          child.stdout.on('data', onData);
          child.once('exit', () => { clearTimeout(timer); resolve(null); });
        });

        child.kill('SIGTERM');
        await new Promise((r) => child.once('exit', r));
        fs.rmSync(tmpRoot, { recursive: true, force: true });

        expect(ready, `未收到 HTD_READY。stdout=${stdout.slice(0, 500)} stderr=${stderr.slice(0, 500)}`).toBeTruthy();
        const payload = JSON.parse(ready.slice('HTD_READY '.length));
        expect(payload.port).toBe(freePort);
        expect(payload.host).toBe('127.0.0.1');
        expect(payload.apiPrefix).toBe('/api/v1');
        expect(payload.url).toBe(`http://127.0.0.1:${freePort}`);
        expect(typeof payload.dataRoot).toBe('string');
      },
      90000,
    );
  });
});

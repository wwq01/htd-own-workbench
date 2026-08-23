/**
 * 端口检测与自动顺延工具
 */
import net from 'net';
import logger from '../logger.js';

// V1.4（D2 决策）：端口严格限定在 17388 / 17389 / 17390 三个，
// 不向 17390 之后继续探测；三者均被占用则直接报错退出。
const FIXED_PORTS = [17388, 17389, 17390];

/**
 * 检测端口是否可用
 */
export function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * 查找可用端口：仅在 17388 → 17389 → 17390 三个固定端口中探测。
 * 跳过小于 startPort 的端口（兼容 HTD_PORT 覆盖场景）。
 * 若三个端口全部被占用，记录清晰错误并退出进程（非零码）。
 */
export async function findAvailablePort(startPort = 17388, maxRetries = 3, host = '127.0.0.1') {
  for (const port of FIXED_PORTS) {
    if (port < startPort) continue;
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  logger.error(`端口 ${FIXED_PORTS.join('/')} 均被占用，无法启动服务，请释放端口后重试`);
  process.exit(1);
}

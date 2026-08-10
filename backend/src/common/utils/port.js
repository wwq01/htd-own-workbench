/**
 * 端口检测与自动顺延工具
 */
import net from 'net';

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
 * 查找可用端口：从 startPort 开始，最多尝试 maxRetries 次
 */
export async function findAvailablePort(startPort, maxRetries = 10, host = '127.0.0.1') {
  for (let i = 0; i < maxRetries; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  throw new Error(`从端口 ${startPort} 开始连续 ${maxRetries} 个端口均被占用`);
}

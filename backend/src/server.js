/**
 * 服务启动：端口监听、自动打开浏览器、优雅关闭
 */
import createApp from './app.js';
import { bootstrap } from './bootstrap.js';
import { connectDatabase, disconnectDatabase } from './database/prisma.js';
import { findAvailablePort } from './common/utils/port.js';
import { openBrowser } from './common/utils/browser.js';
import appConfig from './config/app.config.js';
import logger from './common/logger.js';
import http from 'http';

/**
 * 探测默认端口是否已有工作台实例在运行（进程复用，§5.3.3）
 * 命中 /system/health 且 service 标识匹配即判定为同源实例
 */
async function probeInstance(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: `${appConfig.apiPrefix}/system/health` },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            const j = JSON.parse(body);
            resolve(!!(j && j.data && j.data.service === 'htd-own-workbench'));
          } catch (e) { resolve(false); }
        });
      },
    );
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => { req.destroy(); resolve(false); });
  });
}

async function startServer() {
  try {
    // 1. 启动自检
    await bootstrap();

    // 2. 连接数据库
    await connectDatabase();

    // 2.5 进程复用：若默认端口已有工作台实例在跑，直接打开浏览器复用，避免多进程写 SQLite 锁冲突
    const existingInstance = await probeInstance(appConfig.port);
    if (existingInstance) {
      const url = `http://${appConfig.host}:${appConfig.port}`;
      logger.info(`检测到已有工作台实例（${url}），复用进程，仅打开浏览器`);
      openBrowser(url);
      process.exit(0);
    }

    // 3. 检测可用端口
    const port = await findAvailablePort(appConfig.port, 10, appConfig.host);
    if (port !== appConfig.port) {
      logger.warn(`默认端口 ${appConfig.port} 被占用，已顺延至端口 ${port}`);
    }

    // 4. 创建应用实例
    const app = createApp();

    // 5. 启动 HTTP 服务
    const server = app.listen(port, appConfig.host, () => {
      const url = `http://${appConfig.host}:${port}`;
      logger.info(`========================================`);
      logger.info(`  荒天帝工作台已启动`);
      logger.info(`  访问地址: ${url}`);
      logger.info(`  API 前缀: ${appConfig.apiPrefix}`);
      logger.info(`  数据目录: ${appConfig.dataRoot}`);
      logger.info(`  运行环境: ${appConfig.env}`);
      logger.info(`========================================`);

      // 自动打开浏览器（延迟 500ms 确保服务就绪）
      setTimeout(() => {
        openBrowser(url);
      }, 500);
    });

    // 6. 优雅关闭
    const gracefulShutdown = async (signal) => {
      logger.info(`收到 ${signal} 信号，正在优雅关闭服务...`);
      server.close(async () => {
        await disconnectDatabase();
        logger.info('服务已关闭');
        process.exit(0);
      });

      // 5 秒后强制退出
      setTimeout(() => {
        logger.error('优雅关闭超时，强制退出');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // 7. 全局未捕获异常处理
    process.on('uncaughtException', (err) => {
      logger.error('未捕获异常:', err.message, { stack: err.stack });
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('未处理的 Promise 拒绝:', reason);
    });

  } catch (error) {
    logger.error('服务启动失败:', error.message, { stack: error.stack });
    process.exit(1);
  }
}

// 启动
startServer();

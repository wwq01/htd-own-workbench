/**
 * 服务启动：端口监听、自动打开浏览器、优雅关闭
 */
import createApp from './app.js';
import { bootstrap } from './bootstrap.js';
import { connectDatabase, disconnectDatabase } from './database/prisma.js';
import { unlockDatabase, lockDatabase } from './database/vault.js';
import remoteBackupService from './modules/system/remote-backup.service.js';
import backupService from './modules/system/backup.service.js';
import { findAvailablePort } from './common/utils/port.js';
import { openBrowser } from './common/utils/browser.js';
import appConfig from './config/app.config.js';
import logger from './common/logger.js';
import { localIpv4 } from './common/utils/allowed-origins.js';
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
    // 0. V2-3：加密库解锁。未启用加密时直接返回 encrypted:false，后续流程无感。
    //    解锁失败一律显式退出——绝不降级为明文只读，否则用户会误以为数据仍受保护。
    let vaultState = { encrypted: false };
    try {
      vaultState = await unlockDatabase();
    } catch (error) {
      if (error.message === 'BAD_PASSPHRASE') {
        logger.error('数据库主密码错误或密文已损坏，无法解锁。请确认 HTD_DB_PASSPHRASE 是否正确。');
      } else {
        logger.error('数据库已加密但取不到主密码：请设置环境变量 HTD_DB_PASSPHRASE，或在终端中直接启动以便交互输入。');
      }
      process.exit(1);
    }

    // 退出时把运行期明文库重新加密回去。用 once 语义兜住多条退出路径：
    // 优雅关闭、强制退出、未捕获异常、以及任何未走上述分支的 process.exit。
    let locked = false;
    const lockOnce = () => {
      if (locked) return;
      locked = true;
      lockDatabase(vaultState);
    };
    process.on('exit', lockOnce);

    // V2-2：把主密码交给异地备份服务。启用加密后上传的必须是密文副本，
    // 否则「本地加密、异地明文」会让 V2-3 的保护在数据离开本机时彻底失效。
    if (vaultState.encrypted && vaultState.passphrase) {
      remoteBackupService.setPassphrase(vaultState.passphrase);
    }
    // V2-3 配套：本地备份同样必须落密文。只锁主库而备份目录全是明文副本，
    // 等于任何人拿到 backups/ 就能读走全部数据，加密形同虚设。
    if (vaultState.encrypted && vaultState.passphrase) {
      backupService.setPassphrase(vaultState.passphrase);
    }

    // 1. 启动自检
    await bootstrap();

    // 2. 连接数据库
    await connectDatabase();

    // 2.5 进程复用：若默认端口已有工作台实例在跑，直接打开浏览器复用，避免多进程写 SQLite 锁冲突
    //     S3-0：桌面模式跳过——唯一实例由桌面壳的 single-instance 保证，
    //     sidecar 若在此退出会被壳判定为「子进程异常终止」，反而拿不到端口。
    if (!appConfig.desktop && !appConfig.server) {
      const existingInstance = await probeInstance(appConfig.port);
      if (existingInstance) {
        const url = `http://${appConfig.host}:${appConfig.port}`;
        logger.info(`检测到已有工作台实例（${url}），复用进程，仅打开浏览器`);
        openBrowser(url);
        process.exit(0);
      }
    }

    // 3. 检测可用端口
    const port = await findAvailablePort(appConfig.port, 10, appConfig.host);
    if (port !== appConfig.port) {
      logger.warn(`默认端口 ${appConfig.port} 被占用，已顺延至端口 ${port}`);
    }
    // S3-0：把实际监听端口回写到配置。
    // originGuard 的白名单读的是 appConfig.port，若不回写，端口顺延后
    // 浏览器 Origin（实际端口）与白名单（配置端口）不一致，全部写入请求会被 403。
    appConfig.port = port;

    // 4. 创建应用实例
    const app = createApp();

    // 5. 启动 HTTP 服务
    const server = app.listen(port, appConfig.host, () => {
      const isWildcard = appConfig.host === '0.0.0.0' || appConfig.host === '::';
      const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(appConfig.host);
      const url = `http://${isWildcard ? '127.0.0.1' : appConfig.host}:${port}`;
      const lanHosts = (isWildcard || appConfig.lan) ? localIpv4() : [];
      const mode = appConfig.desktop ? '桌面壳 sidecar' : appConfig.server ? '服务端常驻' : '本机';

      logger.info(`========================================`);
      logger.info(`  荒天帝工作台已启动`);
      logger.info(`  访问地址: ${url}`);
      for (const ip of lanHosts) {
        logger.info(`  局域网:   http://${ip}:${port}`);
      }
      logger.info(`  运行模式: ${mode}（监听 ${appConfig.host}:${port}）`);
      logger.info(`  API 前缀: ${appConfig.apiPrefix}`);
      logger.info(`  数据目录: ${appConfig.dataRoot}`);
      logger.info(`  访问令牌: ${appConfig.accessToken ? '已启用' : '未启用'}`);
      logger.info(`  运行环境: ${appConfig.env}`);
      logger.info(`========================================`);

      // S4 安全自检：监听非回环地址却未启用令牌 = 任何人可读写全部个人数据
      if (!isLoopback && !appConfig.accessToken) {
        logger.warn(
          '[安全警告] 当前监听非回环地址且未设置 HTD_ACCESS_TOKEN：任何能访问该端口的人都可读写全部数据。'
          + '请设置访问令牌（HTD_ACCESS_TOKEN）或改回仅本机监听。',
        );
      }

      // S3-0：桌面模式以机器可读行告知壳实际端口（壳据此让 webview 加载对应地址）。
      // 约定：单行 JSON，前缀 HTD_READY，末尾换行；壳用 /^HTD_READY (.+)$/ 解析。
      if (appConfig.desktop) {
        process.stdout.write(
          `HTD_READY ${JSON.stringify({
            port,
            host: appConfig.host,
            url,
            apiPrefix: appConfig.apiPrefix,
            dataRoot: appConfig.dataRoot,
          })}\n`,
        );
      }

      // 自动打开浏览器（延迟 500ms 确保服务就绪）
      // S3-0：桌面模式下页面由壳内 webview 加载，不弹系统浏览器
      // S4：服务端常驻模式由使用者自行访问，不在服务器上弹浏览器
      if (!appConfig.desktop && !appConfig.server) {
        setTimeout(() => {
          openBrowser(url);
        }, 500);
      }
    });

    // 6. 优雅关闭
    const gracefulShutdown = async (signal) => {
      logger.info(`收到 ${signal} 信号，正在优雅关闭服务...`);
      server.close(async () => {
        await disconnectDatabase();
        lockOnce();
        logger.info('服务已关闭');
        process.exit(0);
      });

      // 5 秒后强制退出
      setTimeout(() => {
        logger.error('优雅关闭超时，强制退出');
        lockOnce();
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

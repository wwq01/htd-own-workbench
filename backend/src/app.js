/**
 * 应用实例：注册中间件、挂载路由、托管静态资源
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import appConfig from './config/app.config.js';
import { responseMiddleware } from './middleware/response.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { requestLogMiddleware } from './middleware/requestLog.js';
import originGuard from './middleware/origin-guard.js';
import backupTrigger from './middleware/backup-trigger.js';
import backupService from './modules/system/backup.service.js';
import prisma from './database/prisma.js';
import systemRouter from './modules/system/system.router.js';
import todoRouter from './modules/todo/todo.router.js';
import memoRouter from './modules/memo/memo.router.js';
import projectRouter from './modules/project/project.router.js';
import milestoneRouter from './modules/milestone/milestone.router.js';
import taskRouter from './modules/task/task.router.js';
import devProjectRouter from './modules/dev-project/dev-project.router.js';
import devSnippetRouter from './modules/dev-snippet/dev-snippet.router.js';
import devIssueRouter from './modules/dev-issue/dev-issue.router.js';
import studyRecordRouter from './modules/study-record/study-record.router.js';
import studyPendingRouter from './modules/study-pending/study-pending.router.js';
import entertainmentRouter from './modules/entertainment/entertainment.router.js';
import reviewRouter from './modules/review/review.router.js';
import secretRouter from './modules/secret/secret.router.js';
import deploymentRouter from './modules/deployment/deployment.router.js';
import meetingRouter from './modules/meeting/meeting.router.js';
import habitRouter from './modules/habit/habit.router.js';
import timeBlockRouter from './modules/time-block/time-block.router.js';
import financeRouter from './modules/finance/finance.router.js';
import financeContractRouter from './modules/finance-contract/finance-contract.router.js';
import vaultRouter from './modules/vault/vault.router.js';
import pocRouter from './modules/poc/poc.router.js';
import bidRouter from './modules/bid/bid.router.js';
import vulnRouter from './modules/vuln/vuln.router.js';
import incidentRouter from './modules/incident/incident.router.js';
import readingRouter from './modules/reading/reading.router.js';
import searchRouter from './modules/search/search.router.js';
import logger from './common/logger.js';

function createApp() {
  const app = express();

  // ===== 基础中间件 =====
  // CORS 收敛为本地源白名单：仅允许同源 / localhost / 127.0.0.1，
  // 可通过 HTD_CORS_ORIGINS 环境变量追加（逗号分隔），杜绝完全开放。
  const allowedOrigins = new Set([
    `http://${appConfig.host}:${appConfig.port}`,
    `http://localhost:${appConfig.port}`,
    `http://127.0.0.1:${appConfig.port}`,
    ...(process.env.HTD_CORS_ORIGINS
      ? process.env.HTD_CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : []),
  ]);
  app.use(cors({
    origin: (origin, callback) => {
      // 同源请求（origin 为空）或命中白名单放行；其余拒绝（不返回 CORS 头）
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(requestLogMiddleware);
  app.use(responseMiddleware);
  // 写入类接口 Origin 校验（仅允许本地 127.0.0.1 / localhost，防御 CSRF）
  app.use(originGuard);
  // 写入成功后懒触发每日自动备份（不阻塞主流程）
  app.use(backupTrigger);
  // 恢复备份后让 Prisma 断开并以新库重连
  backupService.prisma = prisma;

  // ===== API 路由 =====
  app.use(`${appConfig.apiPrefix}/system`, systemRouter);
  app.use(`${appConfig.apiPrefix}/todos`, todoRouter);
  app.use(`${appConfig.apiPrefix}/memos`, memoRouter);
  app.use(`${appConfig.apiPrefix}/projects`, projectRouter);
  app.use(`${appConfig.apiPrefix}/milestones`, milestoneRouter);
  app.use(`${appConfig.apiPrefix}/tasks`, taskRouter);
  app.use(`${appConfig.apiPrefix}/dev-projects`, devProjectRouter);
  app.use(`${appConfig.apiPrefix}/dev-snippets`, devSnippetRouter);
  app.use(`${appConfig.apiPrefix}/dev-issues`, devIssueRouter);
  app.use(`${appConfig.apiPrefix}/study-records`, studyRecordRouter);
  app.use(`${appConfig.apiPrefix}/study-pendings`, studyPendingRouter);
  app.use(`${appConfig.apiPrefix}/entertainments`, entertainmentRouter);
  app.use(`${appConfig.apiPrefix}/reviews`, reviewRouter);
  app.use(`${appConfig.apiPrefix}/secrets`, secretRouter);
  app.use(`${appConfig.apiPrefix}/deployments`, deploymentRouter);
  app.use(`${appConfig.apiPrefix}/meetings`, meetingRouter);
  app.use(`${appConfig.apiPrefix}/habits`, habitRouter);
  app.use(`${appConfig.apiPrefix}/time-blocks`, timeBlockRouter);
  app.use(`${appConfig.apiPrefix}/finances`, financeRouter);
  app.use(`${appConfig.apiPrefix}/finance-contracts`, financeContractRouter);
  app.use(`${appConfig.apiPrefix}/vaults`, vaultRouter);
  app.use(`${appConfig.apiPrefix}/pocs`, pocRouter);
  app.use(`${appConfig.apiPrefix}/bids`, bidRouter);
  app.use(`${appConfig.apiPrefix}/vulns`, vulnRouter);
  app.use(`${appConfig.apiPrefix}/incidents`, incidentRouter);
  app.use(`${appConfig.apiPrefix}/readings`, readingRouter);
  app.use(`${appConfig.apiPrefix}/search`, searchRouter);

  // ===== 前端静态资源托管 =====
  // S2-1：优先使用 Vite 构建产物 frontend/dist；缺失或为空时回退到无构建 frontend/
  // （源文件为原生 ESM 友好写法，dist 缺失时浏览器仍以原生 ESM 加载，零回归）。
  const frontendRoot = appConfig.frontendDir;
  const frontendDist = path.join(frontendRoot, 'dist');
  const hasBuiltDist = fs.existsSync(frontendDist) && fs.readdirSync(frontendDist).length > 0;
  const frontendDir = hasBuiltDist ? frontendDist : frontendRoot;
  app.use(express.static(frontendDir, {
    index: 'index.html',
    setHeaders: (res, filePath) => {
      // 禁止缓存 HTML，确保更新及时生效
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // 前端路由兜底：非 API 请求返回 index.html
  app.get('*', (req, res, next) => {
    // API 请求走 404
    if (req.path.startsWith(appConfig.apiPrefix)) {
      return next();
    }
    res.sendFile(path.join(frontendDir, 'index.html'));
  });

  // ===== 错误处理 =====
  app.use(notFoundHandler);
  app.use(errorHandler);

  logger.info('应用实例创建完成');
  return app;
}

export default createApp;

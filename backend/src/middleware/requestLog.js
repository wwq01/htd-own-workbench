/**
 * 请求日志记录中间件
 */
import logger from '../common/logger.js';

export function requestLogMiddleware(req, res, next) {
  const startTime = Date.now();
  const { method, path, query, body } = req;

  // 响应结束时记录
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // 跳过静态资源日志
    if (path.startsWith('/assets') || path === '/' || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.ico')) {
      return;
    }

    const logMsg = `${method} ${path} ${statusCode} ${duration}ms`;

    if (statusCode >= 400) {
      logger.warn(`${logMsg} - query: ${JSON.stringify(query || {})}`);
    } else {
      logger.debug(logMsg);
    }
  });

  next();
}

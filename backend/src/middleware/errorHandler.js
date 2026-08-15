/**
 * 全局异常捕获中间件
 * 捕获同步/异步错误，统一返回错误响应
 */
import { BackendError } from '../common/error.js';
import { ErrorCodes } from '../common/constants/index.js';
import logger from '../common/logger.js';

/**
 * 404 处理
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    code: ErrorCodes.NOT_FOUND,
    msg: `接口不存在: ${req.method} ${req.path}`,
    data: null,
  });
}

/**
 * 全局错误处理
 */
export function errorHandler(err, req, res, next) {
  // Zod 校验错误
  if (err.name === 'ZodError') {
    const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    logger.warn(`[参数校验失败] ${req.method} ${req.path} - ${messages}`);
    return res.status(400).json({
      code: ErrorCodes.PARAM_ERROR,
      msg: `参数错误: ${messages}`,
      data: err.errors,
    });
  }

  // 业务错误（统一经 toPublic 白名单序列化，避免泄露内部信息）
  if (err instanceof BackendError) {
    logger.warn(`[业务错误] ${req.method} ${req.path} - [${err.code}] ${err.message}`);
    return res.status(err.httpStatus || 200).json(err.toPublic());
  }

  // Prisma 错误
  if (err.code && err.code.startsWith('P')) {
    logger.error(`[数据库错误] ${req.method} ${req.path} - [${err.code}] ${err.message}`);
    return res.status(500).json({
      code: ErrorCodes.DB_ERROR,
      msg: '数据库操作失败',
      data: null,
    });
  }

  // 其他未知错误
  logger.error(`[未知错误] ${req.method} ${req.path} - ${err.message}`, { stack: err.stack });
  return res.status(500).json({
    code: ErrorCodes.SERVER_ERROR,
    msg: '服务器内部错误',
    data: null,
  });
}

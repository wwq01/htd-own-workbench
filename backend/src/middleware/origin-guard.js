/**
 * 写入类接口 Origin 校验中间件
 * 仅对写入类请求（POST/PUT/PATCH/DELETE）校验 Origin 请求头，
 * GET/HEAD/OPTIONS 直接放行。允许来源仅限本机回环地址。
 */
import appConfig from '../config/app.config.js';
import { BackendError } from '../common/error.js';
import { ErrorCodes } from '../common/constants/index.js';

export default function originGuard(req, res, next) {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  const allowed = new Set([
    `http://127.0.0.1:${appConfig.port}`,
    `http://localhost:${appConfig.port}`,
  ]);
  if (!origin || allowed.has(origin)) return next();
  return next(new BackendError(ErrorCodes.ORIGIN_FORBIDDEN, '请求来源不被允许', 403));
}

/**
 * 写入类接口 Origin 校验中间件
 * 仅对写入类请求（POST/PUT/PATCH/DELETE）校验 Origin 请求头，
 * GET/HEAD/OPTIONS 直接放行。
 *
 * S4：白名单不再硬编码为回环地址，改由 allowed-origins.js 统一解析
 * （回环 + HTD_ALLOWED_ORIGINS + HTD_LAN 自动内网 IP + `*` 通配），
 * 与 CORS 白名单共用同一实现，避免两处漂移。
 */
import { BackendError } from '../common/error.js';
import { ErrorCodes } from '../common/constants/index.js';
import { isOriginAllowed } from '../common/utils/allowed-origins.js';

export default function originGuard(req, res, next) {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) return next();
  return next(new BackendError(ErrorCodes.ORIGIN_FORBIDDEN, '请求来源不被允许', 403));
}

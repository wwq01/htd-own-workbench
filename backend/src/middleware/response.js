/**
 * 统一响应格式化中间件
 * 所有响应统一返回 { code, msg, data } 标准结构
 * 为 res 挂载 res.success() 和 res.fail() 快捷方法
 */
import { ErrorCodes, ErrorMessages } from '../common/constants/index.js';

export function responseMiddleware(req, res, next) {
  /**
   * 成功响应
   * @param {*} data - 响应数据
   * @param {string} msg - 提示消息
   */
  res.success = (data = null, msg = 'success') => {
    res.json({
      code: ErrorCodes.SUCCESS,
      msg,
      data,
    });
  };

  /**
   * 失败响应
   * @param {number} code - 错误码
   * @param {string} msg - 错误消息
   * @param {*} data - 附加数据
   */
  res.fail = (code = ErrorCodes.UNKNOWN_ERROR, msg = null, data = null) => {
    res.json({
      code,
      msg: msg || ErrorMessages[code] || '未知错误',
      data,
    });
  };

  next();
}

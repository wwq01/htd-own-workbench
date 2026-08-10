/**
 * 自定义业务错误类 + 全局错误码
 */
import { ErrorCodes, ErrorMessages } from './constants/index.js';

/**
 * 业务错误类
 * 用于在业务逻辑中抛出带有错误码和错误消息的异常
 */
export class BusinessError extends Error {
  constructor(code, message, data = null) {
    super(message || ErrorMessages[code] || '未知错误');
    this.name = 'BusinessError';
    this.code = code;
    this.data = data;
  }

  /**
   * 快捷创建参数错误
   */
  static paramError(message) {
    return new BusinessError(ErrorCodes.PARAM_ERROR, message);
  }

  /**
   * 快捷创建未找到错误
   */
  static notFound(message) {
    return new BusinessError(ErrorCodes.NOT_FOUND, message);
  }

  /**
   * 快捷创建业务错误
   */
  static business(message, data = null) {
    return new BusinessError(ErrorCodes.BUSINESS_ERROR, message, data);
  }
}

export { ErrorCodes, ErrorMessages };

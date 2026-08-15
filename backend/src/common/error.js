/**
 * 自定义业务错误类 + 全局错误码
 */
import { ErrorCodes, ErrorMessages } from './constants/index.js';

/**
 * 业务错误类
 * 用于在业务逻辑中抛出带有错误码和错误消息的异常
 */
/**
 * 后端统一错误基类
 * 所有对外暴露的错误都应通过 toPublic() 白名单序列化，
 * 仅返回 code / msg / data，绝不泄露 stack、内部路径或原始数据库错误。
 */
export class BackendError extends Error {
  constructor(code, message, httpStatus = 500, data = null) {
    super(message || ErrorMessages[code] || '未知错误');
    this.name = 'BackendError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.data = data;
  }

  /**
   * 白名单序列化：仅暴露给客户端的字段
   */
  toPublic() {
    return {
      code: this.code,
      msg: this.message,
      data: this.data,
    };
  }

  /**
   * 统一序列化：供错误处理器完整序列化（含 httpStatus）
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      data: this.data,
    };
  }
}

export class BusinessError extends BackendError {
  constructor(code, message, data = null) {
    super(code, message || ErrorMessages[code] || '未知错误', 200, data);
    this.name = 'BusinessError';
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

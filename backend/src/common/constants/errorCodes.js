/**
 * 全局错误码定义
 */
export const ErrorCodes = {
  // 通用成功
  SUCCESS: 0,

  // 通用错误 1xxx
  UNKNOWN_ERROR: 1000,
  PARAM_ERROR: 1001,
  NOT_FOUND: 1002,
  FORBIDDEN: 1003,
  SERVER_ERROR: 1004,
  RATE_LIMIT: 1005,

  // 数据库错误 2xxx
  DB_ERROR: 2000,
  DB_NOT_FOUND: 2001,
  DB_DUPLICATE: 2002,
  DB_CONSTRAINT: 2003,

  // 业务错误 3xxx
  BUSINESS_ERROR: 3000,
  DATA_INVALID: 3001,
  DATA_EXPIRED: 3002,
  DATA_LOCKED: 3003,

  // 文件操作错误 4xxx
  FILE_ERROR: 4000,
  FILE_TOO_LARGE: 4001,
  FILE_FORMAT: 4002,
  FILE_NOT_FOUND: 4003,
};

export const ErrorMessages = {
  [ErrorCodes.SUCCESS]: 'success',
  [ErrorCodes.UNKNOWN_ERROR]: '未知错误',
  [ErrorCodes.PARAM_ERROR]: '参数错误',
  [ErrorCodes.NOT_FOUND]: '资源不存在',
  [ErrorCodes.FORBIDDEN]: '无权限访问',
  [ErrorCodes.SERVER_ERROR]: '服务器内部错误',
  [ErrorCodes.RATE_LIMIT]: '请求过于频繁',
  [ErrorCodes.DB_ERROR]: '数据库错误',
  [ErrorCodes.DB_NOT_FOUND]: '数据不存在',
  [ErrorCodes.DB_DUPLICATE]: '数据已存在',
  [ErrorCodes.DB_CONSTRAINT]: '数据约束冲突',
  [ErrorCodes.BUSINESS_ERROR]: '业务处理失败',
  [ErrorCodes.DATA_INVALID]: '数据无效',
  [ErrorCodes.DATA_EXPIRED]: '数据已过期',
  [ErrorCodes.DATA_LOCKED]: '数据已锁定',
  [ErrorCodes.FILE_ERROR]: '文件操作失败',
  [ErrorCodes.FILE_TOO_LARGE]: '文件过大',
  [ErrorCodes.FILE_FORMAT]: '文件格式不支持',
  [ErrorCodes.FILE_NOT_FOUND]: '文件不存在',
};

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

  // 来源校验错误 5xxx
  ORIGIN_FORBIDDEN: 'ORIGIN_FORBIDDEN',

  // 备份相关错误 6xxx
  BACKUP_FILE_NOT_FOUND: 'DETECT.BACKUP.FILE_NOT_FOUND',
  BACKUP_DISK_FULL: 'EXEC.BACKUP.DISK_FULL',
  BACKUP_VERSION_TOO_HIGH: 'RESULT.BACKUP.VERSION_TOO_HIGH',
  BACKUP_CORRUPTED: 'RESULT.BACKUP.CORRUPTED',
  BACKUP_CREATE_FAILED: 'EXEC.BACKUP.CREATE_FAILED',
  BACKUP_RESTORE_FAILED: 'EXEC.BACKUP.RESTORE_FAILED',
  // 加密备份（V2-3 配套）：恢复密文备份时缺主密码 / 口令错误
  BACKUP_PASSPHRASE_REQUIRED: 'PARAM.BACKUP.PASSPHRASE_REQUIRED',
  BACKUP_DECRYPT_FAILED: 'RESULT.BACKUP.DECRYPT_FAILED',

  // 异地备份相关错误（V2-2）
  REMOTE_BACKUP_CONFIG_INVALID: 'PARAM.REMOTE_BACKUP.CONFIG_INVALID',
  REMOTE_BACKUP_UPLOAD_FAILED: 'EXEC.REMOTE_BACKUP.UPLOAD_FAILED',
  REMOTE_BACKUP_LIST_FAILED: 'EXEC.REMOTE_BACKUP.LIST_FAILED',
  REMOTE_BACKUP_REMOVE_FAILED: 'EXEC.REMOTE_BACKUP.REMOVE_FAILED',
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

  [ErrorCodes.ORIGIN_FORBIDDEN]: '请求来源不被允许',
  [ErrorCodes.BACKUP_FILE_NOT_FOUND]: '备份文件不存在',
  [ErrorCodes.BACKUP_DISK_FULL]: '备份写入失败：磁盘空间不足',
  [ErrorCodes.BACKUP_VERSION_TOO_HIGH]: '备份由更高版本创建，请先升级工作台再恢复此备份',
  [ErrorCodes.BACKUP_CORRUPTED]: '备份文件已损坏，无法恢复（已保留原主库）',
  [ErrorCodes.BACKUP_CREATE_FAILED]: '备份创建失败',
  [ErrorCodes.BACKUP_RESTORE_FAILED]: '备份恢复失败',
  [ErrorCodes.BACKUP_PASSPHRASE_REQUIRED]: '该备份已加密，恢复需要数据库主密码（当前进程未持有）',
  [ErrorCodes.BACKUP_DECRYPT_FAILED]: '备份解密失败：主密码错误或密文已损坏（已保留原主库）',
  [ErrorCodes.REMOTE_BACKUP_CONFIG_INVALID]: '异地备份配置不完整或不被支持',
  [ErrorCodes.REMOTE_BACKUP_UPLOAD_FAILED]: '异地备份上传失败',
  [ErrorCodes.REMOTE_BACKUP_LIST_FAILED]: '异地备份目录列举失败',
  [ErrorCodes.REMOTE_BACKUP_REMOVE_FAILED]: '异地备份清理失败',
};

/**
 * 统一日志实例（基于 Winston）
 * 支持控制台输出 + 本地日志文件落盘
 */
import winston from 'winston';
import appConfig from '../config/app.config.js';
import fs from 'fs';
import path from 'path';

// 确保日志目录存在
if (!fs.existsSync(appConfig.logDir)) {
  fs.mkdirSync(appConfig.logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    if (stack) {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}${metaStr}`;
    }
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level}: ${message}`;
  })
);

const logger = winston.createLogger({
  level: appConfig.env === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(appConfig.logDir, 'workbench.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // 错误日志单独文件
    new winston.transports.File({
      filename: path.join(appConfig.logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

export default logger;

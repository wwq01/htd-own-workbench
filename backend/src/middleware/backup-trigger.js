/**
 * 备份懒触发中间件
 * 每次成功的写入类请求（POST/PUT/PATCH/DELETE）完成后，
 * 若当日尚未自动备份则补一份每日备份（fire-and-forget，不阻塞主流程）。
 * 不依赖 cron/定时器，Windows 下更可靠。
 */
import backupService from '../modules/system/backup.service.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default function backupTrigger(req, res, next) {
  const method = (req.method || 'GET').toUpperCase();
  if (MUTATING.has(method)) {
    res.once('finish', () => {
      if (res.statusCode >= 400) return; // 仅成功写入后触发
      backupService.maybeDailyBackup().catch((err) => {
        // 自动备份失败不应影响业务主流程，状态点已在服务内记录
        backupService._setStatus('error', err.message);
      });
    });
  }
  next();
}

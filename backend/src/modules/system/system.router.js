/**
 * 系统模块 - 路由
 */
import { Router } from 'express';
import systemController from './system.controller.js';

const router = Router();

// 健康检查
router.get('/health', systemController.healthCheck);

// 全局统计数据
router.get('/statistics', systemController.getStatistics);

// 各模块数据条目统计
router.get('/data-stats', systemController.getDataStats);
router.get('/data/export', systemController.exportData);
router.post('/data/import', systemController.importData);
router.post('/data/clear', systemController.clearData);
router.get('/backups', systemController.listBackups);
router.post('/backups', systemController.createBackup);
router.post('/backups/manual', systemController.createManualBackup);
router.post('/backups/restore/:fileName', systemController.restoreBackup);
router.get('/backups/status', systemController.getBackupStatus);
// V2-2 异地备份（默认关闭）：状态 / 连通性自检 / 立即同步
router.get('/backups/remote', systemController.getRemoteBackupStatus);
router.post('/backups/remote/check', systemController.checkRemoteBackup);
router.post('/backups/remote/sync', systemController.syncRemoteBackup);
router.get('/backups/:fileName/download', systemController.downloadBackup);
router.delete('/backups/:fileName', systemController.removeBackup);
router.get('/settings', systemController.getSettings);
router.put('/settings', systemController.updateSettings);

// 字段 / 状态机配置平台（V1.5 §8.3）
router.get('/field-config', systemController.getFieldConfig);
router.put('/field-config', systemController.updateFieldConfig);

// 回收站（V1.3）
router.get('/recycle-bin', systemController.getRecycleBin);
router.post('/recycle-bin/restore', systemController.restoreRecycleBinItem);
router.delete('/recycle-bin/:model/:id', systemController.permanentlyDeleteRecycleBinItem);
router.delete('/recycle-bin/empty', systemController.emptyRecycleBin);

// 首页三栏数据聚合（V1.3）
router.get('/home-summary', systemController.getHomeSummary);
router.post('/home-recommend', systemController.autoRecommendVault);

// 图表聚合数据（V1.5 §8.1）
router.get('/charts', systemController.getCharts);
router.get('/project-charts', systemController.getProjectCharts);

export default router;

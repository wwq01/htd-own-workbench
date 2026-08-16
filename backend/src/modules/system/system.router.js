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
router.get('/backups/:fileName/download', systemController.downloadBackup);
router.delete('/backups/:fileName', systemController.removeBackup);
router.get('/settings', systemController.getSettings);
router.put('/settings', systemController.updateSettings);

// 回收站（V1.3）
router.get('/recycle-bin', systemController.getRecycleBin);
router.post('/recycle-bin/restore', systemController.restoreRecycleBinItem);
router.delete('/recycle-bin/:model/:id', systemController.permanentlyDeleteRecycleBinItem);
router.delete('/recycle-bin/empty', systemController.emptyRecycleBin);

// 首页三栏数据聚合（V1.3）
router.get('/home-summary', systemController.getHomeSummary);
router.post('/home-recommend', systemController.autoRecommendVault);

export default router;

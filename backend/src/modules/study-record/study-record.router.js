/**
 * 学习记录模块 - Router 路由
 */
import { Router } from 'express';
import studyRecordController from './study-record.controller.js';

const router = Router();

router.get('/', studyRecordController.list);
router.get('/stats', studyRecordController.getStats);
router.get('/:id', studyRecordController.getById);
router.post('/', studyRecordController.create);
router.put('/:id', studyRecordController.update);
router.delete('/:id', studyRecordController.remove);

export default router;

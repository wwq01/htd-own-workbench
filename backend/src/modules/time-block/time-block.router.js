/**
 * 时间块模块 - Router 路由
 */
import { Router } from 'express';
import timeBlockController from './time-block.controller.js';

const router = Router();

// 注意：/stats、/start 需在 /:id 之前注册，避免被 /:id 捕获
router.get('/', timeBlockController.list);
router.get('/stats', timeBlockController.getStats);
router.get('/:id', timeBlockController.getById);
router.post('/', timeBlockController.create);
router.post('/start', timeBlockController.start);
router.post('/:id/stop', timeBlockController.stop);
router.put('/:id', timeBlockController.update);
router.delete('/:id', timeBlockController.remove);

export default router;

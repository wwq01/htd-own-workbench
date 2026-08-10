/**
 * 待学清单模块 - Router 路由
 */
import { Router } from 'express';
import studyPendingController from './study-pending.controller.js';

const router = Router();

router.get('/', studyPendingController.list);
router.get('/:id', studyPendingController.getById);
router.post('/', studyPendingController.create);
router.post('/:id/complete', studyPendingController.complete);
router.put('/:id', studyPendingController.update);
router.delete('/:id', studyPendingController.remove);

export default router;

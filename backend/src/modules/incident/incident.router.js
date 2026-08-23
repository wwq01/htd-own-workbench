/**
 * 应急响应记录模块 - Router 路由
 */
import { Router } from 'express';
import incidentController from './incident.controller.js';

const router = Router();

router.get('/', incidentController.list);
router.get('/:id', incidentController.getById);
router.post('/', incidentController.create);
router.put('/:id', incidentController.update);
router.delete('/:id', incidentController.remove);
router.patch('/:id/status', incidentController.changeStatus);
router.post('/:id/timeline', incidentController.addTimeline);
router.post('/:id/actions', incidentController.addActions);

export default router;

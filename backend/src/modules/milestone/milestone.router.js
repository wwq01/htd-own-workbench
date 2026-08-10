/**
 * 项目里程碑模块 - Router 路由
 */
import { Router } from 'express';
import milestoneController from './milestone.controller.js';

const router = Router();

router.get('/', milestoneController.list);
router.post('/', milestoneController.create);
router.put('/:id', milestoneController.update);
router.delete('/:id', milestoneController.remove);
router.post('/:id/toggle', milestoneController.toggleStatus);

export default router;

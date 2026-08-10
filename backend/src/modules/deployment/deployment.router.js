/**
 * 部署记录模块 - Router 路由
 */
import { Router } from 'express';
import deploymentController from './deployment.controller.js';

const router = Router();

router.get('/env-stats', deploymentController.envStats);
router.get('/', deploymentController.list);
router.get('/:id', deploymentController.getById);
router.post('/', deploymentController.create);
router.put('/:id', deploymentController.update);
router.delete('/:id', deploymentController.remove);

export default router;

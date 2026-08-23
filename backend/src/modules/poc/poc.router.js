/**
 * POC 跟踪模块 - Router 路由
 */
import { Router } from 'express';
import pocController from './poc.controller.js';

const router = Router();

router.get('/', pocController.list);
router.get('/:id', pocController.getById);
router.post('/', pocController.create);
router.put('/:id', pocController.update);
router.delete('/:id', pocController.remove);
router.patch('/:id/status', pocController.changeStatus);

export default router;

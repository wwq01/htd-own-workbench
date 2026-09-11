/**
 * 阅读 / 资料模块 - Router 路由
 */
import { Router } from 'express';
import readingController from './reading.controller.js';

const router = Router();

router.get('/', readingController.list);
router.get('/:id', readingController.getById);
router.post('/', readingController.create);
router.put('/:id', readingController.update);
router.delete('/:id', readingController.remove);
router.patch('/:id/status', readingController.changeStatus);
router.post('/:id/convert-to-vault', readingController.convertToVault);

export default router;

/**
 * 凭据保险箱模块 - Router 路由
 */
import { Router } from 'express';
import secretController from './secret.controller.js';

const router = Router();

router.get('/type-stats', secretController.typeStats);
router.get('/', secretController.list);
router.get('/:id', secretController.getById);
router.post('/', secretController.create);
router.put('/:id', secretController.update);
router.delete('/:id', secretController.remove);

export default router;

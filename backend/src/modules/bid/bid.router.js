/**
 * 投标档案模块 - Router 路由
 */
import { Router } from 'express';
import bidController from './bid.controller.js';

const router = Router();

router.get('/', bidController.list);
router.get('/:id', bidController.getById);
router.post('/', bidController.create);
router.put('/:id', bidController.update);
router.delete('/:id', bidController.remove);
router.patch('/:id/status', bidController.changeStatus);

export default router;

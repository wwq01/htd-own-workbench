/**
 * S2-4 双轨笔记模块 - Router 路由
 */
import { Router } from 'express';
import noteController from './note.controller.js';

const router = Router();

router.get('/', noteController.list);
router.get('/:id', noteController.getById);
router.post('/', noteController.create);
router.put('/:id', noteController.update);
router.delete('/:id', noteController.delete);

export default router;

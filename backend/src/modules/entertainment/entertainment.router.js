/**
 * 娱乐内容模块 - Router 路由
 */
import { Router } from 'express';
import entertainmentController from './entertainment.controller.js';

const router = Router();

router.get('/recommend', entertainmentController.recommend);
router.get('/status-stats', entertainmentController.statusStats);
router.get('/', entertainmentController.list);
router.get('/:id', entertainmentController.getById);
router.post('/', entertainmentController.create);
router.put('/:id', entertainmentController.update);
router.delete('/:id', entertainmentController.remove);

export default router;

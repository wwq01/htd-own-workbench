/**
 * 复盘模块 - Router 路由
 */
import { Router } from 'express';
import reviewController from './review.controller.js';

const router = Router();

router.get('/', reviewController.list);
router.get('/:id', reviewController.getById);
router.post('/', reviewController.create);
router.post('/current-week', reviewController.createCurrentWeek);
router.put('/:id', reviewController.update);
router.delete('/:id', reviewController.remove);

export default router;

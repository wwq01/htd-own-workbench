/**
 * 项目模块 - Router 路由
 */
import { Router } from 'express';
import projectController from './project.controller.js';

const router = Router();

router.get('/', projectController.list);
router.get('/:id', projectController.getById);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.patch('/:id/memo', projectController.updateMemo);
router.delete('/:id', projectController.remove);
router.post('/:id/generate-review', projectController.generateReview);

export default router;

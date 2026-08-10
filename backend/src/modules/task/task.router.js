/**
 * 项目任务模块 - Router 路由
 */
import { Router } from 'express';
import taskController from './task.controller.js';

const router = Router();

router.get('/', taskController.list);
router.post('/', taskController.create);
router.put('/:id', taskController.update);
router.delete('/:id', taskController.remove);
router.post('/:id/toggle', taskController.toggleStatus);

export default router;

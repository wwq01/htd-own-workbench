/**
 * 开发项目模块 - Router 路由
 */
import { Router } from 'express';
import devProjectController from './dev-project.controller.js';

const router = Router();

router.get('/', devProjectController.list);
router.get('/:id', devProjectController.getById);
router.post('/', devProjectController.create);
router.put('/:id', devProjectController.update);
router.delete('/:id', devProjectController.remove);

export default router;

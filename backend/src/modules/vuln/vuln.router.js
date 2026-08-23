/**
 * 漏洞跟踪库模块 - Router 路由
 */
import { Router } from 'express';
import vulnController from './vuln.controller.js';

const router = Router();

router.get('/', vulnController.list);
router.get('/:id', vulnController.getById);
router.post('/', vulnController.create);
router.put('/:id', vulnController.update);
router.delete('/:id', vulnController.remove);
router.patch('/:id/status', vulnController.changeStatus);

export default router;

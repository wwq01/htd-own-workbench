/**
 * 开发问题模块 - Router 路由
 */
import { Router } from 'express';
import devIssueController from './dev-issue.controller.js';

const router = Router();

router.get('/', devIssueController.list);
router.get('/:id', devIssueController.getById);
router.post('/', devIssueController.create);
router.put('/:id', devIssueController.update);
router.delete('/:id', devIssueController.remove);

export default router;

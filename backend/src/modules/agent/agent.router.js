/**
 * 本地 Agent 通道 - Router 路由
 */
import { Router } from 'express';
import agentController from './agent.controller.js';

const router = Router();

router.get('/tasks', agentController.list);
router.get('/skills', agentController.skills);
router.post('/tasks', agentController.create);
router.get('/tasks/:id', agentController.getById);
router.post('/tasks/:id/run', agentController.runNow);
router.delete('/tasks/:id', agentController.remove);

export default router;

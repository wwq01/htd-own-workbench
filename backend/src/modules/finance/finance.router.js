/**
 * 财务收支模块 - Router 路由
 */
import { Router } from 'express';
import financeController from './finance.controller.js';

const router = Router();

router.get('/', financeController.list);
router.get('/summary', financeController.getMonthlySummary);
router.get('/:id', financeController.getById);
router.post('/', financeController.create);
router.put('/:id', financeController.update);
router.delete('/:id', financeController.remove);

export default router;

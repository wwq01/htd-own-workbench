/**
 * S2-5 RFP 条目级应答模块 - Router 路由
 *
 * 注意：/stats 必须声明在 /:id 之前，否则 "stats" 会被当作 id 匹配。
 */
import { Router } from 'express';
import rfpItemController from './rfp.controller.js';

const router = Router();

router.get('/stats', rfpItemController.stats);
router.get('/', rfpItemController.list);
router.get('/:id', rfpItemController.getById);
router.post('/', rfpItemController.create);
router.put('/:id', rfpItemController.update);
router.delete('/:id', rfpItemController.remove);
router.patch('/:id/status', rfpItemController.changeStatus);

export default router;

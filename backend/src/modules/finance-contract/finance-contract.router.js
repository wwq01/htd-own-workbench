/**
 * 合同回款模块 - Router 路由
 */
import { Router } from 'express';
import contractController from './finance-contract.controller.js';

const router = Router();

router.get('/', contractController.list);
router.get('/:id', contractController.getById);
router.post('/', contractController.create);
router.put('/:id', contractController.update);
router.delete('/:id', contractController.remove);
router.post('/:id/nodes/:nodeIndex', contractController.updateNode);

export default router;

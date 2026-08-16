/**
 * 沉淀模块 - Router 路由
 */
import { Router } from 'express';
import vaultController from './vault.controller.js';

const router = Router();

router.get('/', vaultController.list);
router.get('/:id', vaultController.getById);
router.post('/', vaultController.create);
router.put('/:id', vaultController.update);
router.delete('/:id', vaultController.delete);

export default router;

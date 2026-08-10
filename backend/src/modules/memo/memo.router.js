/**
 * 备忘模块 - Router 路由
 */
import { Router } from 'express';
import memoController from './memo.controller.js';

const router = Router();

router.get('/', memoController.list);
router.get('/recent', memoController.listRecent);
router.get('/:id', memoController.getById);
router.post('/', memoController.create);
router.put('/:id', memoController.update);
router.delete('/:id', memoController.remove);

export default router;

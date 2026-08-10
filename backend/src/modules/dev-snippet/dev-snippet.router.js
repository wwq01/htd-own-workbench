/**
 * 代码片段模块 - Router 路由
 */
import { Router } from 'express';
import devSnippetController from './dev-snippet.controller.js';

const router = Router();

router.get('/', devSnippetController.list);
router.get('/categories', devSnippetController.getCategories);
router.get('/:id', devSnippetController.getById);
router.post('/', devSnippetController.create);
router.put('/:id', devSnippetController.update);
router.delete('/:id', devSnippetController.remove);

export default router;

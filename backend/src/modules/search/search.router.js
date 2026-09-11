/**
 * 全文搜索模块 - Router 路由
 */
import { Router } from 'express';
import searchController from './search.controller.js';

const router = Router();

router.get('/', searchController.search);

export default router;

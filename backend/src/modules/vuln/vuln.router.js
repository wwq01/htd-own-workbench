/**
 * 漏洞跟踪库模块 - Router 路由
 */
import { Router } from 'express';
import vulnController from './vuln.controller.js';

const router = Router();

router.get('/', vulnController.list);
// S1-5：资产分组路由必须置于 '/:id' 之前，否则 'asset-groups' 会被当作 id 匹配
router.get('/asset-groups', vulnController.getAssetGroups);
router.put('/asset-groups', vulnController.saveAssetGroups);
router.get('/:id', vulnController.getById);
router.post('/', vulnController.create);
router.put('/:id', vulnController.update);
router.delete('/:id', vulnController.remove);
router.patch('/:id/status', vulnController.changeStatus);

export default router;

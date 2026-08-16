/**
 * 会议模块 - Router 路由
 * 挂载前缀 /api/v1/meetings 在别处统一注册，此处不挂载。
 */
import { Router } from 'express';
import meetingController from './meeting.controller.js';

const router = Router();

router.get('/', meetingController.list);
router.get('/:id', meetingController.getById);
router.post('/', meetingController.create);
router.put('/:id', meetingController.update);
router.delete('/:id', meetingController.remove);
router.post('/:id/generate-review', meetingController.generateReview);

export default router;

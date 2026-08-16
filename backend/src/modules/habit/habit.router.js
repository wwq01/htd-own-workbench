/**
 * 习惯打卡模块 - Router 路由
 */
import { Router } from 'express';
import habitController from './habit.controller.js';

const router = Router();

router.get('/', habitController.listHabits);
router.post('/', habitController.createHabit);
router.put('/:id', habitController.updateHabit);
router.delete('/:id', habitController.deleteHabit);
router.post('/:id/checkin', habitController.checkIn);
router.get('/:id/checkins', habitController.listCheckIns);
router.get('/:id/stats', habitController.getStats);

export default router;

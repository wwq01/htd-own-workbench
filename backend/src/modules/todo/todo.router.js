/**
 * 待办模块 - Router 路由
 */
import { Router } from 'express';
import todoController from './todo.controller.js';

const router = Router();

router.get('/', todoController.list);
router.get('/:id', todoController.getById);
router.post('/', todoController.create);
router.put('/:id', todoController.update);
router.delete('/:id', todoController.remove);
router.post('/:id/toggle', todoController.toggleStatus);
router.post('/:id/delay', todoController.delay);
router.post('/:id/status', todoController.changeStatus);
router.post('/migrate/today-to-tomorrow', todoController.migrateTodayToTomorrow);
router.post('/migrate/tomorrow-to-today', todoController.migrateTomorrowToToday);
router.post('/migrate', todoController.migrateCustom);

export default router;

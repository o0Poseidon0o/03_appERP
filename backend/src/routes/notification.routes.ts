import { Router } from 'express';
import { getMyNotifications, markAllAsRead } from '../controllers/notification/notification.controller';
import { protect } from '../middlewares/authMiddleware';

const router = Router();
router.use(protect);

router.get('/', getMyNotifications);
router.patch('/read-all', markAllAsRead);

export default router;
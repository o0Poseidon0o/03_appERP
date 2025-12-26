import { Router } from 'express';
import { getMenus, createMenu, deleteMenu,updateMenu } from '../controllers/notification/menu.controller';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();
router.use(protect);

router.get('/', getMenus); // Ai cũng xem được menu để hiển thị

// Chỉ Admin mới được tạo/xóa menu
router.post('/', restrictTo('ROLE-ADMIN'), createMenu);
router.delete('/:id', restrictTo('ROLE-ADMIN'), deleteMenu);
router.patch('/:id', restrictTo('ROLE-ADMIN'), updateMenu);

export default router;
import { Router } from 'express';
import { getUsers, createUser, updateUser,deleteUser } from '../controllers/users.controller';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect);

// Admin xem danh sách, tạo mới
router.get('/', restrictTo('ROLE-ADMIN', 'ROLE-MANAGER', 'ROLE-USER'), getUsers);
router.post('/', restrictTo('ROLE-ADMIN'), createUser);

// Admin sửa user (theo ID trên URL)
router.patch('/:id', restrictTo('ROLE-ADMIN'), updateUser);

router.delete('/:id', restrictTo('ROLE-ADMIN'), deleteUser);

export default router;
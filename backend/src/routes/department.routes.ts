import { Router } from 'express';
import { getAllDepartments, createDepartment, updateDepartment,deleteDepartment } from '../controllers/department.controller';
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

// Tất cả API dưới đây đều cần đăng nhập
router.use(protect);

router.get('/', restrictTo('ROLE-ADMIN', 'ROLE-MANAGER', 'ROLE-USER'), getAllDepartments); // Ai đăng nhập cũng xem được phòng ban để chọn

// Chỉ Admin mới được Tạo/Sửa
router.post('/', restrictTo('ROLE-ADMIN'), createDepartment);
router.patch('/:id', restrictTo('ROLE-ADMIN'), updateDepartment);
router.delete('/:id', restrictTo('ROLE-ADMIN'), deleteDepartment);

export default router;
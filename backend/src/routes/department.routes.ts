import { Router } from 'express';
import { 
  getAllDepartments, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment 
} from '../controllers/department.controller';
import { protect, hasPermission } from '../middlewares/authMiddleware'; // Đổi restrictTo thành hasPermission

const router = Router();

// Tất cả API dưới đây đều cần đăng nhập
router.use(protect);

// 1. Xem danh sách phòng ban: Kiểm tra mã DEPT_VIEW
// Thay vì liệt kê 3 Roles, hasPermission sẽ tự tìm trong túi quyền của User bất kể họ là Role gì
router.get('/', hasPermission('DEPT_VIEW'), getAllDepartments);

// 2. Tạo phòng ban: Kiểm tra mã DEPT_CREATE
router.post('/', hasPermission('DEPT_CREATE'), createDepartment);

// 3. Cập nhật phòng ban: Kiểm tra mã DEPT_UPDATE
router.patch('/:id', hasPermission('DEPT_UPDATE'), updateDepartment);

// 4. Xóa phòng ban: Kiểm tra mã DEPT_DELETE
router.delete('/:id', hasPermission('DEPT_DELETE'), deleteDepartment);

export default router;
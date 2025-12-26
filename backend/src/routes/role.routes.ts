import { Router } from 'express';
import { 
  getRoles, 
  getAllPermissions, 
  createRole, 
  updateRole, 
  deleteRole 
} from '../controllers/role.controller'; // Đảm bảo đường dẫn import đúng tới file controller của bạn
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

// Tất cả các API dưới đây đều yêu cầu đăng nhập
router.use(protect);

// --- 1. API cho bảng Permission ---
// Frontend gọi: axiosClient.get('/roles/permissions')
// Mục đích: Lấy danh sách để vẽ Checkbox
router.get('/permissions', restrictTo('ROLE-ADMIN'), getAllPermissions);

// --- 2. API cho bảng Role (Kèm xử lý RolePermission bên trong) ---

// Lấy danh sách Role (Frontend gọi: axiosClient.get('/roles'))
router.get('/', restrictTo('ROLE-ADMIN', 'ROLE-MANAGER', 'ROLE-USER'), getRoles);

// Tạo Role mới (Frontend gọi: axiosClient.post('/roles'))
router.post('/', restrictTo('ROLE-ADMIN'), createRole);

// Cập nhật Role & Phân quyền (Frontend gọi: axiosClient.patch('/roles/:id'))
router.patch('/:id', restrictTo('ROLE-ADMIN'), updateRole);

// Xóa Role (Frontend gọi: axiosClient.delete('/roles/:id'))
router.delete('/:id', restrictTo('ROLE-ADMIN'), deleteRole);

export default router;
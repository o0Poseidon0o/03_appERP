import { Router } from 'express';
import { 
  getRoles, 
  getAllPermissions, 
  createRole, 
  updateRole, 
  deleteRole 
} from '../controllers/role.controller';
import { protect, hasPermission } from '../middlewares/authMiddleware';

const router = Router();

// Tất cả API Role đều cần đăng nhập
router.use(protect);

/**
 * 1. LẤY DANH MỤC QUYỀN ĐỂ VẼ CHECKBOX
 * Frontend đang gọi: axiosClient.get('/roles/permissions')
 * Quyền yêu cầu: ROLE_VIEW (User của bạn đã có quyền này nên sẽ thấy được danh sách)
 */
router.get('/permissions', hasPermission('ROLE_VIEW'), getAllPermissions);

/**
 * 2. LẤY DANH SÁCH CÁC VAI TRÒ (ROLES)
 * Quyền yêu cầu: ROLE_VIEW 
 * (Khi sửa thế này, ROLE-USER sẽ không bị chặn 403 nữa)
 */
router.get('/', hasPermission('ROLE_VIEW'), getRoles);

/**
 * 3. TẠO ROLE MỚI
 * Quyền yêu cầu: ROLE_MANAGE (Chỉ Admin mới có mã này trong file Excel của bạn)
 */
router.post('/', hasPermission('ROLE_MANAGE'), createRole);

/**
 * 4. CẬP NHẬT ROLE & MA TRẬN QUYỀN
 * Quyền yêu cầu: ROLE_MANAGE
 */
router.patch('/:id', hasPermission('ROLE_MANAGE'), updateRole);

/**
 * 5. XÓA ROLE
 * Quyền yêu cầu: ROLE_MANAGE
 */
router.delete('/:id', hasPermission('ROLE_MANAGE'), deleteRole);

export default router;
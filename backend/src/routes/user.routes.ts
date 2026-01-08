import { Router } from 'express';
import * as userController from '../controllers/users.controller';
import { protect, hasPermission } from '../middlewares/authMiddleware';

const router = Router();

/**
 * TẤT CẢ ROUTE BÊN DƯỚI ĐỀU YÊU CẦU ĐĂNG NHẬP
 */
router.use(protect);

/**
 * 1. LẤY TẤT CẢ DANH MỤC QUYỀN HỆ THỐNG
 * Mục đích: Hiển thị danh sách Checkbox trong Modal phân quyền ở Frontend
 * Lưu ý: Phải đặt TRÊN các route có tham số :id (như /:id/permissions)
 */
router.get('/permissions/all', hasPermission('USER_VIEW'), userController.getAllAvailablePermissions);

/**
 * 2. LẤY DANH SÁCH NHÂN SỰ
 * Quyền yêu cầu: USER_VIEW
 */
router.get('/', hasPermission('USER_VIEW'), userController.getUsers);

/**
 * 3. TẠO NHÂN SỰ MỚI
 * Quyền yêu cầu: USER_CREATE
 */
router.post('/', hasPermission('USER_CREATE'), userController.createUser);

/**
 * 4. CẬP NHẬT THÔNG TIN CƠ BẢN NHÂN SỰ
 * Quyền yêu cầu: USER_UPDATE (hoặc USER_EDIT tùy bạn đặt trong DB)
 */
router.patch('/:id', hasPermission('USER_UPDATE'), userController.updateUser);

/**
 * 5. CẬP NHẬT QUYỀN HẠN ĐẶC BIỆT (HYBRID PERMISSIONS)
 * Mục đích: Gán hoặc gỡ quyền riêng lẻ cho từng User
 * Quyền yêu cầu: USER_EDIT
 */
router.patch('/:id/permissions', hasPermission('USER_EDIT'), userController.updateUserPermissions);

/**
 * 6. XÓA NHÂN SỰ VĨNH VIỄN
 * Quyền yêu cầu: USER_DELETE
 */
router.delete('/:id', hasPermission('USER_DELETE'), userController.deleteUser);

export default router;
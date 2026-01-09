import { Router } from 'express';
import { 
  getAllFactories, 
  getFactoryById, 
  createFactory, 
  updateFactory, 
  deleteFactory 
} from '../controllers/factoryController';
import { protect, hasPermission } from '../middlewares/authMiddleware'; // Đổi sang hasPermission

const router = Router();

// Tất cả API nhà máy đều yêu cầu đăng nhập
router.use(protect);

/** * LƯU Ý: Dựa trên file permission.xlsx bạn gửi, 
 * hiện chưa có mã FACTORY_VIEW, FACTORY_CREATE...
 * Bạn nên thêm các mã này vào DB hoặc dùng mã DEPT tương ứng.
 */

// 1. Xem danh sách nhà máy: Dùng quyền DEPT_VIEW (hoặc FACTORY_VIEW nếu bạn đã thêm)
router.get('/', hasPermission('DEPT_VIEW'), getAllFactories);

// 2. Xem chi tiết nhà máy
router.get('/:id', hasPermission('DEPT_VIEW'), getFactoryById);

// 3. Tạo nhà máy mới: Dùng mã quyền chi tiết
router.post('/', hasPermission('DEPT_CREATE'), createFactory);

// 4. Cập nhật nhà máy
router.patch('/:id', hasPermission('DEPT_UPDATE'), updateFactory);

// 5. Xóa nhà máy
router.delete('/:id', hasPermission('DEPT_DELETE'), deleteFactory);

export default router;
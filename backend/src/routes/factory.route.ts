import { Router } from 'express';
import { 
  getAllFactories, 
  getFactoryById, 
  createFactory, 
  updateFactory, 
  deleteFactory 
} from '../controllers/factoryController';
import { protect, hasPermission } from '../middlewares/authMiddleware';

const router = Router();

// Yêu cầu đăng nhập cho mọi thao tác
router.use(protect);

// ==============================================================================
// 1. Xem danh sách nhà máy
// [ĐIỀU CHỈNH]: Chỉ cần đăng nhập là xem được danh sách (để phục vụ dropdown cho các module khác)
// Nếu bạn muốn bảo mật tuyệt đối, hãy giữ hasPermission('FACTORY_VIEW') và nhớ cấp quyền này cho ROLE-KHO
// ==============================================================================
router.get('/', getAllFactories);

// 2. Xem chi tiết một nhà máy (Kèm thông tin nhạy cảm hơn nếu có)
router.get('/:id', hasPermission('FACTORY_VIEW'), getFactoryById);

// 3. Tạo nhà máy mới - Chỉ ADMIN hoặc Quản lý cấp cao
router.post('/', hasPermission('FACTORY_CREATE'), createFactory);

// 4. Cập nhật thông tin - Chỉ ADMIN hoặc Quản lý cấp cao
router.patch('/:id', hasPermission('FACTORY_UPDATE'), updateFactory);

// 5. Xóa nhà máy - Chỉ ADMIN
router.delete('/:id', hasPermission('FACTORY_DELETE'), deleteFactory);

export default router;
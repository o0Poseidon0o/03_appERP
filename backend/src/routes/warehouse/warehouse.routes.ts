import { Router } from 'express';
import { 
  createWarehouse, 
  getAllWarehouses, 
  addLocation, 
  deleteWarehouse, 
  updateWarehouse, 
  getAllLocations,
  deleteLocation,
  updateLocation
} from '../../controllers/warehouse/warehouse.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = Router();

router.use(protect);

// 1. Xem kho: Chỉ cần quyền VIEW (hoặc mặc định đăng nhập là được xem tùy chính sách)
router.get('/', hasPermission('WMS_VIEW'), getAllWarehouses);
router.get('/locations/all', hasPermission('WMS_VIEW'), getAllLocations);
// 2. Thêm mới: Tách riêng quyền CREATE
router.post('/', hasPermission('WMS_CREATE'), createWarehouse);
router.post('/location', hasPermission('WMS_CREATE'), addLocation);

// 3. Chỉnh sửa: Quyền UPDATE
router.patch('/:id', hasPermission('WMS_UPDATE'), updateWarehouse);

// 4. Xóa: Quyền DELETE (Chỉ cấp cho Admin/Manager)
router.delete('/:id', hasPermission('WMS_DELETE'), deleteWarehouse);
// Route Xóa Vị trí
router.delete('/location/:id', hasPermission('WMS_DELETE'), deleteLocation);
// Dùng quyền WMS_UPDATE (Sửa kho) để sửa vị trí
router.patch('/location/:id', hasPermission('WMS_UPDATE'), updateLocation);

export default router;
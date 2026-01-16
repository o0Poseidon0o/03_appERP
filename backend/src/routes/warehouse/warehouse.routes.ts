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
// Import controller báo cáo
import { getMonthlyStockReport } from '../../controllers/warehouse/report.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = Router();

// Yêu cầu đăng nhập cho tất cả các route bên dưới
router.use(protect);

// ==========================================
// A. CÁC ROUTE BÁO CÁO & DANH SÁCH (STATIC)
// ==========================================
// [QUAN TRỌNG] Đặt các route này lên đầu để tránh bị nhận nhầm là :id

// 1. Báo cáo tồn kho theo tháng (Excel)
router.get('/reports/monthly-stock', hasPermission('WMS_VIEW'), getMonthlyStockReport);

// 2. Xem danh sách kho
router.get('/', hasPermission('WMS_VIEW'), getAllWarehouses);

// 3. Xem danh sách tất cả vị trí (Location)
router.get('/locations/all', hasPermission('WMS_VIEW'), getAllLocations);

// ==========================================
// B. CÁC ROUTE THÊM MỚI (POST)
// ==========================================
// Thêm Kho mới
router.post('/', hasPermission('WMS_CREATE'), createWarehouse);

// Thêm Vị trí (Bin) mới
router.post('/location', hasPermission('WMS_CREATE'), addLocation);

// ==========================================
// C. CÁC ROUTE THAO TÁC THEO ID (DYNAMIC)
// ==========================================

// --- Xử lý Vị trí (Location) ---
// Sửa vị trí
router.patch('/location/:id', hasPermission('WMS_UPDATE'), updateLocation);
// Xóa vị trí
router.delete('/location/:id', hasPermission('WMS_DELETE'), deleteLocation);

// --- Xử lý Kho (Warehouse) ---
// Sửa thông tin kho
router.patch('/:id', hasPermission('WMS_UPDATE'), updateWarehouse);
// Xóa kho
router.delete('/:id', hasPermission('WMS_DELETE'), deleteWarehouse);

export default router;
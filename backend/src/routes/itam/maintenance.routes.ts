import express from 'express';
import { 
    getAssetMaintenanceHistory, 
    createMaintenanceLog, 
    completeMaintenanceLog 
} from '../../controllers/itam/maintenance.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = express.Router();

// ==========================================
// BẢO VỆ ROUTE (Yêu cầu đăng nhập)
// ==========================================
router.use(protect);

// GET /api/maintenance/:assetId -> Lấy lịch sử (Chỉ cần quyền Xem tài sản)
router.get('/:assetId', hasPermission('ITAM_ASSET_VIEW'), getAssetMaintenanceHistory);

// POST /api/maintenance -> Tạo phiếu mới (Cần quyền Quản lý Bảo trì)
router.post('/', hasPermission('ITAM_MAINTENANCE'), createMaintenanceLog);

// PATCH /api/maintenance/:id/complete -> Báo sửa xong (Cần quyền Quản lý Bảo trì)
router.patch('/:id/complete', hasPermission('ITAM_MAINTENANCE'), completeMaintenanceLog);

export default router;
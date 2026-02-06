import express from 'express';
import { 
    getAssetMaintenanceHistory, 
    createMaintenanceLog, 
    completeMaintenanceLog 
} from '../../controllers/itam/maintenance.controller';

const router = express.Router();

// GET /api/maintenance/:assetId -> Lấy lịch sử của 1 máy
router.get('/:assetId', getAssetMaintenanceHistory);

// POST /api/maintenance -> Tạo phiếu mới (Máy chuyển sang màu đỏ REPAIR)
router.post('/', createMaintenanceLog);

// PATCH /api/maintenance/:id/complete -> Báo đã sửa xong (Máy chuyển sang màu xanh IN_USE)
router.patch('/:id/complete', completeMaintenanceLog);

export default router;
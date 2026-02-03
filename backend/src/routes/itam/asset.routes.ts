import express from 'express';
import { syncAssetAgent, getAllAssets, deleteAsset, updateAsset, getAssetById, createAsset } from '../../controllers/itam/asset.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';
// (Lưu ý: Chỉnh lại đường dẫn import bên trên cho đúng vị trí file controller của bạn)

const router = express.Router();

// ==========================================
// ĐỊNH NGHĨA CÁC API CHO ITAM (ASSET)
// ==========================================

// 1. API nhận dữ liệu từ PowerShell Agent
// URL đầy đủ sẽ là: POST /api/assets/sync
router.post('/sync',syncAssetAgent);

// Sau này bạn có thể thêm các route khác ở đây, ví dụ:
// router.get('/', getAllAssets); // Lấy danh sách máy
// router.get('/:id', getAssetDetail); // Xem chi tiết 1 máy
router.get('/', getAllAssets);

router.get('/', getAllAssets);           // Lấy danh sách
router.post('/', createAsset);           // Tạo mới (POST /api/assets)
router.get('/:id', getAssetById);        // Xem chi tiết (GET /api/assets/uuid-123)
router.patch('/:id', updateAsset);       // Cập nhật (PATCH /api/assets/uuid-123)
router.delete('/:id', deleteAsset);      // Xóa (DELETE /api/assets/uuid-123)
export default router;
import express from 'express';
import { 
    getAssetTypes, 
    createAssetType, 
    updateAssetType, 
    deleteAssetType, 
    seedAssetTypes 
} from '../../controllers/itam/assetType.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = express.Router();

// ==========================================
// BẢO VỆ ROUTE (Yêu cầu đăng nhập)
// ==========================================
router.use(protect);

// GET /api/asset-types -> Lấy danh sách (Cần quyền Xem)
router.get('/', hasPermission('ITAM_ASSET_VIEW'), getAssetTypes);

// POST /api/asset-types -> Tạo mới loại tài sản (Cần quyền Tạo)
router.post('/', hasPermission('ITAM_ASSET_CREATE'), createAssetType);

// PATCH /api/asset-types/:id -> Cập nhật (Cần quyền Cập nhật)
router.patch('/:id', hasPermission('ITAM_ASSET_UPDATE'), updateAssetType);

// DELETE /api/asset-types/:id -> Xóa (Cần quyền Xóa)
router.delete('/:id', hasPermission('ITAM_ASSET_DELETE'), deleteAssetType);

// POST /api/asset-types/seed -> Reset/Init data (Cần quyền Tạo - thường dành cho Admin lúc setup)
router.post('/seed', hasPermission('ITAM_ASSET_CREATE'), seedAssetTypes);

export default router;
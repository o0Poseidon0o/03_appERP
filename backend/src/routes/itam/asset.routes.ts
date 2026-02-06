import express from 'express';
import { 
    syncAssetAgent, 
    getAllAssets, 
    deleteAsset, 
    updateAsset, 
    getAssetById, 
    createAsset 
} from '../../controllers/itam/asset.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = express.Router();

// ==========================================
// 1. PUBLIC ROUTE (Dùng API Key riêng)
// ==========================================
// Route này dành cho PowerShell Agent gửi dữ liệu lên, không cần login User
// Bảo mật bằng x-api-key trong header (đã check trong controller)
router.post('/sync', syncAssetAgent);


// ==========================================
// 2. PROTECTED ROUTES (Cần Login)
// ==========================================
// Áp dụng middleware protect cho tất cả các route bên dưới
router.use(protect);

// --- Xem danh sách & Chi tiết (Cần quyền VIEW) ---
router.get('/', hasPermission('ITAM_ASSET_VIEW'), getAllAssets);
router.get('/:id', hasPermission('ITAM_ASSET_VIEW'), getAssetById);

// --- Tạo mới (Cần quyền CREATE) ---
router.post('/', hasPermission('ITAM_ASSET_CREATE'), createAsset);

// --- Cập nhật (Cần quyền UPDATE) ---
router.patch('/:id', hasPermission('ITAM_ASSET_UPDATE'), updateAsset);

// --- Xóa (Cần quyền DELETE) ---
router.delete('/:id', hasPermission('ITAM_ASSET_DELETE'), deleteAsset);

export default router;
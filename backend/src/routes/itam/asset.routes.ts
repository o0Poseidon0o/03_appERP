import express from 'express';
import { 
    syncAssetAgent, 
    getAllAssets, 
    deleteAsset, 
    updateAsset, 
    getAssetById, 
    createAsset,
    getMyAssets,
    getPublicAssetByQrCode
} from '../../controllers/itam/asset.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';
import { verifyAgentSecret } from '../../middlewares/agentAuthMiddleware';

const router = express.Router();

// ==========================================
// 1. AGENT SYNC ROUTE & PUBLIC QR LOOKUP
// ==========================================
// Route này dành cho PowerShell Agent gửi dữ liệu lên, không cần login User
router.post('/sync', verifyAgentSecret, syncAssetAgent);
router.post('/sync-agent', verifyAgentSecret, syncAssetAgent);

// Route tra cứu thông tin máy + phần mềm khi người dùng quét mã QR bằng điện thoại
router.get('/public-qr/:code', getPublicAssetByQrCode);


// ==========================================
// 2. PROTECTED ROUTES (Cần Login)
// ==========================================
// Áp dụng middleware protect cho tất cả các route bên dưới
router.use(protect);


router.get('/my-assets', getMyAssets);
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
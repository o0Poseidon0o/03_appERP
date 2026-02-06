import express from 'express';
import { 
    getAssetTypes, 
    createAssetType, 
    updateAssetType, 
    deleteAssetType, 
    seedAssetTypes 
} from '../../controllers/itam/assetType.controller';

const router = express.Router();

// GET /api/asset-types -> Lấy danh sách
router.get('/', getAssetTypes);

// POST /api/asset-types -> Tạo mới
router.post('/', createAssetType);

// PATCH /api/asset-types/:id -> Cập nhật
router.patch('/:id', updateAssetType);

// DELETE /api/asset-types/:id -> Xóa
router.delete('/:id', deleteAssetType);

// POST /api/asset-types/seed -> Reset/Init data
router.post('/seed', seedAssetTypes);

export default router;
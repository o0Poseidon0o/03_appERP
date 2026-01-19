import { Router } from 'express';
import { 
    // Item Controller
    createItem, 
    deleteItem, 
    searchItems, 
    updateItem, 
    
    // [MỚI] Controller cho Unit Conversion
    addConversionUnit,
    deleteConversionUnit,

    // Category Controller
    getAllCategories, 
    createCategory, 
    updateCategory, 
    deleteCategory,

    // Usage Category Controller
    getAllUsageCategories,
    createUsageCategory,
    updateUsageCategory,
    deleteUsageCategory,
    importUsageCategories,
    importItemsBulk
} from '../../controllers/warehouse/item.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = Router();

// Yêu cầu đăng nhập cho toàn bộ routes
router.use(protect);

// ==========================================
// 1. ROUTES CHO NHÓM VẬT TƯ (CATEGORY)
// ==========================================
router.get('/categories', getAllCategories);
router.post('/categories', hasPermission('ITEM_CREATE'), createCategory);
router.patch('/categories/:id', hasPermission('ITEM_UPDATE'), updateCategory);
router.delete('/categories/:id', hasPermission('ITEM_DELETE'), deleteCategory);

// ==========================================
// 2. ROUTES CHO LOẠI HÀNG SỬ DỤNG (USAGE CATEGORY)
// ==========================================
router.get('/usage-categories', getAllUsageCategories);

// Import hàng loạt
router.post('/usage-categories/import', hasPermission('ITEM_CREATE'), importUsageCategories);

// CRUD
router.post('/usage-categories', hasPermission('ITEM_CREATE'), createUsageCategory);
router.patch('/usage-categories/:id', hasPermission('ITEM_UPDATE'), updateUsageCategory);
router.delete('/usage-categories/:id', hasPermission('ITEM_DELETE'), deleteUsageCategory);

// ==========================================
// 3. ROUTES CHO VẬT TƯ (ITEM)
// ==========================================
// Tìm kiếm & Lấy danh sách
router.get('/', searchItems); 
router.get('/search', searchItems); 
router.post('/import-bulk', hasPermission('ITEM_CREATE'), importItemsBulk);
// CRUD Vật tư
router.post('/', hasPermission('ITEM_CREATE'), createItem);
router.patch('/:id', hasPermission('ITEM_UPDATE'), updateItem);
router.delete('/:id', hasPermission('ITEM_DELETE'), deleteItem);

// ==========================================
// 4. ROUTES CHO ĐƠN VỊ QUY ĐỔI (UNIT CONVERSION) - [MỚI]
// ==========================================
// Thêm đơn vị quy đổi mới cho một vật tư cụ thể (VD: Thêm "Thùng" cho "Ốc A")
// Dùng quyền ITEM_UPDATE vì đây là hành động chỉnh sửa cấu hình vật tư
router.post('/:itemId/conversions', hasPermission('ITEM_UPDATE'), addConversionUnit);

// Xóa một đơn vị quy đổi
router.delete('/conversions/:conversionId', hasPermission('ITEM_UPDATE'), deleteConversionUnit);

export default router;
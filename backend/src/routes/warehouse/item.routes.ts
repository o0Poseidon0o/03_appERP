import { Router } from 'express';
import { 
    // Item Controller
    createItem, 
    deleteItem, 
    searchItems, 
    updateItem, 
    
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
    importUsageCategories
} from '../../controllers/warehouse/item.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = Router();

// Yêu cầu đăng nhập
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
router.get('/', searchItems); 
router.get('/search', searchItems); 

router.post('/', hasPermission('ITEM_CREATE'), createItem);
router.patch('/:id', hasPermission('ITEM_UPDATE'), updateItem);
router.delete('/:id', hasPermission('ITEM_DELETE'), deleteItem);

export default router;
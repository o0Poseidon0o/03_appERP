import { Router } from 'express';
import { createItem, deleteItem, searchItems, updateItem, getAllCategories, createCategory, updateCategory, deleteCategory } from '../../controllers/warehouse/item.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = Router();

router.use(protect);


// --- Routes cho Category ---
router.get('/categories', getAllCategories);
router.post('/categories', hasPermission('ITEM_CREATE'), createCategory);
router.patch('/categories/:id', hasPermission('ITEM_UPDATE'), updateCategory);
router.delete('/categories/:id', hasPermission('ITEM_DELETE'), deleteCategory);

router.get('/search', searchItems); // Ai đăng nhập cũng được tìm kiếm để xem tồn kho
router.post('/', hasPermission('ITEM_CREATE'), createItem);
// Thêm route Sửa và Xóa
router.patch('/:id', hasPermission('ITEM_UPDATE'), updateItem);
router.delete('/:id', hasPermission('ITEM_DELETE'), deleteItem);

export default router;
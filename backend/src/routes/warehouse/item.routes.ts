import { Router } from 'express';
import { createItem, deleteItem, searchItems, updateItem, } from '../../controllers/warehouse/item.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = Router();

router.use(protect);

router.get('/search', searchItems); // Ai đăng nhập cũng được tìm kiếm để xem tồn kho
router.post('/', hasPermission('ITEM_CREATE'), createItem);
// Thêm route Sửa và Xóa
router.patch('/:id', hasPermission('ITEM_UPDATE'), updateItem);
router.delete('/:id', hasPermission('ITEM_DELETE'), deleteItem);

export default router;
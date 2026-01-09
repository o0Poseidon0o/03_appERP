import { Router } from 'express';
import { 
    createPost, 
    getMyPosts, 
    getPostDetail, 
    updatePost, 
    deletePost 
} from '../controllers/notification/post.controller';
import { protect, hasPermission } from '../middlewares/authMiddleware'; // Đổi sang hasPermission

const router = Router();

// Tất cả các route dưới đây đều cần đăng nhập
router.use(protect); 

// 1. Xem danh sách & Chi tiết
// Sử dụng mã POST_VIEW để đảm cả quyền theo Role và quyền gán lẻ đều chạy đúng
router.get('/', hasPermission('POST_VIEW'), getMyPosts);
router.get('/:id', hasPermission('POST_VIEW'), getPostDetail);

// 2. Các chức năng Quản lý
// Thay vì dùng restrictTo (chặn cứng Role), dùng hasPermission để check "thẻ quyền"
router.post('/', hasPermission('POST_CREATE'), createPost);
router.patch('/:id', hasPermission('POST_EDIT'), updatePost); 
router.delete('/:id', hasPermission('POST_DELETE'), deletePost); 

export default router;
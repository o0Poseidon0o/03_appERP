import { Router } from 'express';
import { 
    createPost, 
    getMyPosts, 
    getPostDetail, 
    updatePost, 
    deletePost 
} from '../controllers/notification/post.controller'; // Đảm bảo đường dẫn đúng tới controller
import { protect, restrictTo } from '../middlewares/authMiddleware';

const router = Router();

// Middleware bảo vệ: Tất cả các route dưới đây đều cần đăng nhập
router.use(protect); 

// 1. Xem danh sách & Chi tiết (Ai cũng xem được nếu đã login)
router.get('/', getMyPosts);
router.get('/:id', getPostDetail);

// 2. Các chức năng Quản lý (Chỉ Admin/Manager)
router.post('/', restrictTo('ROLE-ADMIN', 'ROLE-MANAGER'), createPost);
router.patch('/:id', restrictTo('ROLE-ADMIN', 'ROLE-MANAGER'), updatePost); 
router.delete('/:id', restrictTo('ROLE-ADMIN', 'ROLE-MANAGER'), deletePost); 

export default router;
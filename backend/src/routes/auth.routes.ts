import { Router } from 'express';
import { login, forgotPassword, changePassword } from '../controllers/auth.controller';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);

// Cần đăng nhập mới đổi pass được -> Thêm protect vào giữa
router.post('/change-password', protect, changePassword);

export default router;
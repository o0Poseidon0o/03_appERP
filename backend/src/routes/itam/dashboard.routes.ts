import express from 'express';
import { getDashboardStats } from '../../controllers/itam/dashboard.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = express.Router();

// ==========================================
// BẢO VỆ ROUTE (Yêu cầu đăng nhập)
// ==========================================
router.use(protect);

// GET /api/dashboard/stats -> Lấy thống kê (Cần quyền Xem Dashboard)
router.get('/stats', hasPermission('ITAM_DASHBOARD'), getDashboardStats);

export default router;
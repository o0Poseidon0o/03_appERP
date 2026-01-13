import { Router } from 'express';
import { 
  createTransaction, 
  approveStep, 
  getMyPendingApprovals, 
  checkStock,
  getStockActual, // <--- Import thêm hàm này
  getTransactionHistory
} from '../../controllers/warehouse/stockTransaction.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = Router();

// Bắt buộc phải đăng nhập mới dùng được các chức năng này
router.use(protect);

// 1. TẠO PHIẾU
router.post('/', createTransaction);

// 2. QUY TRÌNH PHÊ DUYỆT & DANH SÁCH
router.get('/pending-my-turn', getMyPendingApprovals);
router.patch('/approve-action', approveStep);

// 3. TIỆN ÍCH & TRA CỨU
router.get('/check-stock', hasPermission('WMS_VIEW'), checkStock);

// [MỚI] API cho trang Stock Actual (Tồn kho thực tế)
// Route này sẽ là: /api/stock-transactions/actual (Nếu app.ts mount ở path đó)
// Thường thì nên để quyền WMS_VIEW hoặc ai cũng xem được tùy bạn
router.get('/actual', hasPermission('WMS_VIEW'), getStockActual);
router.get('/history', protect, hasPermission('WMS_VIEW'), getTransactionHistory);

export default router;
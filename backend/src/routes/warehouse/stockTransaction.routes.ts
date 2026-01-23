import { Router } from 'express';
import { 
  // createTransaction,      <-- KHÓA: Đã chuyển sang Ticket
  // approveStep,            <-- KHÓA: Đã chuyển sang Ticket
  // getMyPendingApprovals,  <-- KHÓA: Đã chuyển sang Ticket
  checkStock,
  getStockActual,
  getTransactionHistory
} from '../../controllers/warehouse/stockTransaction.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = Router();

// Bắt buộc phải đăng nhập mới dùng được các chức năng này
router.use(protect);

// ==================================================================
// 1. NHÓM API QUY TRÌNH DUYỆT (WORKFLOW) -> [ĐÃ KHÓA]
// ==================================================================
// Lý do: Đã chuyển sang dùng Generic Workflow Engine tại: /api/tickets

// router.get('/pending-my-turn', getMyPendingApprovals); 
// --> Thay thế bằng: GET /api/tickets/pending

// router.post('/approve-step', approveStep); 
// --> Thay thế bằng: POST /api/tickets/:ticketId/approve


// ==================================================================
// 2. NHÓM API TRA CỨU & TIỆN ÍCH (CÓ CHECK QUYỀN) -> [GIỮ NGUYÊN]
// ==================================================================
// Lý do: Đây là các nghiệp vụ xem báo cáo thuần túy của kho, không ảnh hưởng quy trình duyệt.

// Kiểm tra tồn kho khả dụng
router.get('/check-stock', hasPermission('WMS_VIEW'), checkStock);

// Lấy tồn kho thực tế
router.get('/actual', hasPermission('WMS_VIEW'), getStockActual);

// Lấy lịch sử giao dịch (Danh sách phiếu cũ để xem lại)
router.get('/history', hasPermission('WMS_VIEW'), getTransactionHistory);


// ==================================================================
// 3. TẠO PHIẾU -> [ĐÃ KHÓA]
// ==================================================================
// Lý do: Bảng StockTransaction giờ bắt buộc phải có ticketId. 
// Phải tạo qua API Ticket để sinh ra quy trình duyệt.

// router.post('/', createTransaction);
// --> Thay thế bằng: POST /api/tickets (Kèm body { workflowCode, transactionData... })

export default router;
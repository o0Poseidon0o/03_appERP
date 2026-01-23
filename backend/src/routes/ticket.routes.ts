import { Router } from 'express';
import * as ticketController from '../controllers/ticket.controller';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

/**
 * TẤT CẢ ROUTE BÊN DƯỚI ĐỀU YÊU CẦU ĐĂNG NHẬP
 */
router.use(protect);

/**
 * 1. NHÓM TẠO & TRA CỨU CÁ NHÂN
 */

// Tạo phiếu mới (Kho, Nghỉ phép...)
// [NOTE] Không cần hasPermission('TICKET_CREATE') vì nhân viên nào cũng có nhu cầu tạo phiếu.
// Việc chặn quyền tạo sẽ do logic "allowedInitiatorRoles" trong Workflow config xử lý.
router.post('/', ticketController.createTicket);

// Lấy danh sách "Việc cần làm của tôi" (My Pending Tasks)
// API này quan trọng nhất cho trang Dashboard của user.
router.get('/pending', ticketController.getMyPendingTickets);

/**
 * 2. NHÓM THAO TÁC TRÊN 1 PHIẾU CỤ THỂ
 */

// Xem chi tiết phiếu
// Logic trong controller sẽ check xem User có phải là Creator hoặc Approver không mới cho xem.
router.get('/:id', ticketController.getTicketDetail);

// Hành động: DUYỆT (Approve)
// Dùng method POST vì đây là một Action (có gửi kèm comment), không hẳn là update resource thuần túy.
router.post('/:ticketId/approve', ticketController.approveTicket);

// Hành động: TỪ CHỐI (Reject)
router.post('/:ticketId/reject', ticketController.rejectTicket);

export default router;
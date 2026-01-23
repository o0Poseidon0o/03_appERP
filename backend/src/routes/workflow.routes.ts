import { Router } from 'express';
import * as workflowController from '../controllers/workflow.controller';
import { protect, hasPermission } from '../middlewares/authMiddleware';

const router = Router();

/**
 * TẤT CẢ ROUTE BÊN DƯỚI ĐỀU YÊU CẦU ĐĂNG NHẬP
 */
router.use(protect);

/**
 * 1. LẤY DANH SÁCH QUY TRÌNH
 * [FIX] Bỏ hasPermission('WORKFLOW_VIEW') đi.
 * Lý do: Nhân viên bình thường cũng cần gọi API này để hiển thị Dropdown khi tạo phiếu.
 * Chỉ cần đăng nhập (protect) là xem được.
 */
router.get('/', workflowController.getAllWorkflows);

/**
 * 2. CÁC QUYỀN QUẢN TRỊ (TẠO/SỬA/XÓA) THÌ GIỮ NGUYÊN
 * Chỉ Admin hoặc người có quyền mới được làm.
 */
router.post('/', hasPermission('WORKFLOW_CREATE'), workflowController.createWorkflow);

router.put('/:id', hasPermission('WORKFLOW_UPDATE'), workflowController.updateWorkflow);

router.delete('/:id', hasPermission('WORKFLOW_DELETE'), workflowController.deleteWorkflow);

export default router;
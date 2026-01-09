import { Router } from 'express';
import { createImportTicket,approveImportTicket } from '../../controllers/warehouse/stockTransaction.controller';
import { protect, hasPermission } from '../../middlewares/authMiddleware';

const router = Router();

router.use(protect);

// 1. Nhân viên tạo phiếu (Quyền tạo lệnh nhập)
router.post('/import', hasPermission('WMS_IMPORT_CREATE'), createImportTicket);

// 2. Quản lý phê duyệt (Quyền duyệt lệnh)
router.patch('/approve/:id', hasPermission('WMS_APPROVE'), approveImportTicket);

export default router;
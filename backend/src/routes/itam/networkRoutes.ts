import express from "express";
import { auditDeviceSecurity, scanNetwork } from "../../controllers/itam/networkScanController"; // Kiểm tra đường dẫn import này có đúng không

const router = express.Router();

// Định nghĩa đuôi là /scan
router.post("/scan", scanNetwork);
router.post("/audit", auditDeviceSecurity);

export default router;
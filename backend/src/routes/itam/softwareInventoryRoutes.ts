import express from "express";
import { 
  getSoftwareInventory, 
  getSoftwareInstallations 
} from "../../controllers/itam/softwareInventoryController";

const router = express.Router();

// Route lấy danh sách tổng hợp (Tên + Số lượng)
router.get("/inventory", getSoftwareInventory);

// Route lấy chi tiết (Máy nào + User nào)
router.get("/detail", getSoftwareInstallations);

export default router;
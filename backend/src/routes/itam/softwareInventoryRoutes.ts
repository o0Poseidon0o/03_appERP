import express from "express";
import {
  getSoftwareInventory,
  getSoftwareInstallations,
  exportAllSoftwareInstallations,
  cleanupSoftwareInventory,
  getSoftwarePolicies,
  upsertSoftwarePolicy,
  updateSoftwarePolicy,
  deleteSoftwarePolicy,
  getLicenseKeys,
  createLicenseKey,
  updateLicenseKey,
  deleteLicenseKey,
  assignLicenseKeyToAssets,
  unassignLicenseKeyFromAsset,
} from "../../controllers/itam/softwareInventoryController";

const router = express.Router();

// Route lấy danh sách tổng hợp (Tên + Số lượng + Đối chiếu License/Blacklist)
router.get("/inventory", getSoftwareInventory);

// Route lấy chi tiết (Máy nào + User nào)
router.get("/detail", getSoftwareInstallations);

// Route lấy toàn bộ dữ liệu để xuất báo cáo Excel
router.get("/export-all", exportAllSoftwareInstallations);

// Route chuẩn hóa & dọn dẹp các gói cài đặt phụ trong DB
router.post("/cleanup", cleanupSoftwareInventory);

// Routes Quản lý Chính sách Bản quyền & Phần mềm cấm (SoftwarePolicy)
router.get("/policies", getSoftwarePolicies);
router.post("/policies", upsertSoftwarePolicy);
router.patch("/policies/:id", updateSoftwarePolicy);
router.delete("/policies/:id", deleteSoftwarePolicy);

// Routes Quản lý Key Bản quyền (Kaspersky, Office, AutoCAD, Windows...)
router.get("/keys", getLicenseKeys);
router.post("/keys", createLicenseKey);
router.patch("/keys/:id", updateLicenseKey);
router.delete("/keys/:id", deleteLicenseKey);
router.post("/keys/:id/assign", assignLicenseKeyToAssets);
router.delete("/keys/:id/assign/:assetId", unassignLicenseKeyFromAsset);

export default router;

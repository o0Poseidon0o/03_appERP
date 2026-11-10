import express from "express";
import {
  auditDeviceSecurity,
  scanNetwork,
  importScannedDevices,
} from "../../controllers/itam/networkScanController";

const router = express.Router();

router.post("/scan", scanNetwork);
router.post("/audit", auditDeviceSecurity);
router.post("/import", importScannedDevices);

export default router;

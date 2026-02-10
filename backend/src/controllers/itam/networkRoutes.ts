import express from "express";
import { scanNetwork } from "../../controllers/itam/networkScanController";

const router = express.Router();

// POST /api/itam/network/scan
router.post("/scan", scanNetwork);

export default router;
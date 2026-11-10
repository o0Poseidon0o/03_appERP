"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const networkScanController_1 = require("../../controllers/itam/networkScanController");
const router = express_1.default.Router();
router.post("/scan", networkScanController_1.scanNetwork);
router.post("/audit", networkScanController_1.auditDeviceSecurity);
router.post("/import", networkScanController_1.importScannedDevices);
exports.default = router;

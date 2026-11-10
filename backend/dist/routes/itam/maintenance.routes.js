"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const maintenance_controller_1 = require("../../controllers/itam/maintenance.controller");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const router = express_1.default.Router();
router.use(authMiddleware_1.protect);
router.get('/:assetId', (0, authMiddleware_1.hasPermission)('ITAM_ASSET_VIEW'), maintenance_controller_1.getAssetMaintenanceHistory);
router.post('/', (0, authMiddleware_1.hasPermission)('ITAM_MAINTENANCE'), maintenance_controller_1.createMaintenanceLog);
router.patch('/:id/complete', (0, authMiddleware_1.hasPermission)('ITAM_MAINTENANCE'), maintenance_controller_1.completeMaintenanceLog);
exports.default = router;

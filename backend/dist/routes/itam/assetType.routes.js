"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const assetType_controller_1 = require("../../controllers/itam/assetType.controller");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const router = express_1.default.Router();
router.use(authMiddleware_1.protect);
router.get('/', (0, authMiddleware_1.hasPermission)('ITAM_ASSET_VIEW'), assetType_controller_1.getAssetTypes);
router.post('/', (0, authMiddleware_1.hasPermission)('ITAM_ASSET_CREATE'), assetType_controller_1.createAssetType);
router.patch('/:id', (0, authMiddleware_1.hasPermission)('ITAM_ASSET_UPDATE'), assetType_controller_1.updateAssetType);
router.delete('/:id', (0, authMiddleware_1.hasPermission)('ITAM_ASSET_DELETE'), assetType_controller_1.deleteAssetType);
router.post('/seed', (0, authMiddleware_1.hasPermission)('ITAM_ASSET_CREATE'), assetType_controller_1.seedAssetTypes);
exports.default = router;

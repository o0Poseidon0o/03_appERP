"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeMaintenanceLog = exports.createMaintenanceLog = exports.getAssetMaintenanceHistory = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const getAssetMaintenanceHistory = async (req, res) => {
    try {
        const { assetId } = req.params;
        const history = await prisma_1.default.maintenanceLog.findMany({
            where: { assetId },
            orderBy: { startDate: 'desc' }
        });
        res.status(200).json({ status: "success", data: history });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Lỗi lấy lịch sử sửa chữa" });
    }
};
exports.getAssetMaintenanceHistory = getAssetMaintenanceHistory;
const createMaintenanceLog = async (req, res) => {
    try {
        const { assetId, type, description, providerType, providerName, cost, startDate } = req.body;
        const result = await prisma_1.default.$transaction(async (tx) => {
            const newLog = await tx.maintenanceLog.create({
                data: {
                    assetId,
                    type: type || 'REPAIR',
                    description,
                    providerType,
                    providerName,
                    cost: Number(cost) || 0,
                    startDate: startDate ? new Date(startDate) : new Date(),
                    status: 'IN_PROGRESS'
                }
            });
            await tx.asset.update({
                where: { id: assetId },
                data: { status: 'REPAIR' }
            });
            return newLog;
        });
        res.status(201).json({ status: "success", message: "Đã tạo phiếu sửa chữa", data: result });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Lỗi tạo phiếu sửa chữa" });
    }
};
exports.createMaintenanceLog = createMaintenanceLog;
const completeMaintenanceLog = async (req, res) => {
    try {
        const { id } = req.params;
        const { cost, note } = req.body;
        const existingLog = await prisma_1.default.maintenanceLog.findUnique({ where: { id } });
        if (!existingLog)
            return res.status(404).json({ message: "Phiếu không tồn tại" });
        await prisma_1.default.$transaction(async (tx) => {
            await tx.maintenanceLog.update({
                where: { id },
                data: {
                    status: 'DONE',
                    endDate: new Date(),
                    cost: cost !== undefined ? Number(cost) : existingLog.cost,
                    description: note ? `${existingLog.description} | Ghi chú thêm: ${note}` : existingLog.description
                }
            });
            await tx.asset.update({
                where: { id: existingLog.assetId },
                data: { status: 'IN_USE' }
            });
        });
        res.status(200).json({ status: "success", message: "Đã hoàn thành sửa chữa. Thiết bị đã sẵn sàng sử dụng." });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Lỗi cập nhật trạng thái" });
    }
};
exports.completeMaintenanceLog = completeMaintenanceLog;

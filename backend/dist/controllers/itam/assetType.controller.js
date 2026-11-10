"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAssetTypes = exports.deleteAssetType = exports.updateAssetType = exports.createAssetType = exports.getAssetTypes = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const getAssetTypes = async (req, res) => {
    try {
        const types = await prisma_1.default.assetType.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { assets: true }
                }
            }
        });
        res.status(200).json({
            status: "success",
            data: types
        });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Lỗi lấy danh sách loại tài sản" });
    }
};
exports.getAssetTypes = getAssetTypes;
const createAssetType = async (req, res) => {
    try {
        const { code, name } = req.body;
        if (!code || !name) {
            return res.status(400).json({ status: "error", message: "Mã (Code) và Tên là bắt buộc!" });
        }
        const exists = await prisma_1.default.assetType.findUnique({ where: { code: code.toUpperCase() } });
        if (exists) {
            return res.status(400).json({ status: "error", message: `Mã loại '${code}' đã tồn tại!` });
        }
        const newType = await prisma_1.default.assetType.create({
            data: {
                code: code.toUpperCase(),
                name: name
            }
        });
        res.status(201).json({ status: "success", data: newType });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Lỗi khi tạo loại tài sản" });
    }
};
exports.createAssetType = createAssetType;
const updateAssetType = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name } = req.body;
        if (code) {
            const exists = await prisma_1.default.assetType.findFirst({
                where: {
                    code: code.toUpperCase(),
                    id: { not: id }
                }
            });
            if (exists) {
                return res.status(400).json({ status: "error", message: `Mã loại '${code}' đã được sử dụng!` });
            }
        }
        const updatedType = await prisma_1.default.assetType.update({
            where: { id },
            data: {
                code: code ? code.toUpperCase() : undefined,
                name
            }
        });
        res.status(200).json({ status: "success", data: updatedType });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Lỗi khi cập nhật loại tài sản" });
    }
};
exports.updateAssetType = updateAssetType;
const deleteAssetType = async (req, res) => {
    try {
        const { id } = req.params;
        const count = await prisma_1.default.asset.count({ where: { typeId: id } });
        if (count > 0) {
            return res.status(400).json({
                status: "error",
                message: `Không thể xóa! Đang có ${count} thiết bị thuộc loại này. Hãy chuyển chúng sang loại khác trước.`
            });
        }
        await prisma_1.default.assetType.delete({ where: { id } });
        res.status(200).json({ status: "success", message: "Đã xóa loại tài sản thành công" });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Lỗi khi xóa loại tài sản" });
    }
};
exports.deleteAssetType = deleteAssetType;
const seedAssetTypes = async (req, res) => {
    try {
        const defaultTypes = [
            { code: 'PC', name: 'Máy tính để bàn (PC)' },
            { code: 'LAPTOP', name: 'Laptop' },
            { code: 'MONITOR', name: 'Màn hình' },
            { code: 'PRINTER', name: 'Máy in' },
            { code: 'SCANNER', name: 'Máy Scan' },
            { code: 'PROJECTOR', name: 'Máy chiếu' },
            { code: 'SERVER', name: 'Máy chủ (Server)' },
            { code: 'NETWORK', name: 'Thiết bị mạng (Switch/Wifi)' },
            { code: 'MOUSE', name: 'Chuột' },
            { code: 'KEYBOARD', name: 'Bàn phím' },
            { code: 'WEBCAM', name: 'Webcam / Camera' },
            { code: 'HEADPHONE', name: 'Tai nghe / Loa' },
            { code: 'UPS', name: 'Bộ lưu điện (UPS)' },
            { code: 'OTHER', name: 'Khác' },
        ];
        await prisma_1.default.$transaction(defaultTypes.map(type => prisma_1.default.assetType.upsert({
            where: { code: type.code },
            update: {},
            create: type
        })));
        res.status(200).json({ status: "success", message: "Đã khởi tạo dữ liệu mẫu thành công!" });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Lỗi khi seed data" });
    }
};
exports.seedAssetTypes = seedAssetTypes;

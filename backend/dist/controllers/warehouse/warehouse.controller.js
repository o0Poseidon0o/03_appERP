"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLocation = exports.deleteLocation = exports.getAllLocations = exports.deleteWarehouse = exports.updateWarehouse = exports.addLocation = exports.createWarehouse = exports.getAllWarehouses = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const AppError_1 = require("../../utils/AppError");
const getAllWarehouses = async (req, res, next) => {
    try {
        const { factoryId } = req.query;
        const whereCondition = factoryId ? { factoryId: String(factoryId) } : {};
        const warehouses = await prisma_1.default.warehouse.findMany({
            where: whereCondition,
            orderBy: [
                { factory: { name: 'asc' } },
                { name: 'asc' }
            ],
            include: {
                factory: {
                    select: { id: true, name: true }
                },
                locations: {
                    orderBy: { locationCode: 'asc' }
                },
                _count: { select: { locations: true } }
            }
        });
        res.status(200).json({ status: 'success', data: warehouses });
    }
    catch (error) {
        console.error("Lỗi getAllWarehouses:", error);
        next(new AppError_1.AppError('Lỗi lấy danh sách kho', 500));
    }
};
exports.getAllWarehouses = getAllWarehouses;
const createWarehouse = async (req, res, next) => {
    try {
        const { name, warehouseCode, factoryId, type, description } = req.body;
        if (!name || !warehouseCode || !factoryId) {
            return next(new AppError_1.AppError('Vui lòng nhập đủ: Tên, Mã kho và Nhà máy', 400));
        }
        const exists = await prisma_1.default.warehouse.findUnique({ where: { warehouseCode } });
        if (exists) {
            return next(new AppError_1.AppError(`Mã kho '${warehouseCode}' đã tồn tại`, 400));
        }
        const newWarehouse = await prisma_1.default.warehouse.create({
            data: {
                name,
                warehouseCode: warehouseCode.toUpperCase().trim(),
                factoryId,
                type: type || 'PHYSICAL',
                description
            },
        });
        res.status(201).json({ status: 'success', data: newWarehouse });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi tạo kho mới', 500));
    }
};
exports.createWarehouse = createWarehouse;
const addLocation = async (req, res, next) => {
    try {
        const { warehouseId, locationCode, rack, level, bin } = req.body;
        const warehouse = await prisma_1.default.warehouse.findUnique({ where: { id: warehouseId } });
        if (!warehouse)
            return next(new AppError_1.AppError('Kho không tồn tại', 404));
        const normalizedCode = locationCode.toUpperCase().trim();
        const qrCode = `${warehouse.warehouseCode}-${normalizedCode}`;
        const location = await prisma_1.default.location.create({
            data: {
                warehouseId,
                locationCode: normalizedCode,
                qrCode,
                rack: rack || null,
                level: level || null,
                bin: bin || null
            }
        });
        res.status(201).json({ status: 'success', data: location });
    }
    catch (error) {
        if (error.code === 'P2002') {
            return next(new AppError_1.AppError(`Vị trí '${req.body.locationCode}' đã tồn tại trong kho này`, 400));
        }
        next(new AppError_1.AppError('Lỗi tạo vị trí kệ', 500));
    }
};
exports.addLocation = addLocation;
const updateWarehouse = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, factoryId, type, description } = req.body;
        const updated = await prisma_1.default.warehouse.update({
            where: { id },
            data: {
                name,
                factoryId,
                type,
                description
            }
        });
        res.status(200).json({ status: 'success', data: updated });
    }
    catch (error) {
        next(new AppError_1.AppError('Không tìm thấy kho hoặc lỗi cập nhật', 404));
    }
};
exports.updateWarehouse = updateWarehouse;
const deleteWarehouse = async (req, res, next) => {
    try {
        const { id } = req.params;
        const locationCount = await prisma_1.default.location.count({ where: { warehouseId: id } });
        if (locationCount > 0) {
            return next(new AppError_1.AppError(`Kho này đang chứa ${locationCount} vị trí kệ, vui lòng xóa vị trí trước!`, 400));
        }
        await prisma_1.default.warehouse.delete({ where: { id } });
        res.status(200).json({ status: 'success', message: 'Đã xóa kho thành công' });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi khi xóa kho', 500));
    }
};
exports.deleteWarehouse = deleteWarehouse;
const getAllLocations = async (req, res, next) => {
    try {
        const locations = await prisma_1.default.location.findMany({
            include: {
                warehouse: {
                    select: { warehouseCode: true, name: true }
                }
            },
            orderBy: [
                { warehouse: { warehouseCode: 'asc' } },
                { locationCode: 'asc' }
            ]
        });
        const formattedData = locations.map(loc => ({
            id: loc.id,
            locationCode: loc.locationCode,
            qrCode: loc.qrCode,
            displayName: `${loc.warehouse.warehouseCode} - ${loc.locationCode}`,
            rack: loc.rack,
            level: loc.level,
            bin: loc.bin,
            warehouseName: loc.warehouse.name
        }));
        res.status(200).json({ status: 'success', data: formattedData });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi lấy danh sách vị trí', 500));
    }
};
exports.getAllLocations = getAllLocations;
const deleteLocation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const stockCount = await prisma_1.default.stock.count({ where: { locationId: id, quantity: { gt: 0 } } });
        if (stockCount > 0) {
            return next(new AppError_1.AppError(`Vị trí này đang chứa hàng, không thể xóa!`, 400));
        }
        await prisma_1.default.location.delete({ where: { id } });
        res.status(200).json({ status: 'success', message: 'Đã xóa vị trí thành công' });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi khi xóa vị trí', 500));
    }
};
exports.deleteLocation = deleteLocation;
const updateLocation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { locationCode, rack, level, bin } = req.body;
        const currentLocation = await prisma_1.default.location.findUnique({
            where: { id },
            include: { warehouse: true }
        });
        if (!currentLocation) {
            return next(new AppError_1.AppError('Không tìm thấy vị trí này', 404));
        }
        const normalizedCode = locationCode.toUpperCase().trim();
        const newQrCode = `${currentLocation.warehouse.warehouseCode}-${normalizedCode}`;
        const updatedLocation = await prisma_1.default.location.update({
            where: { id },
            data: {
                locationCode: normalizedCode,
                qrCode: newQrCode,
                rack,
                level,
                bin
            }
        });
        res.status(200).json({ status: 'success', data: updatedLocation });
    }
    catch (error) {
        if (error.code === 'P2002') {
            return next(new AppError_1.AppError('Mã vị trí này đã tồn tại trong kho', 400));
        }
        next(new AppError_1.AppError('Lỗi cập nhật vị trí', 500));
    }
};
exports.updateLocation = updateLocation;

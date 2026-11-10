"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importItemsBulk = exports.importUsageCategories = exports.deleteUsageCategory = exports.updateUsageCategory = exports.createUsageCategory = exports.getAllUsageCategories = exports.deleteItem = exports.deleteConversionUnit = exports.addConversionUnit = exports.updateItem = exports.searchItems = exports.createItem = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getAllCategories = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const AppError_1 = require("../../utils/AppError");
const getAllCategories = async (req, res, next) => {
    try {
        const categories = await prisma_1.default.itemCategory.findMany({
            orderBy: { code: 'asc' },
            include: { _count: { select: { items: true } } }
        });
        res.status(200).json({ status: 'success', data: categories });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi khi lấy danh sách danh mục', 500));
    }
};
exports.getAllCategories = getAllCategories;
const createCategory = async (req, res, next) => {
    try {
        const { code, name } = req.body;
        if (!code || !name) {
            return next(new AppError_1.AppError('Mã nhóm và Tên nhóm không được để trống', 400));
        }
        const existingCode = await prisma_1.default.itemCategory.findUnique({ where: { code: code.toString() } });
        if (existingCode) {
            return next(new AppError_1.AppError(`Mã nhóm '${code}' đã tồn tại!`, 400));
        }
        const category = await prisma_1.default.itemCategory.create({
            data: {
                code: code.toUpperCase().trim(),
                name: name.trim()
            }
        });
        res.status(201).json({ status: 'success', data: category });
    }
    catch (error) {
        next(new AppError_1.AppError('Tên danh mục hoặc Mã danh mục đã tồn tại', 400));
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { code, name } = req.body;
        const updated = await prisma_1.default.itemCategory.update({
            where: { id },
            data: {
                code: code ? code.toUpperCase().trim() : undefined,
                name: name ? name.trim() : undefined
            }
        });
        res.status(200).json({ status: 'success', data: updated });
    }
    catch (error) {
        next(new AppError_1.AppError('Không tìm thấy danh mục hoặc Mã/Tên đã bị trùng', 404));
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const itemUnderCategory = await prisma_1.default.item.count({ where: { categoryId: id } });
        if (itemUnderCategory > 0) {
            return next(new AppError_1.AppError('Không thể xóa danh mục đang có vật tư tồn tại', 400));
        }
        await prisma_1.default.itemCategory.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi khi xóa danh mục', 500));
    }
};
exports.deleteCategory = deleteCategory;
const createItem = async (req, res, next) => {
    try {
        const { itemCode, itemName, baseUnit, categoryId, minStock, conversions } = req.body;
        if (!itemCode || !itemName || !baseUnit || !categoryId) {
            return next(new AppError_1.AppError('Thiếu thông tin bắt buộc (Mã, Tên, ĐVT cơ sở, Nhóm)', 400));
        }
        const uniqueSuffix = Date.now().toString(36).toUpperCase();
        const qrCode = `ITM-${itemCode}-${uniqueSuffix}`;
        const conversionData = Array.isArray(conversions) ? conversions.map((c) => ({
            unitName: c.unitName,
            factor: parseFloat(c.factor),
            barcode: c.barcode || null
        })) : [];
        const item = await prisma_1.default.item.create({
            data: {
                itemCode,
                itemName,
                baseUnit,
                categoryId,
                qrCode,
                minStock: minStock ? parseFloat(minStock) : 0,
                conversions: {
                    create: conversionData
                }
            },
            include: {
                conversions: true
            }
        });
        res.status(201).json({ status: 'success', data: item });
    }
    catch (error) {
        console.error("Create Item Error:", error);
        next(new AppError_1.AppError('Mã vật tư, mã QR hoặc đơn vị quy đổi đã bị trùng', 400));
    }
};
exports.createItem = createItem;
const searchItems = async (req, res, next) => {
    try {
        const { q } = req.query;
        const items = await prisma_1.default.item.findMany({
            where: q ? {
                OR: [
                    { itemCode: { contains: String(q), mode: 'insensitive' } },
                    { itemName: { contains: String(q), mode: 'insensitive' } },
                    { qrCode: { equals: String(q) } },
                    {
                        conversions: {
                            some: { barcode: { equals: String(q) } }
                        }
                    }
                ]
            } : {},
            include: {
                category: true,
                conversions: true,
                stocks: {
                    include: { location: true, supplier: true }
                }
            }
        });
        res.status(200).json({ status: 'success', data: items });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi khi tìm kiếm vật tư', 500));
    }
};
exports.searchItems = searchItems;
const updateItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { itemName, baseUnit, categoryId, minStock } = req.body;
        const updatedItem = await prisma_1.default.item.update({
            where: { id },
            data: {
                itemName,
                baseUnit,
                categoryId,
                minStock: minStock ? parseFloat(minStock) : undefined
            }
        });
        res.status(200).json({ status: 'success', data: updatedItem });
    }
    catch (error) {
        next(new AppError_1.AppError('Không tìm thấy vật tư để cập nhật', 404));
    }
};
exports.updateItem = updateItem;
const addConversionUnit = async (req, res, next) => {
    try {
        const { itemId } = req.params;
        const { unitName, factor, barcode } = req.body;
        if (!unitName || !factor) {
            return next(new AppError_1.AppError('Tên đơn vị và hệ số quy đổi là bắt buộc', 400));
        }
        const newUnit = await prisma_1.default.itemUnitConversion.create({
            data: {
                itemId,
                unitName,
                factor: parseFloat(factor),
                barcode
            }
        });
        res.status(201).json({ status: 'success', data: newUnit });
    }
    catch (error) {
        next(new AppError_1.AppError('Đơn vị quy đổi này đã tồn tại cho vật tư này', 400));
    }
};
exports.addConversionUnit = addConversionUnit;
const deleteConversionUnit = async (req, res, next) => {
    try {
        const { conversionId } = req.params;
        await prisma_1.default.itemUnitConversion.delete({ where: { id: conversionId } });
        res.status(204).send();
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi khi xóa đơn vị quy đổi', 500));
    }
};
exports.deleteConversionUnit = deleteConversionUnit;
const deleteItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const stockCount = await prisma_1.default.stock.findMany({
            where: { itemId: id, quantity: { gt: 0 } }
        });
        if (stockCount.length > 0)
            return next(new AppError_1.AppError('Vật tư còn hàng tồn, không thể xóa!', 400));
        const transactionCount = await prisma_1.default.transactionDetail.count({
            where: { itemId: id }
        });
        if (transactionCount > 0)
            return next(new AppError_1.AppError('Vật tư đã có lịch sử giao dịch, không thể xóa!', 400));
        await prisma_1.default.item.delete({ where: { id } });
        res.status(204).json({ status: 'success', data: null });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi hệ thống khi xóa vật tư', 500));
    }
};
exports.deleteItem = deleteItem;
const getAllUsageCategories = async (req, res, next) => {
    try {
        const categories = await prisma_1.default.usageCategory.findMany({
            orderBy: { code: 'asc' }
        });
        res.status(200).json({ status: 'success', data: categories });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi lấy danh sách loại hàng sử dụng', 500));
    }
};
exports.getAllUsageCategories = getAllUsageCategories;
const createUsageCategory = async (req, res, next) => {
    try {
        const { code, name, description } = req.body;
        if (!code || !name)
            return next(new AppError_1.AppError('Mã và Tên loại hàng không được để trống', 400));
        const newCategory = await prisma_1.default.usageCategory.create({
            data: { code, name, description }
        });
        res.status(201).json({ status: 'success', data: newCategory });
    }
    catch (error) {
        next(new AppError_1.AppError('Mã loại hàng đã tồn tại', 400));
    }
};
exports.createUsageCategory = createUsageCategory;
const updateUsageCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const updated = await prisma_1.default.usageCategory.update({
            where: { id },
            data: { name, description }
        });
        res.status(200).json({ status: 'success', data: updated });
    }
    catch (error) {
        next(new AppError_1.AppError('Không tìm thấy loại hàng', 404));
    }
};
exports.updateUsageCategory = updateUsageCategory;
const deleteUsageCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const countUsed = await prisma_1.default.transactionDetail.count({
            where: { usageCategoryId: id }
        });
        if (countUsed > 0) {
            return next(new AppError_1.AppError('Loại hàng này đã được sử dụng trong giao dịch, không thể xóa!', 400));
        }
        await prisma_1.default.usageCategory.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi khi xóa loại hàng', 500));
    }
};
exports.deleteUsageCategory = deleteUsageCategory;
const importUsageCategories = async (req, res, next) => {
    try {
        const { data } = req.body;
        if (!Array.isArray(data) || data.length === 0) {
            return next(new AppError_1.AppError('Dữ liệu import rỗng hoặc không hợp lệ', 400));
        }
        const validItems = [];
        for (const item of data) {
            const rawCode = item.product_category_code || item.code;
            const rawName = item.product_name || item.name;
            if (rawCode && rawName) {
                validItems.push({
                    code: String(rawCode).trim(),
                    name: String(rawName).trim()
                });
            }
        }
        if (validItems.length === 0) {
            return next(new AppError_1.AppError('Lỗi: Không tìm thấy cột mã và tên hợp lệ trong file!', 400));
        }
        const result = await prisma_1.default.$transaction(validItems.map((item) => prisma_1.default.usageCategory.upsert({
            where: { code: item.code },
            update: { name: item.name },
            create: {
                code: item.code,
                name: item.name
            }
        })));
        res.status(200).json({
            status: 'success',
            message: `Đã xử lý thành công ${result.length} dòng dữ liệu.`
        });
    }
    catch (error) {
        console.error("Import Error:", error);
        next(new AppError_1.AppError('Lỗi hệ thống khi import dữ liệu.', 500));
    }
};
exports.importUsageCategories = importUsageCategories;
const importItemsBulk = async (req, res, next) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return next(new AppError_1.AppError('Dữ liệu import trống!', 400));
        }
        const categories = await prisma_1.default.itemCategory.findMany();
        const categoryMap = new Map();
        categories.forEach(c => categoryMap.set(c.code, c.id));
        const validItems = [];
        const errors = [];
        for (const item of items) {
            const { itemCode, itemName, baseUnit } = item;
            const prefix = itemCode.split('-')[0];
            const categoryId = categoryMap.get(prefix);
            if (!categoryId) {
                errors.push(`Mã ${itemCode}: Không tìm thấy nhóm vật tư tương ứng với mã "${prefix}"`);
                continue;
            }
            validItems.push({
                itemCode: String(itemCode).trim(),
                itemName: String(itemName).trim(),
                baseUnit: String(baseUnit).trim(),
                categoryId: categoryId,
                minStock: 5,
                qrCode: `ITM-${itemCode}-${Date.now()}`
            });
        }
        if (validItems.length === 0) {
            return next(new AppError_1.AppError(`Không có dòng nào hợp lệ. Lỗi: ${errors.join(', ')}`, 400));
        }
        let successCount = 0;
        await prisma_1.default.$transaction(validItems.map(item => prisma_1.default.item.upsert({
            where: { itemCode: item.itemCode },
            update: {
                itemName: item.itemName,
                baseUnit: item.baseUnit,
                categoryId: item.categoryId
            },
            create: {
                itemCode: item.itemCode,
                itemName: item.itemName,
                baseUnit: item.baseUnit,
                categoryId: item.categoryId,
                minStock: item.minStock,
                qrCode: item.qrCode
            }
        })));
        successCount = validItems.length;
        res.status(200).json({
            status: 'success',
            message: `Đã xử lý ${successCount} vật tư.`,
            warnings: errors.length > 0 ? errors : undefined
        });
    }
    catch (error) {
        console.error("Bulk Import Error:", error);
        next(new AppError_1.AppError('Lỗi khi import dữ liệu (có thể do trùng mã QR hoặc lỗi hệ thống)', 500));
    }
};
exports.importItemsBulk = importItemsBulk;

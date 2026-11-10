"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionHistory = exports.checkStock = exports.getStockActual = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const AppError_1 = require("../../utils/AppError");
const getStockActual = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, warehouseId, itemId, ignoreFactoryScope, isLowStock } = req.query;
        const user = req.user;
        const whereCondition = { quantity: { gt: 0 } };
        if (ignoreFactoryScope !== "true" && user.roleId !== "ROLE-ADMIN") {
            if (!user.factoryId)
                return res.status(200).json({ data: [], total: 0 });
            whereCondition.location = { warehouse: { factoryId: user.factoryId } };
        }
        if (itemId)
            whereCondition.itemId = itemId;
        else if (search) {
            whereCondition.item = {
                OR: [
                    { itemCode: { contains: search, mode: "insensitive" } },
                    { itemName: { contains: search, mode: "insensitive" } },
                ],
            };
        }
        if (warehouseId) {
            whereCondition.location = {
                ...(whereCondition.location || {}),
                warehouseId: warehouseId
            };
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [total, stocks] = await Promise.all([
            prisma_1.default.stock.count({ where: whereCondition }),
            prisma_1.default.stock.findMany({
                where: whereCondition,
                include: {
                    item: { include: { category: true } },
                    location: {
                        include: {
                            warehouse: { include: { factory: true } }
                        }
                    },
                    supplier: true
                },
                orderBy: [{ item: { itemCode: "asc" } }, { location: { locationCode: "asc" } }],
                take: Number(limit),
                skip: skip,
            }),
        ]);
        const formattedStocks = stocks.map((stock) => ({
            id: stock.id,
            itemId: stock.itemId,
            itemCode: stock.item.itemCode,
            itemName: stock.item.itemName,
            unit: stock.item.baseUnit,
            category: stock.item.category?.name || "N/A",
            locationId: stock.locationId,
            locationCode: stock.location.locationCode,
            warehouseName: stock.location.warehouse.name,
            factoryId: stock.location.warehouse.factoryId,
            factoryName: stock.location.warehouse.factory.name,
            quantity: stock.quantity,
            minStock: stock.item.minStock,
            supplierName: stock.supplier?.name || "N/A",
            isLow: stock.quantity <= stock.item.minStock,
        }));
        let finalData = formattedStocks;
        if (isLowStock === "true")
            finalData = finalData.filter((s) => s.isLow);
        res.status(200).json({
            status: "success",
            data: finalData,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(new AppError_1.AppError("Lỗi lấy dữ liệu tồn kho", 500));
    }
};
exports.getStockActual = getStockActual;
const checkStock = async (req, res, next) => {
    try {
        const { itemId, locationId } = req.query;
        if (!itemId || !locationId)
            return res.status(200).json({ status: "success", quantity: 0 });
        const stocks = await prisma_1.default.stock.findMany({ where: { itemId: itemId, locationId: locationId } });
        const physicalQty = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
        const pendingAggregation = await prisma_1.default.transactionDetail.aggregate({
            _sum: { quantity: true },
            where: {
                itemId: String(itemId),
                fromLocationId: String(locationId),
                transaction: {
                    type: "EXPORT",
                    ticket: {
                        status: { in: ["PENDING"] }
                    }
                },
            },
        });
        const pendingQty = pendingAggregation._sum.quantity || 0;
        const availableQty = physicalQty - pendingQty;
        res.status(200).json({
            status: "success",
            quantity: availableQty > 0 ? availableQty : 0,
            physical: physicalQty,
            pending: pendingQty
        });
    }
    catch (error) {
        next(new AppError_1.AppError("Lỗi kiểm tra tồn kho", 500));
    }
};
exports.checkStock = checkStock;
const getTransactionHistory = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, type } = req.query;
        const user = req.user;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};
        if (type)
            where.type = type;
        if (status) {
            where.ticket = {
                status: { in: status.split(',') }
            };
        }
        if (user.roleId !== "ROLE-ADMIN") {
            if (["ROLE-LEADER", "ROLE-MANAGER"].includes(user.roleId)) {
                where.ticket = {
                    ...where.ticket,
                    creator: { departmentId: user.departmentId }
                };
            }
            else {
                if (user.factoryId)
                    where.factoryId = user.factoryId;
            }
        }
        const [total, transactions] = await Promise.all([
            prisma_1.default.stockTransaction.count({ where }),
            prisma_1.default.stockTransaction.findMany({
                where,
                include: {
                    ticket: {
                        select: {
                            code: true,
                            status: true,
                            createdAt: true,
                            creator: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    department: {
                                        select: {
                                            name: true,
                                            id: true
                                        }
                                    }
                                }
                            },
                            steps: {
                                include: {
                                    step: true,
                                    actor: {
                                        select: {
                                            id: true,
                                            fullName: true
                                        }
                                    }
                                },
                                orderBy: { step: { order: 'asc' } }
                            },
                            logs: { orderBy: { createdAt: 'desc' }, take: 1 }
                        }
                    },
                    supplier: { select: { name: true } },
                    details: { include: { item: true, fromLocation: true, toLocation: true, usageCategory: true } },
                    factory: { select: { name: true } }
                },
                orderBy: { ticket: { createdAt: "desc" } },
                take: Number(limit),
                skip: skip,
            }),
        ]);
        const mappedTransactions = transactions.map((t) => ({
            id: t.id,
            code: t.ticket?.code,
            status: t.ticket?.status,
            creator: t.ticket?.creator,
            creatorName: t.ticket?.creator?.fullName,
            creatorId: t.ticket?.creator?.id,
            departmentName: t.ticket?.creator?.department?.name,
            departmentId: t.ticket?.creator?.department?.id,
            createdAt: t.ticket?.createdAt,
            type: t.type,
            isEmergency: t.isEmergency,
            description: t.description,
            factoryName: t.factory?.name,
            supplierName: t.supplier?.name || 'N/A',
            details: t.details,
            steps: t.ticket?.steps || []
        }));
        res.status(200).json({
            status: "success",
            data: mappedTransactions,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(new AppError_1.AppError("Lỗi tải lịch sử giao dịch", 500));
    }
};
exports.getTransactionHistory = getTransactionHistory;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockHistoryReport = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const AppError_1 = require("../../utils/AppError");
const dayjs_1 = __importDefault(require("dayjs"));
const getStockHistoryReport = async (req, res, next) => {
    try {
        const { type, date, factoryId } = req.query;
        if (!date) {
            return next(new AppError_1.AppError('Vui lòng chọn thời gian xem báo cáo', 400));
        }
        let cutoffDate = (0, dayjs_1.default)(String(date));
        if (type === 'year') {
            cutoffDate = cutoffDate.endOf('year');
        }
        else if (type === 'month') {
            cutoffDate = cutoffDate.endOf('month');
        }
        else {
            cutoffDate = cutoffDate.endOf('day');
        }
        const cutoffDateJS = cutoffDate.toDate();
        const currentStocks = await prisma_1.default.stock.findMany({
            where: {
                ...(factoryId ? { location: { warehouse: { factoryId: String(factoryId) } } } : {})
            },
            include: {
                item: true,
                location: {
                    include: {
                        warehouse: { include: { factory: true } }
                    }
                }
            }
        });
        const historyMovements = await prisma_1.default.transactionDetail.findMany({
            where: {
                transaction: {
                    ...(factoryId ? { factoryId: String(factoryId) } : {}),
                    ticket: {
                        status: { in: ['APPROVED', 'COMPLETED'] },
                        createdAt: { gt: cutoffDateJS }
                    }
                }
            },
            include: {
                transaction: true
            }
        });
        const stockMap = new Map();
        currentStocks.forEach(stock => {
            const key = `${stock.itemId}_${stock.locationId}`;
            stockMap.set(key, {
                itemCode: stock.item.itemCode,
                itemName: stock.item.itemName,
                unit: stock.item.baseUnit,
                factoryName: stock.location.warehouse.factory.name,
                warehouseName: stock.location.warehouse.name,
                rack: stock.location.rack || '',
                bin: stock.location.bin || '',
                finalQuantity: stock.quantity
            });
        });
        historyMovements.forEach(detail => {
            const qty = detail.quantity;
            if (detail.toLocationId) {
                const key = `${detail.itemId}_${detail.toLocationId}`;
                if (stockMap.has(key)) {
                    const record = stockMap.get(key);
                    record.finalQuantity -= qty;
                    stockMap.set(key, record);
                }
            }
            if (detail.fromLocationId) {
                const key = `${detail.itemId}_${detail.fromLocationId}`;
                if (stockMap.has(key)) {
                    const record = stockMap.get(key);
                    record.finalQuantity += qty;
                    stockMap.set(key, record);
                }
            }
        });
        const reportData = Array.from(stockMap.values())
            .filter(item => item.finalQuantity > 0)
            .sort((a, b) => a.itemCode.localeCompare(b.itemCode));
        res.status(200).json({
            status: 'success',
            data: reportData,
            meta: { cutoffDate: cutoffDateJS }
        });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi tính toán báo cáo', 500));
    }
};
exports.getStockHistoryReport = getStockHistoryReport;

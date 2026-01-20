import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import dayjs from 'dayjs';

export const getStockHistoryReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Nhận params: type ('date' | 'month' | 'year') và date
    const { type, date, factoryId } = req.query;

    if (!date) {
        return next(new AppError('Vui lòng chọn thời gian xem báo cáo', 400));
    }

    // 1. XÁC ĐỊNH NGÀY CHỐT SỔ (Cutoff Date)
    // Tính thời điểm cuối cùng của kỳ báo cáo (23:59:59)
    let cutoffDate = dayjs(String(date));

    if (type === 'year') {
        cutoffDate = cutoffDate.endOf('year'); // Cuối năm
    } else if (type === 'month') {
        cutoffDate = cutoffDate.endOf('month'); // Cuối tháng
    } else {
        cutoffDate = cutoffDate.endOf('day'); // Cuối ngày (Mặc định)
    }

    const cutoffDateJS = cutoffDate.toDate();

    // 2. LẤY TỒN KHO HIỆN TẠI (Realtime)
    // Lấy cả những dòng có quantity = 0 để làm mốc tính toán
    const currentStocks = await prisma.stock.findMany({
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

    // 3. LẤY GIAO DỊCH PHÁT SINH TỪ [CHỐT SỔ] -> [HIỆN TẠI]
    const historyMovements = await prisma.transactionDetail.findMany({
        where: {
            transaction: {
                status: { in: ['APPROVED', 'COMPLETED'] }, // Chỉ lấy phiếu đã hoàn thành
                createdAt: { gt: cutoffDateJS },           // Lớn hơn thời điểm chốt
                ...(factoryId ? { factoryId: String(factoryId) } : {})
            }
        },
        include: { transaction: true }
    });

    // 4. TÍNH TOÁN NGƯỢC (ROLLBACK)
    const stockMap = new Map<string, any>();

    // B4.1: Đổ tồn hiện tại vào Map
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
            finalQuantity: stock.quantity // Tồn tại thời điểm hiện tại
        });
    });

    // B4.2: Duyệt ngược lịch sử
    historyMovements.forEach(detail => {
        const qty = detail.quantity;

        // -- CASE 1: NHẬP sau ngày chốt -> TRỪ ĐI
        if (detail.toLocationId) {
            const key = `${detail.itemId}_${detail.toLocationId}`;
            if (stockMap.has(key)) {
                const record = stockMap.get(key);
                record.finalQuantity -= qty; 
                stockMap.set(key, record);
            }
        }

        // -- CASE 2: XUẤT sau ngày chốt -> CỘNG LẠI
        if (detail.fromLocationId) {
            const key = `${detail.itemId}_${detail.fromLocationId}`;
            if (stockMap.has(key)) {
                const record = stockMap.get(key);
                record.finalQuantity += qty;
                stockMap.set(key, record);
            }
        }
    });

    // 5. Format dữ liệu (Chỉ lấy dòng có tồn > 0)
    const reportData = Array.from(stockMap.values())
        .filter(item => item.finalQuantity > 0)
        .sort((a, b) => a.itemCode.localeCompare(b.itemCode));

    res.status(200).json({ 
        status: 'success', 
        data: reportData,
        meta: { cutoffDate: cutoffDateJS }
    });

  } catch (error) {
    next(new AppError('Lỗi tính toán báo cáo', 500));
  }
};
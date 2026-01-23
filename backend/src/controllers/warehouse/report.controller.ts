import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import dayjs from 'dayjs';

export const getStockHistoryReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, date, factoryId } = req.query;

    if (!date) {
        return next(new AppError('Vui lòng chọn thời gian xem báo cáo', 400));
    }

    // 1. XÁC ĐỊNH NGÀY CHỐT SỔ (Cutoff Date)
    let cutoffDate = dayjs(String(date));

    if (type === 'year') {
        cutoffDate = cutoffDate.endOf('year');
    } else if (type === 'month') {
        cutoffDate = cutoffDate.endOf('month');
    } else {
        cutoffDate = cutoffDate.endOf('day');
    }

    const cutoffDateJS = cutoffDate.toDate();

    // 2. LẤY TỒN KHO HIỆN TẠI (Realtime)
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
    // [FIXED QUERY] Truy vấn lồng nhau qua Ticket
    const historyMovements = await prisma.transactionDetail.findMany({
        where: {
            transaction: {
                // Điều kiện lọc theo Factory nằm ở bảng StockTransaction
                ...(factoryId ? { factoryId: String(factoryId) } : {}),
                
                // Điều kiện lọc Status và CreatedAt nằm ở bảng Ticket
                ticket: {
                    status: { in: ['APPROVED', 'COMPLETED'] }, // Chỉ tính phiếu đã duyệt
                    createdAt: { gt: cutoffDateJS }            // Lớn hơn ngày chốt sổ
                }
            }
        },
        include: { 
            transaction: true 
        }
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
            finalQuantity: stock.quantity 
        });
    });

    // B4.2: Duyệt ngược lịch sử để Rollback số liệu
    historyMovements.forEach(detail => {
        const qty = detail.quantity;

        // -- CASE 1: NHẬP sau ngày chốt -> Có nghĩa là tại ngày chốt Hàng Chưa Về -> TRỪ ĐI
        if (detail.toLocationId) {
            const key = `${detail.itemId}_${detail.toLocationId}`;
            if (stockMap.has(key)) {
                const record = stockMap.get(key);
                record.finalQuantity -= qty; 
                stockMap.set(key, record);
            }
        }

        // -- CASE 2: XUẤT sau ngày chốt -> Có nghĩa là tại ngày chốt Hàng Còn Ở Kho -> CỘNG LẠI
        if (detail.fromLocationId) {
            const key = `${detail.itemId}_${detail.fromLocationId}`;
            if (stockMap.has(key)) {
                const record = stockMap.get(key);
                record.finalQuantity += qty;
                stockMap.set(key, record);
            }
        }
    });

    // 5. Format dữ liệu
    const reportData = Array.from(stockMap.values())
        .filter(item => item.finalQuantity > 0) // Chỉ lấy tồn > 0
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
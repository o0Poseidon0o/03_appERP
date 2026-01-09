import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';

export const createItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemCode, itemName, unit, categoryId } = req.body;

    // Tinh chỉnh QR: Dùng timestamp để tránh trùng lặp tuyệt đối
    const uniqueSuffix = Date.now().toString(36).toUpperCase();
    const qrCode = `ITM-${itemCode}-${uniqueSuffix}`;

    const item = await prisma.item.create({
      data: { itemCode, itemName, unit, categoryId, qrCode }
    });

    res.status(201).json({ status: 'success', data: item });
  } catch (error) {
    next(new AppError('Mã vật tư hoặc mã QR đã tồn tại', 400));
  }
};

export const searchItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    if (!q) return next(new AppError('Vui lòng nhập từ khóa tìm kiếm', 400));

    const items = await prisma.item.findMany({
      where: {
        OR: [
          { itemCode: { contains: String(q), mode: 'insensitive' } },
          { itemName: { contains: String(q), mode: 'insensitive' } },
          { qrCode: { equals: String(q) } }
        ]
      },
      include: { 
        category: true, 
        stocks: { 
          include: { location: true, supplier: true } 
        } 
      }
    });

    res.status(200).json({ status: 'success', data: items });
  } catch (error) {
    next(new AppError('Lỗi khi tìm kiếm vật tư', 500));
  }
};

export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { itemName, unit, categoryId } = req.body;

    const updatedItem = await prisma.item.update({
      where: { id },
      data: { itemName, unit, categoryId }
    });

    res.status(200).json({ status: 'success', data: updatedItem });
  } catch (error) {
    next(new AppError('Không tìm thấy vật tư để cập nhật', 404));
  }
};

export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const stockCount = await prisma.stock.count({
      where: { itemId: id, quantity: { gt: 0 } }
    });
    if (stockCount > 0) return next(new AppError('Vật tư còn hàng tồn, không thể xóa!', 400));

    const transactionCount = await prisma.transactionDetail.count({
      where: { itemId: id }
    });
    if (transactionCount > 0) return next(new AppError('Vật tư đã có lịch sử giao dịch, không thể xóa!', 400));

    await prisma.item.delete({ where: { id } });
    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    next(new AppError('Lỗi hệ thống khi xóa vật tư', 500));
  }
};
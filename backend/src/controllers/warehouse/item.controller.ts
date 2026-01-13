import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';

// ==========================================
// 1. QUẢN LÝ DANH MỤC (ITEM CATEGORY)
// ==========================================

// Lấy tất cả danh mục (Dùng cho Dropdown khi tạo Item)
export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.itemCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { items: true } } } // Đếm xem mỗi loại có bao nhiêu vật tư
    });
    res.status(200).json({ status: 'success', data: categories });
  } catch (error) {
    next(new AppError('Lỗi khi lấy danh sách danh mục', 500));
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name) return next(new AppError('Tên danh mục không được để trống', 400));

    const category = await prisma.itemCategory.create({ data: { name } });
    res.status(201).json({ status: 'success', data: category });
  } catch (error) {
    next(new AppError('Tên danh mục đã tồn tại', 400));
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    const updated = await prisma.itemCategory.update({
      where: { id },
      data: { name }
    });
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(new AppError('Không tìm thấy danh mục hoặc tên đã tồn tại', 404));
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem có vật tư nào đang thuộc danh mục này không
    const itemUnderCategory = await prisma.item.count({ where: { categoryId: id } });
    if (itemUnderCategory > 0) {
      return next(new AppError('Không thể xóa danh mục đang có vật tư tồn tại', 400));
    }

    await prisma.itemCategory.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(new AppError('Lỗi khi xóa danh mục', 500));
  }
};

// ==========================================
// 2. QUẢN LÝ VẬT TƯ (ITEM)
// ==========================================

export const createItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemCode, itemName, unit, categoryId, minStock } = req.body;

    // Tinh chỉnh QR: Dùng mã vật tư kết hợp timestamp rút gọn
    const uniqueSuffix = Date.now().toString(36).toUpperCase();
    const qrCode = `ITM-${itemCode}-${uniqueSuffix}`;

    const item = await prisma.item.create({
      data: { 
        itemCode, 
        itemName, 
        unit, 
        categoryId, 
        qrCode,
        minStock: minStock ? parseFloat(minStock) : 0
      }
    });

    res.status(201).json({ status: 'success', data: item });
  } catch (error) {
    next(new AppError('Mã vật tư hoặc mã QR đã tồn tại', 400));
  }
};

export const searchItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    
    const items = await prisma.item.findMany({
      where: q ? {
        OR: [
          { itemCode: { contains: String(q), mode: 'insensitive' } },
          { itemName: { contains: String(q), mode: 'insensitive' } },
          { qrCode: { equals: String(q) } }
        ]
      } : {}, // Nếu không có từ khóa thì trả về tất cả
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
    const { itemName, unit, categoryId, minStock } = req.body;

    const updatedItem = await prisma.item.update({
      where: { id },
      data: { 
        itemName, 
        unit, 
        categoryId,
        minStock: minStock ? parseFloat(minStock) : undefined
      }
    });

    res.status(200).json({ status: 'success', data: updatedItem });
  } catch (error) {
    next(new AppError('Không tìm thấy vật tư để cập nhật', 404));
  }
};

export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Ràng buộc 1: Không xóa nếu còn tồn kho thực tế
    const stockCount = await prisma.stock.findMany({
      where: { itemId: id, quantity: { gt: 0 } }
    });
    if (stockCount.length > 0) return next(new AppError('Vật tư còn hàng tồn, không thể xóa!', 400));

    // Ràng buộc 2: Không xóa nếu đã phát sinh phiếu nhập/xuất (để giữ lịch sử)
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
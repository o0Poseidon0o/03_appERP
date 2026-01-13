import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';

// Lấy tất cả nhà cung cấp (có phân trang hoặc tìm kiếm)
export const getAllSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query;
    const suppliers = await prisma.supplier.findMany({
      where: search ? {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { supplierCode: { contains: search as string, mode: 'insensitive' } }
        ]
      } : {},
      orderBy: { name: 'asc' }
    });

    res.status(200).json({ status: 'success', data: suppliers });
  } catch (error: any) {
    next(new AppError(error.message, 500));
  }
};

// Tạo mới nhà cung cấp
export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierCode, name } = req.body;

    // Kiểm tra xem mã code đã tồn tại chưa
    const existing = await prisma.supplier.findUnique({ where: { supplierCode } });
    if (existing) return next(new AppError('Mã nhà cung cấp này đã tồn tại!', 400));

    const supplier = await prisma.supplier.create({
      data: { supplierCode, name }
    });

    res.status(201).json({ status: 'success', data: supplier });
  } catch (error: any) {
    next(new AppError(error.message, 500));
  }
};

// Cập nhật nhà cung cấp
export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, supplierCode } = req.body;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: { name, supplierCode }
    });

    res.status(200).json({ status: 'success', data: supplier });
  } catch (error: any) {
    next(new AppError(error.message, 500));
  }
};

// Xóa nhà cung cấp (Cẩn thận: sẽ lỗi nếu đã có giao dịch kho)
export const deleteSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.supplier.delete({ where: { id } });
    res.status(204).json({ status: 'success', data: null });
  } catch (error: any) {
    next(new AppError('Không thể xóa nhà cung cấp này vì đã có dữ liệu liên quan!', 400));
  }
};
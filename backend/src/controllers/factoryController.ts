import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

// 1. Lấy danh sách nhà máy (Kèm số lượng Kho và Phòng ban)
export const getAllFactories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const factories = await prisma.factory.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { 
          select: { 
            warehouses: true, 
            departments: true 
          } 
        }
      }
    });
    res.status(200).json({ status: 'success', data: factories });
  } catch (error) { 
    next(error); 
  }
};

// 2. Lấy chi tiết một nhà máy (Kèm danh sách các Kho bên trong)
export const getFactoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const factory = await prisma.factory.findUnique({
      where: { id },
      include: {
        warehouses: true,
        departments: true
      }
    });

    if (!factory) return next(new AppError('Không tìm thấy nhà máy này', 404));

    res.status(200).json({ status: 'success', data: factory });
  } catch (error) {
    next(error);
  }
};

// 3. Tạo nhà máy mới
export const createFactory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, address } = req.body;

    const factory = await prisma.factory.create({
      data: { name, address }
    });

    res.status(201).json({ status: 'success', data: factory });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return next(new AppError('Tên nhà máy đã tồn tại trong hệ thống', 400));
    }
    next(error);
  }
};

// 4. Cập nhật thông tin nhà máy
export const updateFactory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, address } = req.body;

    const factory = await prisma.factory.update({
      where: { id },
      data: { name, address }
    });

    res.status(200).json({ status: 'success', data: factory });
  } catch (error: any) {
    if (error.code === 'P2025') return next(new AppError('Nhà máy không tồn tại', 404));
    next(error);
  }
};

// 5. Xóa nhà máy (Có kiểm tra ràng buộc dữ liệu)
export const deleteFactory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem nhà máy có đang chứa Kho hoặc Phòng ban nào không
    const factory = await prisma.factory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { warehouses: true, departments: true }
        }
      }
    });

    if (!factory) return next(new AppError('Nhà máy không tồn tại', 404));

    if (factory._count.warehouses > 0 || factory._count.departments > 0) {
      return next(new AppError(
        `Không thể xóa! Nhà máy đang quản lý ${factory._count.warehouses} kho và ${factory._count.departments} phòng ban.`, 
        400
      ));
    }

    await prisma.factory.delete({ where: { id } });

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa nhà máy thành công'
    });
  } catch (error) {
    next(error);
  }
};
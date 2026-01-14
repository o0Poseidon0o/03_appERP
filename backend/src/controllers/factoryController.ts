import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

// 1. Lấy danh sách nhà máy
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

// 2. Lấy chi tiết
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

// 3. Tạo mới
export const createFactory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, address } = req.body;
    const factory = await prisma.factory.create({
      data: { name, address }
    });
    res.status(201).json({ status: 'success', data: factory });
  } catch (error: any) {
    if (error.code === 'P2002') return next(new AppError('Tên nhà máy đã tồn tại', 400));
    next(error);
  }
};

// 4. Cập nhật
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

// 5. Xóa
export const deleteFactory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const factory = await prisma.factory.findUnique({
      where: { id },
      include: {
        _count: { select: { warehouses: true, departments: true } }
      }
    });

    if (!factory) return next(new AppError('Nhà máy không tồn tại', 404));

    if (factory._count.warehouses > 0 || factory._count.departments > 0) {
      return next(new AppError(
        `Không thể xóa! Đang chứa ${factory._count.warehouses} kho và ${factory._count.departments} phòng ban.`, 
        400
      ));
    }

    await prisma.factory.delete({ where: { id } });
    res.status(200).json({ status: 'success', message: 'Đã xóa nhà máy' });
  } catch (error) {
    next(error);
  }
};
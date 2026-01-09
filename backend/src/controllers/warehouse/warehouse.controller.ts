import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';

export const createWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, warehouseCode, factoryId } = req.body;
    const newWarehouse = await prisma.warehouse.create({
      data: { name, warehouseCode, factoryId },
    });
    res.status(201).json({ status: 'success', data: newWarehouse });
  } catch (error) {
    next(new AppError('Mã kho đã tồn tại', 400));
  }
};

export const getAllWarehouses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    // Kiểm tra quyền (Đảm bảo Middleware protect đã nạp role cho user)
    const canViewAll = user.roleId === 'ROLE-ADMIN'; 

    const warehouses = await prisma.warehouse.findMany({
      where: canViewAll ? {} : { factoryId: user.departmentId },
      include: { 
        factory: true, 
        _count: { select: { locations: true } } 
      }
    });
    res.status(200).json({ status: 'success', data: warehouses });
  } catch (error) {
    next(new AppError('Lỗi lấy danh sách kho', 500));
  }
};

export const addLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { warehouseId, locationCode } = req.body;
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) return next(new AppError('Kho không tồn tại', 404));

    const qrCode = `${warehouse.warehouseCode}-${locationCode}`.toUpperCase();

    const location = await prisma.location.create({
      data: { warehouseId, locationCode, qrCode }
    });
    res.status(201).json({ status: 'success', data: location });
  } catch (error) {
    next(new AppError('Tọa độ hoặc mã QR đã tồn tại', 400));
  }
};

export const updateWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, factoryId } = req.body;
    const updated = await prisma.warehouse.update({
      where: { id },
      data: { name, factoryId }
    });
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(new AppError('Không tìm thấy kho', 404));
  }
};

export const deleteWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const locationCount = await prisma.location.count({ where: { warehouseId: id } });
    if (locationCount > 0) return next(new AppError('Kho còn vị trí kệ, không thể xóa!', 400));

    await prisma.warehouse.delete({ where: { id } });
    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    next(new AppError('Lỗi khi xóa kho', 500));
  }
};
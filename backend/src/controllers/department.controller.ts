import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

// 1. Lấy danh sách phòng ban (KÈM SỐ LƯỢNG NHÂN SỰ & THÔNG TIN NHÀ MÁY)
export const getAllDepartments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { id: 'asc' },
      include: {
        factory: { // Hiển thị xem phòng ban này thuộc nhà máy nào (Vĩnh Lộc, HCM...)
          select: { name: true, address: true }
        },
        _count: {
          select: { users: true } 
        }
      }
    });

    res.status(200).json({
      status: 'success',
      results: departments.length,
      data: departments
    });
  } catch (error) {
    next(error);
  }
};

// 2. Tạo phòng ban mới (Hỗ trợ nạp factoryId nếu cần)
export const createDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, name, name_content, factoryId } = req.body;

    const existDept = await prisma.department.findUnique({ where: { id } });
    if (existDept) return next(new AppError('Mã ID đã tồn tại!', 400));

    // Kiểm tra factoryId nếu người dùng có truyền lên
    if (factoryId) {
      const existFactory = await prisma.factory.findUnique({ where: { id: factoryId } });
      if (!existFactory) return next(new AppError('Nhà máy (factoryId) không tồn tại!', 400));
    }

    const newDept = await prisma.department.create({
      data: { 
        id, 
        name, 
        name_content: name_content || name,
        factoryId // Gán phòng ban vào nhà máy vật lý
      }
    });
    res.status(201).json({ status: 'success', data: newDept });
  } catch (error) { next(error); }
};

// 3. Cập nhật phòng ban (Cho phép đổi nhà máy hoặc tên)
export const updateDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, name_content, factoryId } = req.body;

    const updatedDept = await prisma.department.update({
      where: { id },
      data: { 
        name, 
        name_content,
        factoryId // Ví dụ: Chuyển phòng Kế Toán từ nhà máy A sang nhà máy B
      }
    });
    res.status(200).json({ status: 'success', data: updatedDept });
  } catch (error) { 
    next(new AppError('Lỗi cập nhật hoặc ID không tồn tại', 404)); 
  }
};

// 4. Xóa phòng ban (Giữ nguyên logic an toàn của bạn)
export const deleteDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    if (!dept) return next(new AppError('Không tìm thấy phòng ban', 404));

    if (dept._count.users > 0) {
      return next(new AppError(`Không thể xóa! Đang có ${dept._count.users} nhân viên.`, 400));
    }

    await prisma.department.delete({ where: { id } });

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa phòng ban thành công'
    });
  } catch (error) {
    next(error);
  }
};
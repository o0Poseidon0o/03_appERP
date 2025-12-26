import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

// 1. Lấy danh sách phòng ban (KÈM SỐ LƯỢNG NHÂN SỰ)
export const getAllDepartments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { id: 'asc' }, // Sắp xếp cho gọn
      include: {
        _count: {
          select: { users: true } // <--- ĐÂY LÀ PHẦN QUAN TRỌNG
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

// 2. Tạo phòng ban mới
export const createDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, name, code } = req.body;

    // Kiểm tra trùng ID
    const existDept = await prisma.department.findUnique({ where: { id } });
    if (existDept) {
      return next(new AppError('Mã ID phòng ban này đã tồn tại!', 400));
    }

    const newDept = await prisma.department.create({
      data: { 
        id, 
        name, 
        // Nếu code gửi lên bị trống, lấy id làm code để tránh lỗi Prisma
        code: code || id 
      }
    });

    res.status(201).json({
      status: 'success',
      data: newDept
    });
  } catch (error) {
    next(error);
  }
};

// 3. Cập nhật phòng ban
export const updateDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    const updatedDept = await prisma.department.update({
      where: { id },
      data: { name, code }
    });

    res.status(200).json({ status: 'success', data: updatedDept });
  } catch (error) {
    next(new AppError('Không tìm thấy phòng ban hoặc lỗi cập nhật', 404));
  }
};

// --- THÊM MỚI: Xóa phòng ban ---
export const deleteDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 1. Kiểm tra xem phòng ban này có tồn tại không & đếm số nhân viên bên trong
    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true } // Đếm số user đang thuộc phòng này
        }
      }
    });

    if (!dept) {
      return next(new AppError('Không tìm thấy phòng ban với ID này', 404));
    }

    // 2. Logic an toàn: Nếu còn nhân viên thì KHÔNG cho xóa
    if (dept._count.users > 0) {
      return next(new AppError(`Không thể xóa! Phòng ban này đang có ${dept._count.users} nhân viên. Vui lòng chuyển nhân viên đi nơi khác trước.`, 400));
    }

    // 3. Nếu rỗng thì cho xóa
    await prisma.department.delete({ where: { id } });

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa phòng ban thành công'
    });

  } catch (error) {
    next(error);
  }
};
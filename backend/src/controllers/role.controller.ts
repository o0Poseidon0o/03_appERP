import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

// 1. Lấy danh sách tất cả Permissions (Để hiện checkbox bên Frontend)
export const getAllPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { module: 'asc' } // Sắp xếp theo nhóm (USER, SYSTEM...)
    });
    res.status(200).json({ status: 'success', data: permissions });
  } catch (error) {
    next(error);
  }
};

// 2. Lấy danh sách Role (Kèm theo danh sách quyền của role đó)
export const getRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true } // Join để lấy tên quyền
        },
        _count: { select: { users: true } } // Đếm số người đang giữ role này
      }
    });
    res.status(200).json({ status: 'success', data: roles });
  } catch (error) {
    next(error);
  }
};

// 3. Tạo Role mới
export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, name, description, permissionIds } = req.body; 
    // permissionIds là mảng các ID quyền: ["USER_VIEW", "DEPT_CREATE"...]

    // Check trùng ID
    const exist = await prisma.role.findUnique({ where: { id } });
    if (exist) return next(new AppError('Mã Role này đã tồn tại!', 400));

    // Tạo Role và gán quyền cùng lúc
    const newRole = await prisma.role.create({
      data: {
        id,
        name,
        description,
        permissions: {
          create: permissionIds.map((pId: string) => ({ permissionId: pId }))
        }
      },
      include: { permissions: true }
    });

    res.status(201).json({ status: 'success', data: newRole });
  } catch (error) {
    next(error);
  }
};

// 4. Cập nhật Role (Sửa tên + Chọn lại quyền)
export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, permissionIds } = req.body;

    // Sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
    // (Xóa hết quyền cũ -> Gán quyền mới)
    await prisma.$transaction(async (tx) => {
      // B1: Update thông tin cơ bản
      await tx.role.update({
        where: { id },
        data: { name, description }
      });

      if (permissionIds) {
        // B2: Xóa hết các quyền cũ trong bảng RolePermission
        await tx.rolePermission.deleteMany({
          where: { roleId: id }
        });

        // B3: Thêm các quyền mới
        const newPerms = permissionIds.map((pId: string) => ({
          roleId: id,
          permissionId: pId
        }));
        
        await tx.rolePermission.createMany({ data: newPerms });
      }
    });

    res.status(200).json({ status: 'success', message: 'Cập nhật Role thành công' });
  } catch (error) {
    next(error);
  }
};

// 5. Xóa Role
export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (id === 'ROLE-ADMIN') return next(new AppError('Không thể xóa Role Admin hệ thống!', 403));

    // Check xem có user nào đang dùng Role này không
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } }
    });

    if (!role) return next(new AppError('Role không tồn tại', 404));
    
    if (role._count.users > 0) {
      return next(new AppError(`Đang có ${role._count.users} nhân viên giữ vai trò này. Hãy chuyển họ sang vai trò khác trước khi xóa.`, 400));
    }

    await prisma.role.delete({ where: { id } });

    res.status(200).json({ status: 'success', message: 'Xóa Role thành công' });
  } catch (error) {
    next(error);
  }
};
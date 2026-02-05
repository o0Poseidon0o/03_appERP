import { NextFunction, Request, Response } from "express";
import prisma from "../config/prisma";
import { AppError } from '../utils/AppError';
import bcrypt from 'bcryptjs';

/**
 * @desc    Lấy danh sách tất cả nhân sự kèm Role, Phòng ban, Nhà máy và Quyền riêng lẻ
 * @route   GET /api/users
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
        roleId: true,
        departmentId: true,
        factoryId: true,
        
        role: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        
        userPermissions: {
          select: { permissionId: true }
        }
      },
      orderBy: { id: 'asc' }
    });
    
    res.status(200).json({
      status: "success",
      data: users
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Lỗi máy chủ khi lấy danh sách nhân sự" });
  }
};

export const getAllAvailablePermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const permissions = await prisma.permission.findMany({
          orderBy: [
            { module: 'asc' },
            { name: 'asc' }
          ]
        });
        
        res.status(200).json({
          status: "success",
          data: permissions
        });
      } catch (error) {
        next(new AppError("Không thể tải danh mục quyền hạn", 500));
      }
};

/**
 * @desc    Tạo nhân viên mới (Admin tạo)
 * @route   POST /api/users
 */
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, email, fullName, departmentId, roleId, factoryId, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return next(new AppError("Email này đã được sử dụng!", 400));

    const existingId = await prisma.user.findUnique({ where: { id } });
    if (existingId) return next(new AppError(`Mã nhân viên '${id}' đã tồn tại!`, 400));

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        id,
        email,
        fullName,
        password: hashedPassword,
        departmentId,
        roleId,
        factoryId: factoryId || null,
        isActive: true,
        mustChangePassword: true,
      },
    });

    const { password: _, ...userData } = newUser;
    res.status(201).json({ status: "success", data: userData });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cập nhật thông tin cơ bản của nhân viên (Bao gồm cả Email)
 * @route   PATCH /api/users/:id
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // [UPDATE] Lấy thêm trường email từ body
    const { fullName, email, departmentId, roleId, factoryId, isActive, password } = req.body;

    const updateData: any = { 
        fullName, 
        departmentId, 
        roleId, 
        isActive,
        factoryId: factoryId || null 
    };

    // [LOGIC MỚI] Kiểm tra trùng Email nếu có thay đổi
    if (email) {
        // Tìm xem có ai đang dùng email này không
        const existingEmailUser = await prisma.user.findUnique({
            where: { email }
        });

        // Nếu tìm thấy user có email này NHƯNG ID lại khác với ID đang sửa 
        // => Tức là trùng với người khác
        if (existingEmailUser && existingEmailUser.id !== id) {
            return next(new AppError("Email này đã được sử dụng bởi nhân viên khác!", 400));
        }

        // Nếu hợp lệ thì thêm vào data để update
        updateData.email = email;
    }

    // Cập nhật mật khẩu nếu có
    if (password && password.trim().length >= 6) {
      updateData.password = await bcrypt.hash(password, 10);
      updateData.mustChangePassword = true;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    const { password: _, ...result } = updatedUser;
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    // console.log(error); // Debug nếu cần
    next(new AppError("Không tìm thấy người dùng hoặc lỗi dữ liệu", 404));
  }
};

/**
 * @desc    Cập nhật quyền riêng lẻ (Ghi đè)
 * @route   PATCH /api/users/:id/permissions
 */
export const updateUserPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params; 
      const { permissionIds } = req.body; 
  
      await prisma.$transaction([
        prisma.userPermission.deleteMany({
          where: { userId: id }
        }),
        ...(permissionIds && permissionIds.length > 0 
          ? [prisma.userPermission.createMany({
              data: permissionIds.map((pId: string) => ({
                userId: id,
                permissionId: pId
              }))
            })] 
          : [])
      ]);
  
      res.status(200).json({
        status: "success",
        message: "Cập nhật quyền đặc biệt thành công."
      });
    } catch (error) {
      next(new AppError("Lỗi hệ thống khi cập nhật quyền đặc biệt", 500));
    }
  };
  
  /**
   * @desc    Xóa nhân viên vĩnh viễn
   * @route   DELETE /api/users/:id
   */
  export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
  
      if (id === "ADMIN-01") {
        return next(new AppError("Không thể xóa tài khoản Quản trị viên hệ thống!", 403));
      }
  
      await prisma.user.delete({ where: { id } });
      
      res.status(200).json({
        status: "success",
        message: "Đã xóa nhân sự vĩnh viễn khỏi hệ thống."
      });
    } catch (error: any) {
      if (error.code === "P2003") {
        return next(new AppError("Không thể xóa vì nhân sự này đã có dữ liệu ràng buộc. Hãy sử dụng chức năng 'Khóa tài khoản'.", 400));
      }
      next(error);
    }
  };
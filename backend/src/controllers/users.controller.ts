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
        factoryId: true, // [NEW] Lấy ID nhà máy
        
        role: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } }, // [NEW] Lấy tên nhà máy để hiển thị table
        
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

// ... (Hàm getAllAvailablePermissions giữ nguyên) ...
export const getAllAvailablePermissions = async (req: Request, res: Response, next: NextFunction) => {
    // ... (Giữ nguyên code cũ)
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
    // [UPDATE] Nhận thêm factoryId từ frontend
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
        
        // [NEW] Lưu factoryId (nếu user không chọn thì là null)
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
 * @desc    Cập nhật thông tin cơ bản của nhân viên
 * @route   PATCH /api/users/:id
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // [UPDATE] Nhận thêm factoryId
    const { fullName, departmentId, roleId, factoryId, isActive, password } = req.body;

    // [UPDATE] Thêm factoryId vào object update
    const updateData: any = { 
        fullName, 
        departmentId, 
        roleId, 
        isActive,
        factoryId: factoryId || null // Cho phép gán null để xóa nhà máy khỏi user
    };

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
    next(new AppError("Không tìm thấy người dùng hoặc lỗi dữ liệu", 404));
  }
};

// ... (Các hàm updateUserPermissions, deleteUser giữ nguyên) ...
export const updateUserPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params; 
      const { permissionIds } = req.body; // Mảng string ID quyền: ["USER_VIEW", "POST_DELETE"]
  
      // Sử dụng Transaction để đảm bảo tính toàn vẹn (Xóa sạch cũ - Nạp lại mới)
      await prisma.$transaction([
        // 1. Xóa các quyền riêng lẻ cũ
        prisma.userPermission.deleteMany({
          where: { userId: id }
        }),
        // 2. Thêm các quyền mới nếu có
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
  
      // Chặn xóa tài khoản Admin tối cao
      if (id === "ADMIN-01") {
        return next(new AppError("Không thể xóa tài khoản Quản trị viên hệ thống!", 403));
      }
  
      await prisma.user.delete({ where: { id } });
      
      res.status(200).json({
        status: "success",
        message: "Đã xóa nhân sự vĩnh viễn khỏi hệ thống."
      });
    } catch (error: any) {
      // Lỗi P2003: Ràng buộc khóa ngoại (User đã có bài viết, thông báo...)
      if (error.code === "P2003") {
        return next(new AppError("Không thể xóa vì nhân sự này đã có dữ liệu ràng buộc. Hãy sử dụng chức năng 'Khóa tài khoản'.", 400));
      }
      next(error);
    }
  };
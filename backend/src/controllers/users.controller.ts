import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AppError } from '../utils/AppError';
import bcrypt from 'bcryptjs';
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true, // <--- Thêm cái này để hiển thị trạng thái
        roleId: true, // <--- Thêm cái này để Frontend biết ID role
        departmentId: true, // <--- Thêm cái này
        role: { select: { name: true } },
        department: { select: { name: true } },
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Lỗi server" });
  }
};

// 1. Tạo nhân viên mới (Admin tạo, không phải tự đăng ký)
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, email, fullName, departmentId, roleId, password } = req.body;

    // Check tồn tại
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return next(new AppError("Email này đã được sử dụng!", 400));

    const existingId = await prisma.user.findUnique({ where: { id } });
    if (existingId) {
        return next(new AppError(`Mã '${id}' đã tồn tại!`, 400));
     }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        id, // NV002
        email,
        fullName,
        password: hashedPassword,
        departmentId,
        roleId,
        isActive: true,
        mustChangePassword: true, // Admin tạo xong thì user đăng nhập lần đầu phải đổi pass
      },
    });

    // Trả về info (bỏ pass)
    const { password: _, ...userData } = newUser;

    res.status(201).json({
      status: "success",
      data: userData,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Cập nhật thông tin nhân viên (Đổi phòng ban, đổi role)
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { fullName, departmentId, roleId, isActive } = req.body;

    // Không cho phép đổi password ở đây (phải dùng API riêng)
    // Không cho phép đổi email/id dễ dàng (logic nghiệp vụ)

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { fullName, departmentId, roleId, isActive },
    });

    res.status(200).json({ status: "success", data: updatedUser });
  } catch (error) {
    next(new AppError("Không tìm thấy user", 404));
  }
};

// --- THÊM MỚI: Xóa nhân viên (Hard Delete) ---
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // 1. Bảo vệ Super Admin (Không ai được xóa ông trùm)
    if (id === "ADMIN-01") {
      return next(
        new AppError("Bạn không đủ quyền hạn để xóa Super Admin!", 403)
      );
    }

    // 2. Thực hiện xóa
    // Lưu ý: Nếu User này đã từng viết bài (Post), Prisma sẽ báo lỗi do ràng buộc khóa ngoại.
    // Lúc đó ta nên khuyên Admin dùng chức năng "Khóa tài khoản" (isActive=false) thay vì xóa.
    await prisma.user.delete({
      where: { id },
    });

    res.status(200).json({
      status: "success",
      message: "Đã xóa nhân viên vĩnh viễn.",
    });
  } catch (error: any) {
    // Bắt lỗi ràng buộc dữ liệu của Prisma (Mã P2003)
    if (error.code === "P2003") {
      return next(
        new AppError(
          "Không thể xóa nhân viên này vì họ đã tạo dữ liệu trong hệ thống (Bài viết, Đơn hàng...). Vui lòng dùng chức năng Khóa tài khoản.",
          400
        )
      );
    }
    next(error);
  }
};

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import { signToken, comparePassword } from '../utils/authHelper';
import { sendTempPasswordEmail } from '../services/emailService';
import bcrypt from 'bcryptjs';

// 1. LOGIN BẰNG ID (NV001)
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, password } = req.body;

    if (!id || !password) {
      return next(new AppError('Vui lòng nhập Mã nhân viên và Mật khẩu!', 400));
    }

    // Lấy thông tin User kèm Role (quyền nhóm) và UserPermissions (quyền đặc biệt)
    const user = await prisma.user.findUnique({
      where: { id },
      include: { 
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        },
        userPermissions: { // Lấy các quyền gán riêng cho User
          include: { permission: true }
        },
        department: true 
      }
    });

    if (!user || !(await comparePassword(password, user.password))) {
      return next(new AppError('Mã nhân viên hoặc mật khẩu sai!', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Tài khoản đã bị khóa!', 403));
    }

    // --- LOGIC HỢP NHẤT QUYỀN TRƯỚC KHI TRẢ VỀ FRONTEND ---
    const rolePerms = user.role?.permissions.map(p => p.permissionId) || [];
    const specialPerms = user.userPermissions.map(p => p.permissionId) || [];
    
    // Gộp 2 mảng và loại bỏ trùng lặp
    const mergedPermissions = Array.from(new Set([...rolePerms, ...specialPerms]));

    const token = signToken(user.id);
    
    // Loại bỏ password khỏi dữ liệu trả về
    const { password: _, ...userData } = user;

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: {
          ...userData,
          allPermissions: mergedPermissions // Frontend sẽ dùng mảng này để phân quyền UI
        },
        requirePasswordChange: user.mustChangePassword 
      }
    });

  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return next(new AppError('Mã nhân viên không tồn tại trong hệ thống!', 404));
    }

    if (!user.email) {
      return next(new AppError('Tài khoản này chưa cập nhật email. Vui lòng liên hệ IT!', 400));
    }

    const tempPass = Math.random().toString(36).slice(-6).toUpperCase();
    const hashedTempPass = await bcrypt.hash(tempPass, 10);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedTempPass,
        mustChangePassword: true 
      }
    });

    try {
      await sendTempPasswordEmail(user.email, tempPass);
    } catch (mailError) {
      console.error(">>> [EMAIL ERROR]", mailError);
      return next(new AppError('Lỗi hệ thống gửi thư. Vui lòng thử lại sau!', 500));
    }

    res.status(200).json({
      status: 'success',
      message: `Mật khẩu tạm đã được gửi tới email đăng ký của bạn.`
    });

  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.user?.id; 
        const { currentPassword, newPassword } = req.body;

        const user = await prisma.user.findUnique({ where: { id } });
        if(!user) return next(new AppError('User không tồn tại', 404));

        const isMatch = await comparePassword(currentPassword, user.password);
        if (!isMatch) return next(new AppError('Mật khẩu hiện tại không đúng', 401));

        const hashedNewPass = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id },
            data: {
                password: hashedNewPass,
                mustChangePassword: false 
            }
        });

        res.status(200).json({ status: 'success', message: 'Đổi mật khẩu thành công!' });

    } catch (error) {
        next(error);
    }
}
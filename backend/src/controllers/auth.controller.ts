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

    // --- SỬA ĐOẠN NÀY (QUAN TRỌNG NHẤT) ---
    // Phải include lồng nhau để lấy ra danh sách quyền chi tiết
    const user = await prisma.user.findUnique({
      where: { id },
      include: { 
        role: {
          include: {
            permissions: {
              include: { permission: true } // Lấy tên và ID của quyền (USER_VIEW...)
            }
          }
        },
        department: true // Nên lấy thêm thông tin phòng ban để hiển thị nếu cần
      }
    });
    // ---------------------------------------

    if (!user || !(await comparePassword(password, user.password))) {
      return next(new AppError('Mã nhân viên hoặc mật khẩu sai!', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Tài khoản đã bị khóa!', 403));
    }

    const token = signToken(user.id);
    const { password: _, ...userData } = user;

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: userData,
        requirePasswordChange: user.mustChangePassword 
      }
    });

  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body; // Lấy ID từ Frontend gửi lên

    // 1. Tìm User
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return next(new AppError('Mã nhân viên không tồn tại trong hệ thống!', 404));
    }

    // 2. Kiểm tra User có Email không
    if (!user.email) {
      return next(new AppError('Tài khoản này chưa cập nhật email. Vui lòng liên hệ IT!', 400));
    }

    // 3. Tạo mật khẩu tạm (Ví dụ: 6 ký tự viết hoa)
    const tempPass = Math.random().toString(36).slice(-6).toUpperCase();
    const hashedTempPass = await bcrypt.hash(tempPass, 10);

    // 4. Cập nhật DB trước khi gửi mail
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedTempPass,
        mustChangePassword: true 
      }
    });

    // 5. Gửi Mail (Bọc vào try-catch riêng để log lỗi nếu mail server sập)
    try {
      await sendTempPasswordEmail(user.email, tempPass);
    } catch (mailError) {
      console.error(">>> [EMAIL ERROR]", mailError);
      // Vẫn báo lỗi 500 nhưng log rõ là do Mail để bạn sửa
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

// 3. ĐỔI MẬT KHẨU (Giữ nguyên, code này tốt)
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // req.user được middleware 'protect' gán vào
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
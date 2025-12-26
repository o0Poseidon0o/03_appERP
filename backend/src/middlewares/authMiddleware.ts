import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

// Khai báo kiểu dữ liệu cho Payload trong Token
interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

// 1. Middleware PROTECT (Bảo vệ - Yêu cầu phải đăng nhập)
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Lấy token từ Header
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Dạng gửi lên: "Bearer <token_dai_ngoang>"
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Bạn chưa đăng nhập! Vui lòng đăng nhập để truy cập.', 401));
    }

    // 2. Verify Token (Kiểm tra chữ ký và hạn sử dụng)
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    // 3. Kiểm tra xem user chủ sở hữu token còn tồn tại không?
    // (Đề phòng trường hợp user bị xóa khỏi DB nhưng token cũ vẫn còn hạn)
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true } // Lấy kèm role để dùng cho middleware phân quyền sau này
    });

    if (!currentUser) {
      return next(new AppError('Người dùng sở hữu token này không còn tồn tại.', 401));
    }

    // 4. Kiểm tra xem user có bị khóa (isActive = false) sau khi login không?
    if (!currentUser.isActive) {
        return next(new AppError('Tài khoản này đã bị khóa.', 403));
    }

    // 5. Gán user vào request để các Controller phía sau sử dụng
    req.user = currentUser;
    next();
    
  } catch (error) {
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn!', 401));
  }
};

// 2. Middleware RESTRICT TO (Phân quyền - Chỉ Admin mới được vào)
// Truyền vào danh sách các Role ID được phép. VD: restrictTo('ROLE-ADMIN', 'ROLE-MANAGER')
export const restrictTo = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // req.user đã có nhờ middleware protect chạy trước đó
    if (!req.user || !req.user.role || !allowedRoles.includes(req.user.role.id)) {
      return next(new AppError('Bạn không có quyền thực hiện hành động này!', 403));
    }
    next();
  };
};
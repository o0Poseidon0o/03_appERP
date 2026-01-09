import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

// 1. Middleware PROTECT (Xác thực người dùng & Hợp nhất quyền)
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Bạn chưa đăng nhập!', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    // --- Lấy User kèm theo Role -> Permissions và UserPermissions ---
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { 
        role: {
          include: {
            permissions: true // Quyền gán cho Role
          }
        },
        userPermissions: true // Quyền gán riêng cho User
      }
    });

    if (!currentUser) {
      return next(new AppError('Người dùng không tồn tại.', 401));
    }

    if (!currentUser.isActive) {
      return next(new AppError('Tài khoản này đã bị khóa.', 403));
    }

    // --- LOGIC HỢP NHẤT QUYỀN (Merged Permissions) ---
    // 1. Lấy mã quyền từ Role
    const rolePerms = currentUser.role?.permissions.map(p => p.permissionId) || [];
    
    // 2. Lấy mã quyền riêng lẻ
    const individualPerms = currentUser.userPermissions.map(p => p.permissionId) || [];

    // 3. Gộp lại thành mảng duy nhất không trùng lặp
    const mergedPermissions = Array.from(new Set([...rolePerms, ...individualPerms]));

    // Gán thông tin vào Request
    // allPermissions sẽ được dùng trong middleware hasPermission bên dưới
    req.user = {
      ...currentUser,
      allPermissions: mergedPermissions 
    };

    next();
    
  } catch (error) {
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn!', 401));
  }
};

// 2. Middleware RESTRICT TO (Dùng khi muốn chặn cứng theo tên Role - ví dụ: chỉ cho ADMIN vào)
export const restrictTo = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.roleId)) {
      return next(new AppError('Bạn không có quyền truy cập chức năng này!', 403));
    }
    next();
  };
};

// 3. Middleware HAS PERMISSION (Dùng để kiểm tra quyền chi tiết - DEPT_VIEW, USER_CREATE...)
export const hasPermission = (permissionId: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return next(new AppError('Không tìm thấy thông tin người dùng.', 401));
    }

    // ƯU TIÊN: Nếu là ROLE-ADMIN thì luôn luôn cho qua, không cần check mảng quyền
    if (user.roleId === 'ROLE-ADMIN') {
      return next();
    }

    // Kiểm tra trong mảng quyền đã được hợp nhất ở middleware protect
    const userPermissions = (user as any).allPermissions || [];

    if (!userPermissions.includes(permissionId)) {
      return next(
        new AppError(`Bạn không có quyền thực hiện hành động này. Cần quyền: ${permissionId}`, 403)
      );
    }

    next();
  };
};
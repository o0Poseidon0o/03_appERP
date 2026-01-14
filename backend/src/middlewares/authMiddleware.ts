import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

// =========================================================================
// 1. MIDDLEWARE PROTECT (Xác thực & Lấy thông tin User đầy đủ)
// =========================================================================
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

    // --- Lấy User kèm theo Role, Permissions VÀ QUAN TRỌNG LÀ DEPARTMENT ---
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { 
        role: {
          include: {
            permissions: true // Để lấy quyền từ Role
          }
        },
        userPermissions: true, // Để lấy quyền riêng
        
        // [QUAN TRỌNG - ĐÃ SỬA]: Lấy thông tin Phòng ban & Nhà máy
        department: {
            include: {
                factory: true 
            }
        } 
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

    // 3. Gộp lại thành mảng duy nhất
    const mergedPermissions = Array.from(new Set([...rolePerms, ...individualPerms]));

    // Gán thông tin vào Request để Controller dùng
    req.user = {
      ...currentUser,
      allPermissions: mergedPermissions 
    };

    next();
    
  } catch (error) {
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn!', 401));
  }
};

// =========================================================================
// 2. MIDDLEWARE RESTRICT TO (Chặn theo Role cứng)
// =========================================================================
export const restrictTo = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.roleId)) {
      return next(new AppError('Bạn không có quyền truy cập chức năng này!', 403));
    }
    next();
  };
};

// =========================================================================
// 3. MIDDLEWARE HAS PERMISSION (Chặn theo quyền chi tiết)
// =========================================================================
export const hasPermission = (permissionId: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return next(new AppError('Không tìm thấy thông tin người dùng.', 401));
    }

    // Admin luôn được qua
    if (user.roleId === 'ROLE-ADMIN') {
      return next();
    }

    const userPermissions = (user as any).allPermissions || [];

    if (!userPermissions.includes(permissionId)) {
      return next(
        new AppError(`Bạn không có quyền thực hiện hành động này. Cần quyền: ${permissionId}`, 403)
      );
    }

    next();
  };
};
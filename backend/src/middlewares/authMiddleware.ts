import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

// 1. Middleware PROTECT (Bảo vệ - Phải đăng nhập)
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

    // --- CẬP NHẬT: Lấy cả quyền từ Role và quyền riêng lẻ của User ---
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { 
        role: {
          include: {
            permissions: true // Quyền theo nhóm (RolePermission)
          }
        },
        userPermissions: true // Quyền đặc biệt gán riêng (UserPermission)
      }
    });

    if (!currentUser) {
      return next(new AppError('Người dùng không tồn tại.', 401));
    }

    if (!currentUser.isActive) {
      return next(new AppError('Tài khoản này đã bị khóa.', 403));
    }

    // --- LOGIC HỢP NHẤT QUYỀN ---
    // 1. Lấy danh sách ID quyền từ Role
    const rolePerms = currentUser.role?.permissions.map(p => p.permissionId) || [];
    
    // 2. Lấy danh sách ID quyền riêng lẻ của User
    const individualPerms = currentUser.userPermissions.map(p => p.permissionId) || [];

    // 3. Gộp lại và loại bỏ các ID trùng lặp bằng Set
    const mergedPermissions = Array.from(new Set([...rolePerms, ...individualPerms]));

    // Gán user và mảng quyền tổng hợp vào request để dùng ở các middleware sau hoặc Controller
    // Lưu ý: Bạn nên cập nhật file express.d.ts để thêm thuộc tính userPermissions vào Request
    req.user = {
      ...currentUser,
      allPermissions: mergedPermissions 
    };

    next();
    
  } catch (error) {
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn!', 401));
  }
};

// 2. Middleware RESTRICT TO (Phân quyền theo Nhóm Role)
export const restrictTo = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.roleId)) {
      return next(new AppError('Bạn không có quyền truy cập vai trò này!', 403));
    }
    next();
  };
};

// 3. Middleware HAS PERMISSION (Kiểm tra quyền chi tiết sau khi đã hợp nhất)
export const hasPermission = (permissionId: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    // Admin luôn có quyền tối thượng
    if (user.roleId === 'ROLE-ADMIN') return next();

    // Kiểm tra trong mảng quyền đã được hợp nhất ở bước protect
    const userPermissions = (user as any).allPermissions || [];

    if (!userPermissions.includes(permissionId)) {
      return next(new AppError(`Bạn không có quyền thực hiện: ${permissionId}`, 403));
    }

    next();
  };
};
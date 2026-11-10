"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPermission = exports.restrictTo = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../config/prisma"));
const AppError_1 = require("../utils/AppError");
const protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            return next(new AppError_1.AppError('Bạn chưa đăng nhập!', 401));
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const currentUser = await prisma_1.default.user.findUnique({
            where: { id: decoded.id },
            include: {
                role: {
                    include: {
                        permissions: true
                    }
                },
                userPermissions: true,
                department: {
                    include: {
                        factory: true
                    }
                }
            }
        });
        if (!currentUser) {
            return next(new AppError_1.AppError('Người dùng không tồn tại.', 401));
        }
        if (!currentUser.isActive) {
            return next(new AppError_1.AppError('Tài khoản này đã bị khóa.', 403));
        }
        const rolePerms = currentUser.role?.permissions.map(p => p.permissionId) || [];
        const individualPerms = currentUser.userPermissions.map(p => p.permissionId) || [];
        const mergedPermissions = Array.from(new Set([...rolePerms, ...individualPerms]));
        req.user = {
            ...currentUser,
            allPermissions: mergedPermissions
        };
        next();
    }
    catch (error) {
        return next(new AppError_1.AppError('Token không hợp lệ hoặc đã hết hạn!', 401));
    }
};
exports.protect = protect;
const restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.roleId)) {
            return next(new AppError_1.AppError('Bạn không có quyền truy cập chức năng này!', 403));
        }
        next();
    };
};
exports.restrictTo = restrictTo;
const hasPermission = (permissionId) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return next(new AppError_1.AppError('Không tìm thấy thông tin người dùng.', 401));
        }
        if (user.roleId === 'ROLE-ADMIN') {
            return next();
        }
        const userPermissions = user.allPermissions || [];
        if (!userPermissions.includes(permissionId)) {
            return next(new AppError_1.AppError(`Bạn không có quyền thực hiện hành động này. Cần quyền: ${permissionId}`, 403));
        }
        next();
    };
};
exports.hasPermission = hasPermission;

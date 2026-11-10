"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.forgotPassword = exports.login = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const AppError_1 = require("../utils/AppError");
const authHelper_1 = require("../utils/authHelper");
const emailService_1 = require("../services/emailService");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const login = async (req, res, next) => {
    try {
        const { id, password } = req.body;
        if (!id || !password) {
            return next(new AppError_1.AppError('Vui lòng nhập Mã nhân viên và Mật khẩu!', 400));
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                },
                userPermissions: {
                    include: { permission: true }
                },
                department: true,
                factory: true
            }
        });
        if (!user || !(await (0, authHelper_1.comparePassword)(password, user.password))) {
            return next(new AppError_1.AppError('Mã nhân viên hoặc mật khẩu sai!', 401));
        }
        if (!user.isActive) {
            return next(new AppError_1.AppError('Tài khoản đã bị khóa!', 403));
        }
        const rolePerms = user.role?.permissions.map(p => p.permissionId) || [];
        const specialPerms = user.userPermissions.map(p => p.permissionId) || [];
        const mergedPermissions = Array.from(new Set([...rolePerms, ...specialPerms]));
        const token = (0, authHelper_1.signToken)(user.id);
        const { password: _, ...userData } = user;
        res.status(200).json({
            status: 'success',
            token,
            data: {
                user: {
                    ...userData,
                    allPermissions: mergedPermissions
                },
                requirePasswordChange: user.mustChangePassword
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const forgotPassword = async (req, res, next) => {
    try {
        const { id } = req.body;
        const user = await prisma_1.default.user.findUnique({ where: { id } });
        if (!user) {
            return next(new AppError_1.AppError('Mã nhân viên không tồn tại trong hệ thống!', 404));
        }
        if (!user.email) {
            return next(new AppError_1.AppError('Tài khoản này chưa cập nhật email. Vui lòng liên hệ IT!', 400));
        }
        const tempPass = Math.random().toString(36).slice(-6).toUpperCase();
        const hashedTempPass = await bcryptjs_1.default.hash(tempPass, 10);
        await prisma_1.default.user.update({
            where: { id },
            data: {
                password: hashedTempPass,
                mustChangePassword: true
            }
        });
        try {
            await (0, emailService_1.sendTempPasswordEmail)(user.email, tempPass);
        }
        catch (mailError) {
            console.error(">>> [EMAIL ERROR]", mailError);
            return next(new AppError_1.AppError('Lỗi hệ thống gửi thư. Vui lòng thử lại sau!', 500));
        }
        res.status(200).json({
            status: 'success',
            message: `Mật khẩu tạm đã được gửi tới email đăng ký của bạn.`
        });
    }
    catch (error) {
        next(error);
    }
};
exports.forgotPassword = forgotPassword;
const changePassword = async (req, res, next) => {
    try {
        const id = req.user?.id;
        const { currentPassword, newPassword } = req.body;
        const user = await prisma_1.default.user.findUnique({ where: { id } });
        if (!user)
            return next(new AppError_1.AppError('User không tồn tại', 404));
        const isMatch = await (0, authHelper_1.comparePassword)(currentPassword, user.password);
        if (!isMatch)
            return next(new AppError_1.AppError('Mật khẩu hiện tại không đúng', 401));
        const hashedNewPass = await bcryptjs_1.default.hash(newPassword, 10);
        await prisma_1.default.user.update({
            where: { id },
            data: {
                password: hashedNewPass,
                mustChangePassword: false
            }
        });
        res.status(200).json({ status: 'success', message: 'Đổi mật khẩu thành công!' });
    }
    catch (error) {
        next(error);
    }
};
exports.changePassword = changePassword;

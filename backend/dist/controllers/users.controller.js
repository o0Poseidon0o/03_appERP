"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMyProfile = exports.deleteUser = exports.updateUserPermissions = exports.updateUser = exports.createUser = exports.getAllAvailablePermissions = exports.getUsers = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const AppError_1 = require("../utils/AppError");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const getUsers = async (req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
            select: {
                id: true,
                fullName: true,
                email: true,
                isActive: true,
                roleId: true,
                departmentId: true,
                factoryId: true,
                role: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                factory: { select: { id: true, name: true } },
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
    }
    catch (error) {
        res.status(500).json({ status: "error", message: "Lỗi máy chủ khi lấy danh sách nhân sự" });
    }
};
exports.getUsers = getUsers;
const getAllAvailablePermissions = async (req, res, next) => {
    try {
        const permissions = await prisma_1.default.permission.findMany({
            orderBy: [
                { module: 'asc' },
                { name: 'asc' }
            ]
        });
        res.status(200).json({
            status: "success",
            data: permissions
        });
    }
    catch (error) {
        next(new AppError_1.AppError("Không thể tải danh mục quyền hạn", 500));
    }
};
exports.getAllAvailablePermissions = getAllAvailablePermissions;
const createUser = async (req, res, next) => {
    try {
        const { id, email, fullName, departmentId, roleId, factoryId, password } = req.body;
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            return next(new AppError_1.AppError("Email này đã được sử dụng!", 400));
        const existingId = await prisma_1.default.user.findUnique({ where: { id } });
        if (existingId)
            return next(new AppError_1.AppError(`Mã nhân viên '${id}' đã tồn tại!`, 400));
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const newUser = await prisma_1.default.user.create({
            data: {
                id,
                email,
                fullName,
                password: hashedPassword,
                departmentId,
                roleId,
                factoryId: factoryId || null,
                isActive: true,
                mustChangePassword: true,
            },
        });
        const { password: _, ...userData } = newUser;
        res.status(201).json({ status: "success", data: userData });
    }
    catch (error) {
        next(error);
    }
};
exports.createUser = createUser;
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { fullName, email, departmentId, roleId, factoryId, isActive, password } = req.body;
        const updateData = {
            fullName,
            departmentId,
            roleId,
            isActive,
            factoryId: factoryId || null
        };
        if (email) {
            const existingEmailUser = await prisma_1.default.user.findUnique({
                where: { email }
            });
            if (existingEmailUser && existingEmailUser.id !== id) {
                return next(new AppError_1.AppError("Email này đã được sử dụng bởi nhân viên khác!", 400));
            }
            updateData.email = email;
        }
        if (password && password.trim().length >= 6) {
            updateData.password = await bcryptjs_1.default.hash(password, 10);
            updateData.mustChangePassword = true;
        }
        const updatedUser = await prisma_1.default.user.update({
            where: { id },
            data: updateData,
        });
        const { password: _, ...result } = updatedUser;
        res.status(200).json({ status: "success", data: result });
    }
    catch (error) {
        next(new AppError_1.AppError("Không tìm thấy người dùng hoặc lỗi dữ liệu", 404));
    }
};
exports.updateUser = updateUser;
const updateUserPermissions = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { permissionIds } = req.body;
        await prisma_1.default.$transaction([
            prisma_1.default.userPermission.deleteMany({
                where: { userId: id }
            }),
            ...(permissionIds && permissionIds.length > 0
                ? [prisma_1.default.userPermission.createMany({
                        data: permissionIds.map((pId) => ({
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
    }
    catch (error) {
        next(new AppError_1.AppError("Lỗi hệ thống khi cập nhật quyền đặc biệt", 500));
    }
};
exports.updateUserPermissions = updateUserPermissions;
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (id === "ADMIN-01") {
            return next(new AppError_1.AppError("Không thể xóa tài khoản Quản trị viên hệ thống!", 403));
        }
        await prisma_1.default.user.delete({ where: { id } });
        res.status(200).json({
            status: "success",
            message: "Đã xóa nhân sự vĩnh viễn khỏi hệ thống."
        });
    }
    catch (error) {
        if (error.code === "P2003") {
            return next(new AppError_1.AppError("Không thể xóa vì nhân sự này đã có dữ liệu ràng buộc. Hãy sử dụng chức năng 'Khóa tài khoản'.", 400));
        }
        next(error);
    }
};
exports.deleteUser = deleteUser;
const updateMyProfile = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { fullName } = req.body;
        if (!userId)
            return next(new AppError_1.AppError("Vui lòng đăng nhập", 401));
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { fullName }
        });
        res.status(200).json({ status: "success", data: updatedUser });
    }
    catch (error) {
        next(new AppError_1.AppError("Lỗi hệ thống khi cập nhật profile", 500));
    }
};
exports.updateMyProfile = updateMyProfile;

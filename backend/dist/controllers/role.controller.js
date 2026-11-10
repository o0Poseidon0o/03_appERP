"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRole = exports.updateRole = exports.createRole = exports.getRoles = exports.getAllPermissions = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const AppError_1 = require("../utils/AppError");
const getAllPermissions = async (req, res, next) => {
    try {
        const permissions = await prisma_1.default.permission.findMany({
            orderBy: { module: 'asc' }
        });
        res.status(200).json({ status: 'success', data: permissions });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllPermissions = getAllPermissions;
const getRoles = async (req, res, next) => {
    try {
        const roles = await prisma_1.default.role.findMany({
            include: {
                permissions: {
                    include: { permission: true }
                },
                _count: { select: { users: true } }
            }
        });
        res.status(200).json({ status: 'success', data: roles });
    }
    catch (error) {
        next(error);
    }
};
exports.getRoles = getRoles;
const createRole = async (req, res, next) => {
    try {
        const { id, name, description, permissionIds } = req.body;
        const exist = await prisma_1.default.role.findUnique({ where: { id } });
        if (exist)
            return next(new AppError_1.AppError('Mã Role này đã tồn tại!', 400));
        const newRole = await prisma_1.default.role.create({
            data: {
                id,
                name,
                description,
                permissions: {
                    create: permissionIds.map((pId) => ({ permissionId: pId }))
                }
            },
            include: { permissions: true }
        });
        res.status(201).json({ status: 'success', data: newRole });
    }
    catch (error) {
        next(error);
    }
};
exports.createRole = createRole;
const updateRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, permissionIds } = req.body;
        await prisma_1.default.$transaction(async (tx) => {
            await tx.role.update({
                where: { id },
                data: { name, description }
            });
            if (permissionIds) {
                await tx.rolePermission.deleteMany({
                    where: { roleId: id }
                });
                const newPerms = permissionIds.map((pId) => ({
                    roleId: id,
                    permissionId: pId
                }));
                await tx.rolePermission.createMany({ data: newPerms });
            }
        });
        res.status(200).json({ status: 'success', message: 'Cập nhật Role thành công' });
    }
    catch (error) {
        next(error);
    }
};
exports.updateRole = updateRole;
const deleteRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (id === 'ROLE-ADMIN')
            return next(new AppError_1.AppError('Không thể xóa Role Admin hệ thống!', 403));
        const role = await prisma_1.default.role.findUnique({
            where: { id },
            include: { _count: { select: { users: true } } }
        });
        if (!role)
            return next(new AppError_1.AppError('Role không tồn tại', 404));
        if (role._count.users > 0) {
            return next(new AppError_1.AppError(`Đang có ${role._count.users} nhân viên giữ vai trò này. Hãy chuyển họ sang vai trò khác trước khi xóa.`, 400));
        }
        await prisma_1.default.role.delete({ where: { id } });
        res.status(200).json({ status: 'success', message: 'Xóa Role thành công' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteRole = deleteRole;

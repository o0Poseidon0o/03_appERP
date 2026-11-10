"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDepartment = exports.updateDepartment = exports.createDepartment = exports.getAllDepartments = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const AppError_1 = require("../utils/AppError");
const getAllDepartments = async (req, res, next) => {
    try {
        const departments = await prisma_1.default.department.findMany({
            orderBy: { id: 'asc' },
            include: {
                factory: {
                    select: { name: true, address: true }
                },
                _count: {
                    select: { users: true }
                }
            }
        });
        res.status(200).json({
            status: 'success',
            results: departments.length,
            data: departments
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllDepartments = getAllDepartments;
const createDepartment = async (req, res, next) => {
    try {
        const { id, name, name_content, factoryId } = req.body;
        const existDept = await prisma_1.default.department.findUnique({ where: { id } });
        if (existDept)
            return next(new AppError_1.AppError('Mã ID đã tồn tại!', 400));
        if (factoryId) {
            const existFactory = await prisma_1.default.factory.findUnique({ where: { id: factoryId } });
            if (!existFactory)
                return next(new AppError_1.AppError('Nhà máy (factoryId) không tồn tại!', 400));
        }
        const newDept = await prisma_1.default.department.create({
            data: {
                id,
                name,
                name_content: name_content || name,
                factoryId
            }
        });
        res.status(201).json({ status: 'success', data: newDept });
    }
    catch (error) {
        next(error);
    }
};
exports.createDepartment = createDepartment;
const updateDepartment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, name_content, factoryId } = req.body;
        const updatedDept = await prisma_1.default.department.update({
            where: { id },
            data: {
                name,
                name_content,
                factoryId
            }
        });
        res.status(200).json({ status: 'success', data: updatedDept });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi cập nhật hoặc ID không tồn tại', 404));
    }
};
exports.updateDepartment = updateDepartment;
const deleteDepartment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const dept = await prisma_1.default.department.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { users: true }
                }
            }
        });
        if (!dept)
            return next(new AppError_1.AppError('Không tìm thấy phòng ban', 404));
        if (dept._count.users > 0) {
            return next(new AppError_1.AppError(`Không thể xóa! Đang có ${dept._count.users} nhân viên.`, 400));
        }
        await prisma_1.default.department.delete({ where: { id } });
        res.status(200).json({
            status: 'success',
            message: 'Đã xóa phòng ban thành công'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteDepartment = deleteDepartment;

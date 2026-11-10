"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFactory = exports.updateFactory = exports.createFactory = exports.getFactoryById = exports.getAllFactories = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const AppError_1 = require("../utils/AppError");
const getAllFactories = async (req, res, next) => {
    try {
        const factories = await prisma_1.default.factory.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        warehouses: true,
                        departments: true,
                        users: true
                    }
                }
            }
        });
        res.status(200).json({ status: 'success', data: factories });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllFactories = getAllFactories;
const getFactoryById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const factory = await prisma_1.default.factory.findUnique({
            where: { id },
            include: {
                warehouses: true,
                departments: true,
                _count: { select: { users: true } }
            }
        });
        if (!factory)
            return next(new AppError_1.AppError('Không tìm thấy nhà máy này', 404));
        res.status(200).json({ status: 'success', data: factory });
    }
    catch (error) {
        next(error);
    }
};
exports.getFactoryById = getFactoryById;
const createFactory = async (req, res, next) => {
    try {
        const { name, address } = req.body;
        const factory = await prisma_1.default.factory.create({
            data: { name, address }
        });
        res.status(201).json({ status: 'success', data: factory });
    }
    catch (error) {
        if (error.code === 'P2002')
            return next(new AppError_1.AppError('Tên nhà máy đã tồn tại', 400));
        next(error);
    }
};
exports.createFactory = createFactory;
const updateFactory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, address } = req.body;
        const factory = await prisma_1.default.factory.update({
            where: { id },
            data: { name, address }
        });
        res.status(200).json({ status: 'success', data: factory });
    }
    catch (error) {
        if (error.code === 'P2025')
            return next(new AppError_1.AppError('Nhà máy không tồn tại', 404));
        next(error);
    }
};
exports.updateFactory = updateFactory;
const deleteFactory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const factory = await prisma_1.default.factory.findUnique({
            where: { id },
            include: {
                _count: { select: { warehouses: true, departments: true, users: true } }
            }
        });
        if (!factory)
            return next(new AppError_1.AppError('Nhà máy không tồn tại', 404));
        if (factory._count.warehouses > 0 || factory._count.departments > 0 || factory._count.users > 0) {
            return next(new AppError_1.AppError(`Không thể xóa! Đang chứa ${factory._count.warehouses} kho, ${factory._count.departments} phòng ban và ${factory._count.users} nhân sự.`, 400));
        }
        await prisma_1.default.factory.delete({ where: { id } });
        res.status(200).json({ status: 'success', message: 'Đã xóa nhà máy' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteFactory = deleteFactory;

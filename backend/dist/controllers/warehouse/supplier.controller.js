"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSupplier = exports.updateSupplier = exports.createSupplier = exports.getAllSuppliers = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const AppError_1 = require("../../utils/AppError");
const getAllSuppliers = async (req, res, next) => {
    try {
        const { search } = req.query;
        const suppliers = await prisma_1.default.supplier.findMany({
            where: search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { supplierCode: { contains: search, mode: 'insensitive' } }
                ]
            } : {},
            orderBy: { name: 'asc' }
        });
        res.status(200).json({ status: 'success', data: suppliers });
    }
    catch (error) {
        next(new AppError_1.AppError(error.message, 500));
    }
};
exports.getAllSuppliers = getAllSuppliers;
const createSupplier = async (req, res, next) => {
    try {
        const { supplierCode, name } = req.body;
        const existing = await prisma_1.default.supplier.findUnique({ where: { supplierCode } });
        if (existing)
            return next(new AppError_1.AppError('Mã nhà cung cấp này đã tồn tại!', 400));
        const supplier = await prisma_1.default.supplier.create({
            data: { supplierCode, name }
        });
        res.status(201).json({ status: 'success', data: supplier });
    }
    catch (error) {
        next(new AppError_1.AppError(error.message, 500));
    }
};
exports.createSupplier = createSupplier;
const updateSupplier = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, supplierCode } = req.body;
        const supplier = await prisma_1.default.supplier.update({
            where: { id },
            data: { name, supplierCode }
        });
        res.status(200).json({ status: 'success', data: supplier });
    }
    catch (error) {
        next(new AppError_1.AppError(error.message, 500));
    }
};
exports.updateSupplier = updateSupplier;
const deleteSupplier = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.default.supplier.delete({ where: { id } });
        res.status(204).json({ status: 'success', data: null });
    }
    catch (error) {
        next(new AppError_1.AppError('Không thể xóa nhà cung cấp này vì đã có dữ liệu liên quan!', 400));
    }
};
exports.deleteSupplier = deleteSupplier;

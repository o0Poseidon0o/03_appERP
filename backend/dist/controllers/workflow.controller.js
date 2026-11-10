"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteWorkflow = exports.updateWorkflow = exports.createWorkflow = exports.getAllWorkflows = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const AppError_1 = require("../utils/AppError");
const getAllWorkflows = async (req, res, next) => {
    try {
        const workflows = await prisma_1.default.workflow.findMany({
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                    include: {
                        role: true,
                    }
                },
                _count: {
                    select: { tickets: true }
                }
            },
            orderBy: { code: 'asc' }
        });
        res.status(200).json({ status: 'success', data: workflows });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi tải danh sách quy trình', 500));
    }
};
exports.getAllWorkflows = getAllWorkflows;
const createWorkflow = async (req, res, next) => {
    try {
        const { name, code, targetType, description, steps, allowedInitiatorRoles } = req.body;
        if (!steps || steps.length === 0) {
            return next(new AppError_1.AppError('Quy trình phải có ít nhất 1 bước duyệt.', 400));
        }
        const newWorkflow = await prisma_1.default.workflow.create({
            data: {
                name,
                code,
                targetType: targetType || 'STOCK',
                description,
                allowedInitiatorRoles: allowedInitiatorRoles || [],
                steps: {
                    create: steps.map((step, index) => ({
                        name: step.name,
                        order: step.order || index + 1,
                        approverType: step.approverType,
                        roleId: step.roleId || null,
                        specificUserId: step.specificUserId || null,
                    }))
                }
            },
            include: { steps: true }
        });
        res.status(201).json({ status: 'success', data: newWorkflow });
    }
    catch (error) {
        if (error.code === 'P2002') {
            return next(new AppError_1.AppError(`Mã quy trình '${req.body.code}' đã tồn tại.`, 400));
        }
        next(new AppError_1.AppError('Lỗi tạo quy trình: ' + error.message, 400));
    }
};
exports.createWorkflow = createWorkflow;
const updateWorkflow = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, steps, isActive, allowedInitiatorRoles, targetType } = req.body;
        const existingWorkflow = await prisma_1.default.workflow.findUnique({ where: { id } });
        if (!existingWorkflow)
            return next(new AppError_1.AppError('Không tìm thấy quy trình', 404));
        const updatedWorkflow = await prisma_1.default.$transaction(async (tx) => {
            await tx.workflowStep.deleteMany({ where: { workflowId: id } });
            return await tx.workflow.update({
                where: { id },
                data: {
                    name,
                    description,
                    isActive,
                    targetType,
                    allowedInitiatorRoles: allowedInitiatorRoles || [],
                    steps: {
                        create: steps.map((step, index) => ({
                            name: step.name,
                            order: step.order || index + 1,
                            approverType: step.approverType,
                            roleId: step.roleId || null,
                            specificUserId: step.specificUserId || null
                        }))
                    }
                },
                include: { steps: true }
            });
        });
        res.status(200).json({ status: 'success', data: updatedWorkflow });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi cập nhật quy trình', 500));
    }
};
exports.updateWorkflow = updateWorkflow;
const deleteWorkflow = async (req, res, next) => {
    try {
        const { id } = req.params;
        const usedCount = await prisma_1.default.ticket.count({ where: { workflowId: id } });
        if (usedCount > 0) {
            return next(new AppError_1.AppError('Không thể xóa: Đã có phiếu đang chạy trên quy trình này. Hãy tắt kích hoạt (Active = false).', 400));
        }
        await prisma_1.default.workflow.delete({ where: { id } });
        res.status(200).json({ status: 'success', message: 'Đã xóa quy trình thành công' });
    }
    catch (error) {
        next(new AppError_1.AppError('Lỗi xóa quy trình', 500));
    }
};
exports.deleteWorkflow = deleteWorkflow;

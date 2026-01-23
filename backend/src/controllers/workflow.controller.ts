import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

// ==========================================
// 1. Lấy danh sách Workflow (GET)
// ==========================================
export const getAllWorkflows = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workflows = await prisma.workflow.findMany({
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: { 
            role: true, // Lấy tên Role
            // [OPTIONAL] Nếu trong schema bạn có relation specificUser thì include vào đây
            // user: true 
          }
        },
        _count: {
            select: { tickets: true }
        }
      },
      orderBy: { code: 'asc' }
    });

    res.status(200).json({ status: 'success', data: workflows });
  } catch (error) {
    next(new AppError('Lỗi tải danh sách quy trình', 500));
  }
};

// ==========================================
// 2. Tạo Workflow Mới (POST)
// ==========================================
export const createWorkflow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, code, targetType, description, steps, allowedInitiatorRoles } = req.body;

    if (!steps || steps.length === 0) {
        return next(new AppError('Quy trình phải có ít nhất 1 bước duyệt.', 400));
    }

    const newWorkflow = await prisma.workflow.create({
      data: {
        name,
        code, 
        targetType: targetType || 'STOCK',
        description,
        allowedInitiatorRoles: allowedInitiatorRoles || [], 

        steps: {
          create: steps.map((step: any, index: number) => ({
            name: step.name,
            order: step.order || index + 1,
            
            // [FIXED] Nhận đúng loại approver từ Frontend gửi lên
            approverType: step.approverType, // 'ROLE' | 'SPECIFIC_USER' | 'CREATOR'
            
            // [FIXED] Map đúng ID tương ứng
            roleId: step.roleId || null,
            specificUserId: step.specificUserId || null, // <-- QUAN TRỌNG: Lưu người cụ thể
          }))
        }
      },
      include: { steps: true }
    });

    res.status(201).json({ status: 'success', data: newWorkflow });
  } catch (error: any) {
    if (error.code === 'P2002') {
        return next(new AppError(`Mã quy trình '${req.body.code}' đã tồn tại.`, 400));
    }
    next(new AppError('Lỗi tạo quy trình: ' + error.message, 400));
  }
};

// ==========================================
// 3. Cập nhật Workflow (PUT)
// ==========================================
export const updateWorkflow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, steps, isActive, allowedInitiatorRoles, targetType } = req.body;

    const existingWorkflow = await prisma.workflow.findUnique({ where: { id } });
    if (!existingWorkflow) return next(new AppError('Không tìm thấy quy trình', 404));

    const updatedWorkflow = await prisma.$transaction(async (tx) => {
      
      // 1. Xóa các bước cũ
      await tx.workflowStep.deleteMany({ where: { workflowId: id } });

      // 2. Cập nhật thông tin và tạo lại bước mới
      return await tx.workflow.update({
        where: { id },
        data: {
          name,
          description,
          isActive,
          targetType,
          allowedInitiatorRoles: allowedInitiatorRoles || [],

          steps: {
            create: steps.map((step: any, index: number) => ({
              name: step.name,
              order: step.order || index + 1,
              
              // [FIXED] Cập nhật logic map dữ liệu tương tự hàm Create
              approverType: step.approverType, 
              roleId: step.roleId || null,
              specificUserId: step.specificUserId || null // <-- QUAN TRỌNG
            }))
          }
        },
        include: { steps: true }
      });
    });

    res.status(200).json({ status: 'success', data: updatedWorkflow });
  } catch (error) {
    next(new AppError('Lỗi cập nhật quy trình', 500));
  }
};

// ==========================================
// 4. Xóa Workflow (DELETE)
// ==========================================
export const deleteWorkflow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Kiểm tra ràng buộc Ticket trước khi xóa
    const usedCount = await prisma.ticket.count({ where: { workflowId: id } });

    if (usedCount > 0) {
      return next(new AppError('Không thể xóa: Đã có phiếu đang chạy trên quy trình này. Hãy tắt kích hoạt (Active = false).', 400));
    }

    await prisma.workflow.delete({ where: { id } });
    res.status(200).json({ status: 'success', message: 'Đã xóa quy trình thành công' });
  } catch (error) {
    next(new AppError('Lỗi xóa quy trình', 500));
  }
};
import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { sendApprovalNotificationEmail } from '../../services/emailService';

/**
 * 1. TẠO PHIẾU NHẬP KHO (Khởi tạo quy trình duyệt đa cấp)
 */
export const createImportTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierId, details, note, isEmergency } = req.body;
    const userId = req.user.id;
    const departmentId = req.user.departmentId;

    // Lấy quy trình duyệt mặc định từ bảng ApprovalStep
    const approvalSteps = await prisma.approvalStep.findMany({
      orderBy: { order: 'asc' }
    });

    if (approvalSteps.length === 0) {
      return next(new AppError('Hệ thống chưa cấu hình quy trình phê duyệt (Approval Steps)!', 400));
    }

    const ticketCode = `IMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Sử dụng Transaction để tạo đồng thời Phiếu, Chi tiết phiếu và các Bước duyệt
    const transaction = await prisma.$transaction(async (tx) => {
      const newTicket = await tx.stockTransaction.create({
        data: {
          code: ticketCode,
          type: 'IMPORT',
          status: 'PENDING',
          isEmergency: isEmergency || false,
          creatorId: userId,
          supplierId: supplierId,
          // note: note, // Thêm note vào Schema nếu cần, hiện tại Schema của bạn dùng ApprovalLog cho comment
          details: {
            create: details.map((item: any) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              toLocationId: item.locationId,
            })),
          },
        },
      });

      // Khởi tạo các bước duyệt cho phiếu này
      await tx.transactionApproval.createMany({
        data: approvalSteps.map((step) => ({
          transactionId: newTicket.id,
          stepId: step.id,
          status: 'PENDING',
        })),
      });

      return newTicket;
    });

    // Thông báo cho người duyệt ở bước 1 (Step Order 1)
    const firstStep = approvalSteps[0];
    const managers = await prisma.user.findMany({
      where: {
        roleId: firstStep.roleId,
        departmentId: departmentId,
      },
    });

    for (const manager of managers) {
      await prisma.notification.create({
        data: {
          userId: manager.id,
          title: 'Phê duyệt phiếu nhập kho',
          message: `Phiếu ${ticketCode} đang chờ bạn phê duyệt bước: ${firstStep.name}`,
          link: `/warehouse/approval/${transaction.id}`,
        },
      });

      try {
        await sendApprovalNotificationEmail(manager.email, ticketCode, req.user.fullName, 'IMPORT');
      } catch (err) {
        console.error('Email Error:', manager.email);
      }
    }

    res.status(201).json({ status: 'success', data: transaction });
  } catch (error) {
    next(new AppError('Lỗi khi tạo phiếu nhập kho', 500));
  }
};

/**
 * 2. PHÊ DUYỆT TỪNG BƯỚC (Cộng kho khi hoàn tất bước cuối)
 */
export const approveStep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId, comment } = req.body;
    const userId = req.user.id;

    // 1. Lấy thông tin phiếu và các bước duyệt
    const ticket = await prisma.stockTransaction.findUnique({
      where: { id: transactionId },
      include: {
        details: true,
        approvals: {
          include: { step: true },
          orderBy: { step: { order: 'asc' } },
        },
      },
    });

    if (!ticket) return next(new AppError('Không tìm thấy phiếu!', 404));

    // 2. Xác định bước cần duyệt hiện tại
    const currentApproval = ticket.approvals.find((a) => a.status === 'PENDING');
    if (!currentApproval) {
      return next(new AppError('Phiếu này đã hoàn tất quy trình phê duyệt!', 400));
    }

    // 3. Thực hiện duyệt bước này
    await prisma.$transaction(async (tx) => {
      // A. Cập nhật trạng thái bước duyệt
      await tx.transactionApproval.update({
        where: { id: currentApproval.id },
        data: {
          status: 'APPROVED',
          approverId: userId,
        },
      });

      // B. Lưu Log
      await tx.approvalLog.create({
        data: {
          transactionId: ticket.id,
          userId: userId,
          action: `APPROVED: ${currentApproval.step.name}`,
          comment: comment,
        },
      });

      // C. Kiểm tra xem đây có phải bước cuối cùng không
      const isLastStep = ticket.approvals.filter((a) => a.status === 'PENDING').length === 1;

      if (isLastStep) {
        // Cập nhật trạng thái phiếu chính
        await tx.stockTransaction.update({
          where: { id: ticket.id },
          data: { status: 'APPROVED' },
        });

        // Cập nhật bảng STOCK (Ràng buộc Unique: itemId, locationId, supplierId)
        for (const item of ticket.details) {
          await tx.stock.upsert({
            where: {
              itemId_locationId_supplierId: {
                itemId: item.itemId,
                locationId: item.toLocationId!,
                supplierId: ticket.supplierId!,
              },
            },
            update: {
              quantity: { increment: item.quantity },
            },
            create: {
              itemId: item.itemId,
              locationId: item.toLocationId!,
              supplierId: ticket.supplierId!,
              quantity: item.quantity,
            },
          });
        }
      } else {
        // Nếu chưa phải bước cuối, thông báo cho người duyệt ở bước tiếp theo (Optional)
      }
    });

    res.status(200).json({ status: 'success', message: 'Phê duyệt bước thành công' });
  } catch (error) {
    next(new AppError('Lỗi trong quá trình phê duyệt', 500));
  }
};
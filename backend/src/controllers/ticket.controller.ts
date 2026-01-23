import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

// ============================================================================
// HELPER: SINH MÃ PHIẾU TỰ ĐỘNG
// ============================================================================
const generateTicketCode = async (tx: any, type: string, factoryId: string) => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = type === 'IMPORT' ? 'IM' : (type === 'EXPORT' ? 'EX' : 'TR');
  
  const counterKey = `${prefix}-${year}${month}`; 

  const counter = await tx.transactionCounter.upsert({
    where: { key: counterKey },
    update: { count: { increment: 1 } },
    create: { key: counterKey, count: 1 }
  });

  const series = counter.count.toString().padStart(4, '0');
  
  let factorySuffix = '';
  if (factoryId) {
      const factory = await tx.factory.findUnique({ where: { id: factoryId }, select: { name: true } });
      if (factory) factorySuffix = ` | ${factory.name}`;
  }

  return `${prefix}${year}${month}-${series}${factorySuffix}`;
};

// ==========================================
// 1. TẠO PHIẾU MỚI
// ==========================================
export const createTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const { workflowCode, transactionData } = req.body;

    if (!workflowCode) return next(new AppError('Thiếu mã quy trình (workflowCode)', 400));
    if (!transactionData.factoryId) return next(new AppError('Thiếu thông tin Nhà máy', 400));

    const workflow = await prisma.workflow.findUnique({
      where: { code: workflowCode },
      include: { steps: { orderBy: { order: 'asc' } } }
    });

    if (!workflow) return next(new AppError(`Không tìm thấy quy trình: ${workflowCode}`, 404));
    if (!workflow.isActive) return next(new AppError('Quy trình này đang tạm khóa', 400));
    if (workflow.steps.length === 0) return next(new AppError('Quy trình chưa có bước duyệt nào', 400));

    const result = await prisma.$transaction(async (tx) => {
      const ticketCode = await generateTicketCode(tx, transactionData.type, transactionData.factoryId);

      const ticket = await tx.ticket.create({
        data: {
          code: ticketCode,
          workflowId: workflow.id,
          creatorId: userId,
          status: 'PENDING',
          currentStep: 1, 
          
          steps: {
            create: workflow.steps.map(step => ({
              stepId: step.id,
              status: 'PENDING'
            }))
          },
          
          logs: {
            create: { userId: userId, action: 'CREATE', comment: 'Khởi tạo phiếu mới' }
          }
        }
      });

      if (workflow.targetType === 'STOCK') {
        const { type, factoryId, description, details, warehouseKeeperId, receiverId, supplierId } = transactionData;
        
        await tx.stockTransaction.create({
          data: {
            ticketId: ticket.id,
            type, 
            isEmergency: transactionData.isEmergency || false,
            description,
            factoryId,
            warehouseKeeperId,
            receiverId,
            supplierId,
            details: {
              create: details.map((d: any) => ({
                itemId: d.itemId,
                quantity: Number(d.quantity),
                inputUnit: d.inputUnit,
                fromLocationId: d.fromLocationId,
                toLocationId: d.toLocationId,
                usageCategoryId: d.usageCategoryId
              }))
            }
          }
        });
      } 

      return ticket;
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error: any) {
    next(new AppError('Lỗi tạo phiếu: ' + error.message, 500));
  }
};

// ==========================================
// 2. XỬ LÝ DUYỆT (APPROVE)
// ==========================================
export const approveTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;
    const userRoleId = req.user.roleId;

    await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: { 
          steps: { include: { step: true } }, 
          workflow: true,
          stockTransaction: { include: { details: true } }
        }
      });

      if (!ticket) throw new AppError('Không tìm thấy phiếu', 404);
      if (ticket.status !== 'PENDING') throw new AppError('Phiếu này đã hoàn tất hoặc bị hủy', 400);

      const currentStepObj = ticket.steps.find(s => s.step.order === ticket.currentStep);
      if (!currentStepObj) throw new AppError('Lỗi dữ liệu bước duyệt', 500);

      let hasPermission = false;
      if (userRoleId === 'ROLE-ADMIN') hasPermission = true;
      else if (currentStepObj.step.approverType === 'ROLE') {
          if (currentStepObj.step.roleId === userRoleId) hasPermission = true;
      }
      else if (currentStepObj.step.approverType === 'SPECIFIC_USER') {
          if (currentStepObj.step.specificUserId === userId) hasPermission = true;
      }
      else if (currentStepObj.step.approverType === 'CREATOR') {
          if (ticket.creatorId === userId) hasPermission = true;
      }

      if (!hasPermission) throw new AppError('Bạn không có quyền duyệt bước này', 403);

      await tx.ticketStep.update({
        where: { id: currentStepObj.id },
        data: { status: 'APPROVED', actorId: userId, actedAt: new Date(), note: comment }
      });

      const nextStepOrder = ticket.currentStep + 1;
      const isLastStep = !ticket.steps.find(s => s.step.order === nextStepOrder);

      if (isLastStep) {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: 'APPROVED', completedAt: new Date() }
        });

        if (ticket.workflow.targetType === 'STOCK' && ticket.stockTransaction) {
            
            if (ticket.stockTransaction.type === 'IMPORT') {
                for (const detail of ticket.stockTransaction.details) {
                    if (detail.toLocationId) {
                        const existingStock = await tx.stock.findFirst({
                            where: {
                                itemId: detail.itemId,
                                locationId: detail.toLocationId,
                                supplierId: ticket.stockTransaction.supplierId
                            }
                        });

                        if (existingStock) {
                            await tx.stock.update({
                                where: { id: existingStock.id },
                                data: { quantity: { increment: detail.quantity } }
                            });
                        } else {
                            await tx.stock.create({
                                data: {
                                    itemId: detail.itemId,
                                    locationId: detail.toLocationId,
                                    supplierId: ticket.stockTransaction.supplierId,
                                    quantity: detail.quantity
                                }
                            });
                        }
                    }
                }
            }

            else if (ticket.stockTransaction.type === 'EXPORT') {
                for (const detail of ticket.stockTransaction.details) {
                    if (detail.fromLocationId) {
                        const stocks = await tx.stock.findMany({
                            where: { itemId: detail.itemId, locationId: detail.fromLocationId },
                            orderBy: { quantity: 'desc' }
                        });

                        let remaining = detail.quantity;
                        for (const stock of stocks) {
                            if (remaining <= 0) break;
                            const deduct = Math.min(stock.quantity, remaining);
                            await tx.stock.update({
                                where: { id: stock.id },
                                data: { quantity: { decrement: deduct } }
                            });
                            remaining -= deduct;
                        }
                        
                        if (remaining > 0) {
                            throw new Error(`Kho thiếu hàng ${detail.itemId}`);
                        }
                    }
                }
            }
        }

      } else {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { currentStep: { increment: 1 } }
        });
      }

      await tx.approvalLog.create({ data: { ticketId, userId, action: 'APPROVE', comment } });
    });

    res.status(200).json({ status: 'success', message: 'Đã duyệt thành công' });
  } catch (error: any) {
    next(new AppError(error.message, 403));
  }
};

// ==========================================
// 3. TỪ CHỐI (REJECT)
// ==========================================
export const rejectTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;
    const userRoleId = req.user.roleId;

    await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: { steps: { include: { step: true } } }
      });

      if (!ticket || ticket.status !== 'PENDING') throw new AppError('Phiếu không hợp lệ', 400);

      const currentStepObj = ticket.steps.find(s => s.step.order === ticket.currentStep);
      
      let hasPermission = false;
      if (userRoleId === 'ROLE-ADMIN') hasPermission = true;
      else if (currentStepObj?.step.approverType === 'ROLE' && currentStepObj.step.roleId === userRoleId) hasPermission = true;
      else if (currentStepObj?.step.approverType === 'SPECIFIC_USER' && currentStepObj.step.specificUserId === userId) hasPermission = true;
      else if (currentStepObj?.step.approverType === 'CREATOR' && ticket.creatorId === userId) hasPermission = true;

      if (!hasPermission) throw new AppError('Bạn không có quyền từ chối bước này', 403);

      await tx.ticketStep.update({
        where: { id: currentStepObj!.id },
        data: { status: 'REJECTED', actorId: userId, actedAt: new Date(), note: comment }
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'REJECTED', completedAt: new Date() }
      });

      await tx.approvalLog.create({ data: { ticketId, userId, action: 'REJECT', comment } });
    });

    res.status(200).json({ status: 'success', message: 'Đã từ chối phiếu' });
  } catch (error: any) {
    next(new AppError(error.message, 403));
  }
};

// ==========================================
// 4. LẤY DANH SÁCH VIỆC CẦN LÀM (FIX MẤT DATA)
// ==========================================
export const getMyPendingTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRoleId = req.user.roleId;
    const userId = req.user.id;

    const tickets = await prisma.ticket.findMany({
      where: { status: 'PENDING' },
      include: {
        // 1. Lấy thông tin người tạo (ID, Tên, Bộ phận)
        creator: { 
            select: { 
                id: true, 
                fullName: true, 
                email: true, 
                department: { select: { name: true, id: true } } 
            } 
        },
        // 2. Lấy thông tin quy trình
        workflow: { select: { name: true, targetType: true } },
        
        // 3. Lấy thông tin kho (FIX: Dùng include để chắc chắn lấy được usageCategory)
        stockTransaction: { 
            include: { 
                factory: { select: { name: true } },
                details: { 
                    include: { 
                        item: true, 
                        fromLocation: true, 
                        toLocation: true, 
                        usageCategory: true // [QUAN TRỌNG] Lấy mã chủng loại
                    } 
                }
            } 
        },
        
        // 4. Lấy thông tin các bước đã duyệt (để hiện chữ ký)
        steps: { 
            include: { 
                step: true, 
                actor: { select: { id: true, fullName: true, email: true } } 
            } 
        } 
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter việc của tôi (Giữ nguyên)
    const myTasks = tickets.filter(ticket => {
        const currentStepObj = ticket.steps.find(s => s.step.order === ticket.currentStep);
        if (!currentStepObj || currentStepObj.status !== 'PENDING') return false;
        
        const config = currentStepObj.step;
        if (config.approverType === 'ROLE') return config.roleId === userRoleId;
        if (config.approverType === 'SPECIFIC_USER') return config.specificUserId === userId;
        if (config.approverType === 'CREATOR') return ticket.creatorId === userId;

        return false;
    });

    res.status(200).json({ status: 'success', data: myTasks });
  } catch (error) {
    next(new AppError('Lỗi tải danh sách cần duyệt', 500));
  }
};

// ==========================================
// 5. CHI TIẾT PHIẾU
// ==========================================
export const getTicketDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        workflow: true,
        creator: { 
            select: { 
                id: true, fullName: true, email: true, 
                department: { select: { name: true, id: true } } 
            } 
        },
        steps: {
          orderBy: { step: { order: 'asc' } },
          include: { 
              step: true, 
              actor: { select: { id: true, fullName: true, email: true } } 
          }
        },
        logs: { orderBy: { createdAt: 'desc' }, include: { user: { select: { fullName: true } } } },
        stockTransaction: {
            include: {
                details: { 
                    include: { 
                        item: true, fromLocation: true, toLocation: true, 
                        usageCategory: true // [QUAN TRỌNG]
                    } 
                },
                factory: true,
                supplier: true
            }
        },
      }
    });
    if (!ticket) return next(new AppError('Không tìm thấy phiếu', 404));
    res.status(200).json({ status: 'success', data: ticket });
  } catch (error) {
    next(new AppError('Lỗi tải chi tiết phiếu', 500));
  }
};
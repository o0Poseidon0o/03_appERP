import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client'; 
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';

// ============================================================================
// HÀM HỖ TRỢ: SINH MÃ PHIẾU TỰ ĐỘNG
// ============================================================================
const generateTransactionCode = async (tx: any, factoryName: string) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2); 
  const mm = String(now.getMonth() + 1).padStart(2, '0'); 
  const counterKey = `COUNTER_${factoryName}_${yy}${mm}`;

  const counter = await tx.transactionCounter.upsert({
    where: { key: counterKey },
    update: { count: { increment: 1 } },
    create: { key: counterKey, count: 1 }
  });

  const sequence = String(counter.count).padStart(3, '0');
  return `${yy}-${mm}-${sequence} | ${factoryName}`;
};

// ============================================================================
// 1. LẤY TỒN KHO THỰC TẾ
// ============================================================================
export const getStockActual = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, search, warehouseId, factoryId, isLowStock } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const whereCondition: any = { quantity: { gt: 0 } };

    if (search) {
      whereCondition.item = {
        OR: [
          { itemCode: { contains: search as string, mode: 'insensitive' } },
          { itemName: { contains: search as string, mode: 'insensitive' } }
        ]
      };
    }
    
    if (warehouseId) {
        whereCondition.location = { warehouseId: warehouseId as string };
    } else if (factoryId) {
        whereCondition.location = { warehouse: { factoryId: factoryId as string } };
    }

    const [total, stocks] = await Promise.all([
      prisma.stock.count({ where: whereCondition }),
      prisma.stock.findMany({
        where: whereCondition,
        include: {
          item: { include: { category: true } },
          location: { include: { warehouse: true } },
          supplier: true
        },
        orderBy: [{ item: { itemCode: 'asc' } }, { location: { locationCode: 'asc' } }],
        take: Number(limit),
        skip: skip
      })
    ]);

    const formattedStocks = stocks.map(stock => ({
      id: stock.id, 
      itemId: stock.itemId, 
      itemCode: stock.item.itemCode, 
      itemName: stock.item.itemName, 
      unit: stock.item.unit,
      category: stock.item.category?.name || 'N/A',
      locationId: stock.locationId, 
      locationCode: stock.location.locationCode, 
      warehouseName: stock.location.warehouse.name,
      quantity: stock.quantity, 
      minStock: stock.item.minStock, 
      supplierName: stock.supplier?.name || 'N/A', 
      isLow: stock.quantity <= stock.item.minStock
    }));

    let finalData = formattedStocks;
    if (isLowStock === 'true') finalData = finalData.filter(s => s.isLow);

    res.status(200).json({ status: 'success', data: finalData, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    next(new AppError('Lỗi lấy dữ liệu tồn kho', 500));
  }
};

// ============================================================================
// 2. CHECK TỒN KHO KHẢ DỤNG
// ============================================================================
export const checkStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId, locationId } = req.query;
    if (!itemId || !locationId) return res.status(200).json({ status: 'success', quantity: 0 });

    const stocks = await prisma.stock.findMany({ where: { itemId: itemId as string, locationId: locationId as string } });
    const physicalQty = stocks.reduce((sum, stock) => sum + stock.quantity, 0);

    const pendingAggregation = await prisma.transactionDetail.aggregate({
        _sum: { quantity: true },
        where: {
            itemId: String(itemId), 
            fromLocationId: String(locationId),
            transaction: { status: 'PENDING', type: 'EXPORT' } 
        }
    });
    
    const pendingQty = pendingAggregation._sum.quantity || 0;
    const availableQty = physicalQty - pendingQty;

    res.status(200).json({ status: 'success', quantity: availableQty > 0 ? availableQty : 0, physical: physicalQty, pending: pendingQty });
  } catch (error) {
    next(new AppError('Lỗi kiểm tra tồn kho', 500));
  }
};

// ============================================================================
// 3. TẠO PHIẾU GIAO DỊCH (UPDATE: AUTO-IMPORT)
// ============================================================================
export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, supplierId, details, description, isEmergency } = req.body;
    const user = req.user as any; 

    const userFactoryId = user.department?.factoryId;
    const userFactoryName = user.department?.factory?.name || 'GEN'; 

    if (!userFactoryId) return next(new AppError('Tài khoản chưa được gán Nhà máy.', 400));

    // Lấy quy trình duyệt (Chỉ áp dụng cho EXPORT, vì IMPORT và TRANSFER logic khác)
    let steps: any[] = [];
    if (type === 'EXPORT') {
        steps = await prisma.approvalStep.findMany({ where: { type }, orderBy: { order: 'asc' } });
        if (['ROLE-LEADER', 'ROLE-MANAGER'].includes(user.roleId)) {
            steps = steps.filter(step => step.roleId !== user.roleId);
        }
    }

    const result = await prisma.$transaction(async (tx) => {
      // --- 1. LOGIC XUẤT/CHUYỂN (TRỪ KHO) ---
      if (['EXPORT', 'TRANSFER'].includes(type)) {
          for (const item of details) {
              if (!item.fromLocationId) continue;

              const stocks = await tx.stock.findMany({ where: { itemId: item.itemId, locationId: item.fromLocationId as string } });
              const physicalQty = stocks.reduce((sum, s) => sum + s.quantity, 0);

              // Check pending EXPORT
              const pendingAgg = await tx.transactionDetail.aggregate({
                  _sum: { quantity: true },
                  where: {
                      itemId: item.itemId, fromLocationId: item.fromLocationId as string,
                      transaction: { status: 'PENDING', type: 'EXPORT' }
                  }
              });
              const pendingQty = pendingAgg._sum.quantity || 0;

              if (item.quantity > (physicalQty - pendingQty)) {
                  const itemInfo = await tx.item.findUnique({ where: { id: item.itemId } });
                  throw new Error(`Vật tư "${itemInfo?.itemName}" không đủ tồn khả dụng.`);
              }

              // TRANSFER: Trừ kho ngay
              if (type === 'TRANSFER') {
                  let remaining = item.quantity;
                  const sortedStocks = stocks.sort((a, b) => b.quantity - a.quantity); 
                  for (const stockBatch of sortedStocks) {
                      if (remaining <= 0) break;
                      const deduct = Math.min(stockBatch.quantity, remaining);
                      await tx.stock.update({ where: { id: stockBatch.id }, data: { quantity: { decrement: deduct } } });
                      remaining -= deduct;
                  }
                  if (remaining > 0) throw new Error(`Lỗi hệ thống: Không trừ đủ tồn kho.`);
              }
          }
      }

      // --- 2. SINH MÃ PHIẾU ---
      const newCode = await generateTransactionCode(tx, userFactoryName);

      // --- 3. XÁC ĐỊNH TRẠNG THÁI ---
      let initialStatus = 'PENDING';
      if (type === 'TRANSFER') initialStatus = 'WAITING_CONFIRM';
      if (type === 'IMPORT') initialStatus = 'APPROVED'; // <--- [UPDATE] IMPORT tự động duyệt luôn

      // --- 4. TẠO PHIẾU ---
      const ticket = await tx.stockTransaction.create({
        data: {
          code: newCode, 
          type, 
          isEmergency: isEmergency || false, 
          description,
          creatorId: user.id, // Người tạo (cũng là người nhập kho nếu là IMPORT)
          supplierId: supplierId || null,
          factoryId: userFactoryId, 
          status: initialStatus,
          completedAt: type === 'IMPORT' ? new Date() : null, // Ghi nhận thời gian hoàn thành ngay
          details: {
            create: details.map((item: any) => ({
              itemId: item.itemId, 
              quantity: Number(item.quantity),
              fromLocationId: item.fromLocationId || null, 
              toLocationId: item.toLocationId || null,
              usageCategoryId: item.usageCategoryId || null,
            }))
          }
        }
      });

      // --- 5. LOGIC IMPORT: CỘNG TỒN KHO NGAY LẬP TỨC ---
      if (type === 'IMPORT') {
          for (const item of details) {
              if (item.toLocationId) {
                  // Cộng dồn vào kho đích
                  await tx.stock.upsert({
                      where: { 
                          itemId_locationId_supplierId: { 
                              itemId: item.itemId, 
                              locationId: item.toLocationId, 
                              supplierId: supplierId 
                          } 
                      },
                      update: { quantity: { increment: Number(item.quantity) } },
                      create: { 
                          itemId: item.itemId, 
                          locationId: item.toLocationId, 
                          supplierId: supplierId, 
                          quantity: Number(item.quantity) 
                      }
                  });
              }
          }
          // Ghi log hệ thống
          await tx.approvalLog.create({
              data: { 
                  transactionId: ticket.id, 
                  userId: user.id, 
                  action: 'AUTO_IMPORT', 
                  comment: 'Hệ thống tự động nhập kho theo yêu cầu.' 
              }
          });
      }

      // --- 6. TẠO BƯỚC DUYỆT (CHỈ CHO EXPORT) ---
      if (type === 'EXPORT' && steps.length > 0) {
        await tx.transactionApproval.createMany({
          data: steps.map(step => ({ transactionId: ticket.id, stepId: step.id, status: 'PENDING' }))
        });
      }

      return ticket;
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error: any) {
    console.error("Lỗi tạo phiếu:", error);
    next(new AppError(error.message || 'Lỗi tạo phiếu', 400));
  }
};

// ============================================================================
// 4. PHÊ DUYỆT & XÁC NHẬN (CONFIRM)
// ============================================================================
export const approveStep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId, comment, action } = req.body;
    const user = req.user as any;
    
    const ticket = await prisma.stockTransaction.findUnique({
      where: { id: transactionId },
      include: {
        creator: true,
        details: { include: { item: true, toLocation: { include: { warehouse: true } } } },
        approvals: { include: { step: true }, orderBy: { step: { order: 'asc' } } }
      }
    });

    if (!ticket) return next(new AppError('Phiếu không tồn tại', 404));

    // A. XÁC NHẬN (WAITING_CONFIRM)
    if (ticket.status === 'WAITING_CONFIRM') {
        let canConfirm = false;

        if (ticket.type === 'EXPORT' && ticket.creatorId === user.id) canConfirm = true;
        else if (ticket.type === 'TRANSFER') {
            const userFactoryId = user.department?.factoryId;
            const destinationFactoryIds = ticket.details.map(d => d.toLocation?.warehouse?.factoryId);
            if ((destinationFactoryIds.includes(userFactoryId) && user.role?.name.includes('KHO')) || ['ADMIN', 'ROLE-MANAGER'].includes(user.role?.name)) {
                canConfirm = true;
            }
        }

        if (!canConfirm) return next(new AppError('Không có quyền xác nhận.', 403));

        if (action === 'APPROVE') {
            await prisma.$transaction(async (tx) => {
                await tx.stockTransaction.update({ where: { id: ticket.id }, data: { status: 'APPROVED', completedAt: new Date() } });

                // TRANSFER: Cộng hàng vào kho đích
                if (ticket.type === 'TRANSFER') {
                    for (const detail of ticket.details) {
                        if (detail.toLocationId) {
                            await tx.stock.upsert({
                                where: { itemId_locationId_supplierId: { itemId: detail.itemId, locationId: detail.toLocationId, supplierId: ticket.supplierId as string } },
                                update: { quantity: { increment: detail.quantity } },
                                create: { itemId: detail.itemId, locationId: detail.toLocationId, supplierId: ticket.supplierId as string, quantity: detail.quantity }
                            });
                        }
                    }
                }
                
                await tx.approvalLog.create({
                    data: { transactionId: ticket.id, userId: user.id, action: 'CONFIRM_RECEIVED', comment: comment || 'Đã xác nhận' }
                });
            });
            return res.status(200).json({ status: 'success', message: 'Đã hoàn tất phiếu.' });
        } 
        else if (action === 'REJECT') {
             // HOÀN TRẢ KHO NGUỒN
             await prisma.$transaction(async (tx) => {
                 await tx.stockTransaction.update({ where: { id: ticket.id }, data: { status: 'REJECTED' } });

                 if (['EXPORT', 'TRANSFER'].includes(ticket.type)) {
                     for (const detail of ticket.details) {
                         if (detail.fromLocationId) {
                             await tx.stock.upsert({
                                 where: { itemId_locationId_supplierId: { itemId: detail.itemId, locationId: detail.fromLocationId!, supplierId: ticket.supplierId as string } },
                                 update: { quantity: { increment: detail.quantity } },
                                 create: { itemId: detail.itemId, locationId: detail.fromLocationId!, supplierId: ticket.supplierId as string, quantity: detail.quantity }
                             });
                         }
                     }
                 }
                 await tx.approvalLog.create({
                    data: { transactionId: ticket.id, userId: user.id, action: 'REJECT_RECEIVE', comment: comment || 'Từ chối - Hoàn kho' }
                 });
             });
             return res.status(200).json({ status: 'success', message: 'Đã hoàn trả tồn kho.' });
        }
    }

    // B. DUYỆT (PENDING)
    const currentApproval = ticket.approvals.find(a => a.status === 'PENDING');
    if (!currentApproval) return next(new AppError('Phiếu không chờ duyệt', 400));
    
    if (currentApproval.step.roleId !== user.roleId && !user.roleId.includes('ADMIN')) return next(new AppError('Chưa đến lượt bạn duyệt', 403));

    await prisma.$transaction(async (tx) => {
      if (action === 'REJECT') {
        await tx.transactionApproval.update({ where: { id: currentApproval.id }, data: { status: 'REJECTED', approverId: user.id } });
        await tx.stockTransaction.update({ where: { id: ticket.id }, data: { status: 'REJECTED' } });
      } else {
        await tx.transactionApproval.update({ where: { id: currentApproval.id }, data: { status: 'APPROVED', approverId: user.id } });

        const isWarehouseStep = currentApproval.step.roleId.includes('KHO') || currentApproval.step.name.toUpperCase().includes('KHO');

        // CHỈ XỬ LÝ KHO CHO EXPORT (IMPORT đã tự động rồi)
        if (isWarehouseStep && ticket.type === 'EXPORT') {
              for (const detail of ticket.details) {
                  const stockBatches = await tx.stock.findMany({ where: { itemId: detail.itemId, locationId: detail.fromLocationId!, quantity: { gt: 0 } }, orderBy: { quantity: 'desc' } });
                  let remaining = detail.quantity;
                  for (const batch of stockBatches) {
                    if (remaining <= 0) break;
                    const deduct = Math.min(batch.quantity, remaining);
                    await tx.stock.update({ where: { id: batch.id }, data: { quantity: { decrement: deduct } } });
                    remaining -= deduct;
                  }
              }
        }

        const isLastApprover = ticket.approvals[ticket.approvals.length - 1].id === currentApproval.id;
        if (isLastApprover && ticket.type === 'EXPORT') {
          await tx.stockTransaction.update({ where: { id: ticket.id }, data: { status: 'WAITING_CONFIRM' } });
        }
      }

      await tx.approvalLog.create({
        data: { transactionId: ticket.id, userId: user.id, action: `${action}: ${currentApproval.step.name}`, comment: comment || '' }
      });
    });

    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    const statusCode = error.message.includes('khả dụng') ? 400 : 500;
    next(new AppError(error.message, statusCode));
  }
};

// ============================================================================
// 5. LẤY DANH SÁCH CẦN DUYỆT
// ============================================================================
export const getMyPendingApprovals = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as any;
        const tickets = await prisma.stockTransaction.findMany({
            where: { status: { in: ['PENDING', 'WAITING_CONFIRM'] } },
            include: {
                creator: { select: { id: true, fullName: true, department: { select: { id: true, name: true } } } },
                details: { include: { item: true, toLocation: { include: { warehouse: true } } } },
                approvals: { include: { step: true }, orderBy: { step: { order: 'asc' } } }
            },
            orderBy: { createdAt: 'desc' }
        });
        
        const myTasks = tickets.map((ticket) => {
            if (ticket.status === 'WAITING_CONFIRM') {
                if (ticket.type === 'TRANSFER') {
                    const userFactoryId = user.department?.factoryId;
                    const destinationFactoryIds = ticket.details.map(d => d.toLocation?.warehouse?.factoryId);
                    if ((destinationFactoryIds.includes(userFactoryId) && user.role?.name.includes('KHO')) || ['ADMIN', 'ROLE-MANAGER'].includes(user.role?.name)) {
                         return { ...ticket, isRequesterStep: true, currentStepName: 'Xác nhận nhập kho' };
                    }
                } else if (ticket.type === 'EXPORT' && ticket.creatorId === user.id) {
                    return { ...ticket, isRequesterStep: true, currentStepName: 'Xác nhận hoàn tất' };
                }
                return null;
            }
            const currentStep = ticket.approvals.find(a => a.status === 'PENDING');
            if (!currentStep) return null;
            if (user.roleId === currentStep.step.roleId || user.roleId.includes('ADMIN')) {
                return { ...ticket, isRequesterStep: false, currentStepName: currentStep.step.name };
            }
            return null;
        }).filter(item => item !== null); 
        
        res.status(200).json({ status: 'success', data: myTasks }); 
    } catch (e) {
        next(new AppError('Lỗi lấy danh sách duyệt', 500));
    }
};

// ============================================================================
// 6. LẤY LỊCH SỬ GIAO DỊCH
// ============================================================================
export const getTransactionHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query; 
    const skip = (Number(page) - 1) * Number(limit);
    const where: Prisma.StockTransactionWhereInput = {};
    if (status) where.status = status as string;
    if (type) where.type = type as string;

    const [total, transactions] = await Promise.all([
      prisma.stockTransaction.count({ where }),
      prisma.stockTransaction.findMany({
        where,
        include: {
          creator: { select: { id: true, fullName: true, email: true, department: { select: { name: true } } } },
          supplier: { select: { id: true, name: true } },
          approvals: { where: { status: 'APPROVED' }, include: { approver: { select: { fullName: true } }, step: { select: { name: true } } }, orderBy: { step: { order: 'asc' } } },
          details: { include: { item: true, fromLocation: true, toLocation: true, usageCategory: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: skip
      })
    ]);

    res.status(200).json({ status: 'success', data: transactions, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    next(new AppError('Lỗi tải lịch sử giao dịch', 500));
  }
};
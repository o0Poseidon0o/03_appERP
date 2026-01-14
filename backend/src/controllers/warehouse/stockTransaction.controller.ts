import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client'; 
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';

// ============================================================================
// 1. LẤY TỒN KHO THỰC TẾ (REPORT)
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
    if (warehouseId) whereCondition.location = { warehouseId: warehouseId as string };
    else if (factoryId) whereCondition.location = { warehouse: { factoryId: factoryId as string } };

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

    // Tồn thực tế
    const stocks = await prisma.stock.findMany({ where: { itemId: itemId as string, locationId: locationId as string } });
    const physicalQty = stocks.reduce((sum, stock) => sum + stock.quantity, 0);

    // Tồn đang bị giữ (Chỉ tính các phiếu EXPORT đang chờ duyệt. TRANSFER giờ trừ thẳng nên không tính là pending nữa)
    const pendingAggregation = await prisma.transactionDetail.aggregate({
        _sum: { quantity: true },
        where: {
            itemId: String(itemId), 
            fromLocationId: String(locationId),
            transaction: { status: 'PENDING', type: 'EXPORT' } // Chỉ tính EXPORT pending
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
// 3. TẠO PHIẾU GIAO DỊCH (LOGIC MỚI: TRANSFER TRỪ LUÔN)
// ============================================================================
export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, supplierId, details, description, isEmergency } = req.body;
    const user = req.user as any; 

    // Chỉ lấy quy trình duyệt nếu KHÔNG PHẢI là TRANSFER
    let steps: any[] = [];
    if (type !== 'TRANSFER') {
        steps = await prisma.approvalStep.findMany({ where: { type }, orderBy: { order: 'asc' } });
        // Nếu là EXPORT và không có steps (hoặc Leader tự tạo), xử lý tùy biến...
        if (steps.length === 0 && type !== 'IMPORT') return next(new AppError(`Chưa cấu hình quy trình duyệt cho loại ${type}`, 400));
        
        if (type === 'EXPORT' && ['ROLE-LEADER', 'ROLE-MANAGER'].includes(user.roleId)) {
            steps = steps.filter(step => step.roleId !== user.roleId);
        }
    }

    const result = await prisma.$transaction(async (tx) => {
      // ---------------------------------------------------------
      // 1. KIỂM TRA & TRỪ TỒN KHO (BƯỚC BẢO VỆ CHỐNG OVERSELLING)
      // ---------------------------------------------------------
      if (['EXPORT', 'TRANSFER'].includes(type)) {
          for (const item of details) {
              if (!item.fromLocationId) continue;

              // Lấy tồn hiện tại trong DB (Lock row nếu cần thiết, ở đây Prisma handle concurrency qua version/check)
              const stocks = await tx.stock.findMany({ where: { itemId: item.itemId, locationId: item.fromLocationId as string } });
              const physicalQty = stocks.reduce((sum, s) => sum + s.quantity, 0);

              // Tính lượng đang chờ (Pending) của các phiếu EXPORT khác
              const pendingAgg = await tx.transactionDetail.aggregate({
                  _sum: { quantity: true },
                  where: {
                      itemId: item.itemId, fromLocationId: item.fromLocationId as string,
                      transaction: { status: 'PENDING', type: 'EXPORT' }
                  }
              });
              const pendingQty = pendingAgg._sum.quantity || 0;

              // Kiểm tra đủ hàng không
              if (item.quantity > (physicalQty - pendingQty)) {
                  const itemInfo = await tx.item.findUnique({ where: { id: item.itemId } });
                  throw new Error(`Vật tư "${itemInfo?.itemName}" không đủ tồn khả dụng (Còn: ${physicalQty - pendingQty}). Ai đó vừa lấy mất!`);
              }

              // [LOGIC MỚI CHO TRANSFER]: TRỪ KHO NGAY LẬP TỨC
              if (type === 'TRANSFER') {
                  let remaining = item.quantity;
                  // Sort để trừ lô nào trước cũng được (VD: FIFO)
                  const sortedStocks = stocks.sort((a, b) => b.quantity - a.quantity); 

                  for (const stockBatch of sortedStocks) {
                      if (remaining <= 0) break;
                      const deduct = Math.min(stockBatch.quantity, remaining);
                      
                      await tx.stock.update({
                          where: { id: stockBatch.id },
                          data: { quantity: { decrement: deduct } }
                      });
                      remaining -= deduct;
                  }
                  
                  // Double check nếu trừ chưa đủ (dù logic check available ở trên đã đảm bảo)
                  if (remaining > 0) throw new Error(`Lỗi hệ thống: Không trừ đủ tồn kho cho ${item.itemId}`);
              }
          }
      }

      // ---------------------------------------------------------
      // 2. TẠO PHIẾU
      // ---------------------------------------------------------
      // Nếu là TRANSFER -> Status là WAITING_CONFIRM (Bỏ qua PENDING)
      // Nếu là EXPORT/IMPORT -> Status là PENDING
      const initialStatus = type === 'TRANSFER' ? 'WAITING_CONFIRM' : 'PENDING';

      const ticket = await tx.stockTransaction.create({
        data: {
          code: `${type.substring(0, 3)}-${Date.now()}`, 
          type, 
          isEmergency: isEmergency || false, 
          description,
          creatorId: user.id, 
          supplierId: supplierId || null,
          status: initialStatus, // <--- Set trạng thái quan trọng tại đây
          details: {
            create: details.map((item: any) => ({
              itemId: item.itemId, 
              quantity: item.quantity,
              fromLocationId: item.fromLocationId || null, 
              toLocationId: item.toLocationId || null,
            }))
          }
        }
      });

      // ---------------------------------------------------------
      // 3. TẠO BƯỚC DUYỆT (CHỈ CHO EXPORT/IMPORT)
      // ---------------------------------------------------------
      if (type !== 'TRANSFER' && steps.length > 0) {
        await tx.transactionApproval.createMany({
          data: steps.map(step => ({ transactionId: ticket.id, stepId: step.id, status: 'PENDING' }))
        });
      } 
      // Nếu là IMPORT mà không có bước duyệt nào -> Duyệt luôn (Optional)
      else if (type === 'IMPORT' && steps.length === 0) {
         await tx.stockTransaction.update({ where: { id: ticket.id }, data: { status: 'APPROVED', completedAt: new Date() } });
      }

      return ticket;
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error: any) {
    console.error("Lỗi tạo phiếu:", error);
    next(new AppError(error.message || 'Lỗi tạo phiếu', 400)); // 400 Bad Request để Frontend hiện thông báo lỗi
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

    // ======================================================
    // A. GIAI ĐOẠN: XÁC NHẬN (WAITING_CONFIRM)
    // Dành cho: TRANSFER (Kho đích), EXPORT (Người tạo)
    // ======================================================
    if (ticket.status === 'WAITING_CONFIRM') {
        let canConfirm = false;

        // 1. EXPORT: Người tạo xác nhận đã nhận hàng
        if (ticket.type === 'EXPORT') {
            if (ticket.creatorId === user.id) canConfirm = true;
        } 
        // 2. TRANSFER: Kho đích xác nhận
        else if (ticket.type === 'TRANSFER') {
            const userFactoryId = user.department?.factoryId;
            const destinationFactoryIds = ticket.details.map(d => d.toLocation?.warehouse?.factoryId);
            
            // Check: User thuộc nhà máy đích VÀ có quyền KHO
            if ((destinationFactoryIds.includes(userFactoryId) && user.role?.name.includes('KHO')) || 
                ['ADMIN', 'ROLE-MANAGER'].includes(user.role?.name)) {
                canConfirm = true;
            }
        }

        if (!canConfirm) return next(new AppError('Bạn không có quyền xác nhận phiếu này.', 403));

        // --- HÀNH ĐỘNG ---
        if (action === 'APPROVE') {
            await prisma.$transaction(async (tx) => {
                await tx.stockTransaction.update({
                    where: { id: ticket.id },
                    data: { status: 'APPROVED', completedAt: new Date() }
                });

                // NẾU LÀ TRANSFER: CỘNG HÀNG VÀO KHO ĐÍCH
                // (Kho nguồn đã bị trừ lúc tạo phiếu rồi)
                if (ticket.type === 'TRANSFER') {
                    for (const detail of ticket.details) {
                        if (detail.toLocationId) {
                            await tx.stock.upsert({
                                where: { 
                                    itemId_locationId_supplierId: { 
                                        itemId: detail.itemId, locationId: detail.toLocationId, supplierId: ticket.supplierId as string 
                                    } 
                                },
                                update: { quantity: { increment: detail.quantity } },
                                create: { 
                                    itemId: detail.itemId, locationId: detail.toLocationId, supplierId: ticket.supplierId as string, quantity: detail.quantity 
                                }
                            });
                        }
                    }
                }
                
                await tx.approvalLog.create({
                    data: { transactionId: ticket.id, userId: user.id, action: 'CONFIRM_RECEIVED', comment: comment || 'Đã nhận đủ hàng' }
                });
            });
            return res.status(200).json({ status: 'success', message: 'Đã hoàn tất phiếu.' });
        } 
        else if (action === 'REJECT') {
             // TỪ CHỐI NHẬN -> HOÀN TRẢ KHO NGUỒN
             await prisma.$transaction(async (tx) => {
                 await tx.stockTransaction.update({ where: { id: ticket.id }, data: { status: 'REJECTED' } });

                 if (['EXPORT', 'TRANSFER'].includes(ticket.type)) {
                     for (const detail of ticket.details) {
                         // Cộng lại kho nguồn
                         if (detail.fromLocationId) {
                             await tx.stock.upsert({
                                 where: { 
                                     itemId_locationId_supplierId: { 
                                         itemId: detail.itemId, locationId: detail.fromLocationId!, supplierId: ticket.supplierId as string
                                     } 
                                 },
                                 update: { quantity: { increment: detail.quantity } },
                                 create: { 
                                     itemId: detail.itemId, locationId: detail.fromLocationId!, supplierId: ticket.supplierId as string, quantity: detail.quantity 
                                 }
                             });
                         }
                     }
                 }
                 await tx.approvalLog.create({
                    data: { transactionId: ticket.id, userId: user.id, action: 'REJECT_RECEIVE', comment: comment || 'Từ chối nhận hàng - Đã hoàn kho' }
                 });
             });
             return res.status(200).json({ status: 'success', message: 'Đã từ chối và hoàn trả tồn kho.' });
        }
    }

    // ======================================================
    // B. GIAI ĐOẠN: DUYỆT (PENDING)
    // Dành cho: EXPORT, IMPORT (Cần quản lý duyệt)
    // ======================================================
    const currentApproval = ticket.approvals.find(a => a.status === 'PENDING');
    if (!currentApproval) return next(new AppError('Phiếu không ở trạng thái chờ duyệt', 400));
    
    if (currentApproval.step.roleId !== user.roleId && !user.roleId.includes('ADMIN')) {
         return next(new AppError(`Chưa đến lượt bạn. Cần: ${currentApproval.step.name}`, 403));
    }

    await prisma.$transaction(async (tx) => {
      // 1. TỪ CHỐI DUYỆT
      if (action === 'REJECT') {
        await tx.transactionApproval.update({ where: { id: currentApproval.id }, data: { status: 'REJECTED', approverId: user.id } });
        await tx.stockTransaction.update({ where: { id: ticket.id }, data: { status: 'REJECTED' } });
      } 
      // 2. ĐỒNG Ý DUYỆT
      else {
        await tx.transactionApproval.update({ where: { id: currentApproval.id }, data: { status: 'APPROVED', approverId: user.id } });

        const isWarehouseStep = currentApproval.step.roleId.includes('KHO') || currentApproval.step.name.toUpperCase().includes('KHO');

        // Chỉ xử lý trừ/cộng kho ở bước duyệt nếu là EXPORT/IMPORT (TRANSFER đã trừ lúc tạo rồi)
        if (isWarehouseStep && ticket.type !== 'TRANSFER') {
          for (const detail of ticket.details) {
            // --- IMPORT ---
            if (ticket.type === 'IMPORT') {
              const supplierKey = ticket.supplierId;
              if (!supplierKey) throw new Error('Dữ liệu lỗi: Thiếu NCC.');
              if (detail.toLocationId) {
                  await tx.stock.upsert({
                    where: { itemId_locationId_supplierId: { itemId: detail.itemId, locationId: detail.toLocationId!, supplierId: supplierKey } },
                    update: { quantity: { increment: detail.quantity } },
                    create: { itemId: detail.itemId, locationId: detail.toLocationId!, supplierId: supplierKey, quantity: detail.quantity }
                  });
              }
            } 
            // --- EXPORT ---
            else if (ticket.type === 'EXPORT') {
              if (!detail.fromLocationId) throw new Error('Dữ liệu lỗi: Thiếu kho nguồn');
              
              // Logic trừ kho cho Export (giống cũ)
              const stockBatches = await tx.stock.findMany({
                 where: { itemId: detail.itemId, locationId: detail.fromLocationId!, quantity: { gt: 0 } },
                 orderBy: { quantity: 'desc' }
              });
              let remaining = detail.quantity;
              for (const batch of stockBatches) {
                if (remaining <= 0) break;
                const deduct = Math.min(batch.quantity, remaining);
                await tx.stock.update({ where: { id: batch.id }, data: { quantity: { decrement: deduct } } });
                remaining -= deduct;
              }
            }
          }
        }

        const isLastApprover = ticket.approvals[ticket.approvals.length - 1].id === currentApproval.id;
        if (isLastApprover) {
          // Duyệt xong Export -> Chờ người tạo xác nhận
          await tx.stockTransaction.update({ where: { id: ticket.id }, data: { status: 'WAITING_CONFIRM' } });
        }
      }

      await tx.approvalLog.create({
        data: { transactionId: ticket.id, userId: user.id, action: `${action}: ${currentApproval.step.name}`, comment: comment || '' }
      });
    });

    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    const statusCode = error.message.includes('khả dụng') || error.message.includes('Dữ liệu') ? 400 : 500;
    next(new AppError(error.message, statusCode));
  }
};

// ============================================================================
// 5. LẤY DANH SÁCH CẦN DUYỆT CỦA TÔI
// [UPDATE]: Phân quyền chặt chẽ: User nào thấy phiếu nấy
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
            // A. GIAI ĐOẠN CHỜ XÁC NHẬN
            if (ticket.status === 'WAITING_CONFIRM') {
                // TRANSFER: Hiện cho Kho Đích
                if (ticket.type === 'TRANSFER') {
                    const userFactoryId = user.department?.factoryId;
                    const destinationFactoryIds = ticket.details.map(d => d.toLocation?.warehouse?.factoryId);
                    // Check Role Kho + Factory khớp
                    if ((destinationFactoryIds.includes(userFactoryId) && user.role?.name.includes('KHO')) || ['ADMIN', 'ROLE-MANAGER'].includes(user.role?.name)) {
                         return { ...ticket, isRequesterStep: true, currentStepName: 'Xác nhận nhập kho (Điều chuyển)' };
                    }
                }
                // EXPORT: Hiện CHỈ cho người tạo
                else if (ticket.type === 'EXPORT') {
                    if (ticket.creatorId === user.id) {
                        return { ...ticket, isRequesterStep: true, currentStepName: 'Xác nhận hoàn tất' };
                    }
                    // Nếu không phải người tạo -> Không return gì (Ẩn phiếu)
                }
                return null;
            }

            // B. GIAI ĐOẠN DUYỆT (PENDING)
            const currentStep = ticket.approvals.find(a => a.status === 'PENDING');
            if (!currentStep) return null;
            const isMyRole = user.roleId === currentStep.step.roleId || user.roleId.includes('ADMIN');
            if (isMyRole) return { ...ticket, isRequesterStep: false, currentStepName: currentStep.step.name };
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
    const { page = 1, limit = 20, status } = req.query; 
    const skip = (Number(page) - 1) * Number(limit);
    const where: Prisma.StockTransactionWhereInput = {};
    if (status) where.status = status as string;

    const [total, transactions] = await Promise.all([
      prisma.stockTransaction.count({ where }),
      prisma.stockTransaction.findMany({
        where,
        include: {
          creator: { select: { id: true, fullName: true, email: true, department: { select: { name: true } } } },
          supplier: { select: { id: true, name: true } },
          approvals: { where: { status: 'APPROVED' }, include: { approver: { select: { fullName: true } }, step: { select: { name: true } } }, orderBy: { step: { order: 'asc' } } },
          details: { include: { item: true, fromLocation: true, toLocation: true } }
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
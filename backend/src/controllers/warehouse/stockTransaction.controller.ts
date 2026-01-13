import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client'; 
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';

// ============================================================================
// 1. LẤY TỒN KHO THỰC TẾ
// ============================================================================
export const getStockActual = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      page = 1, limit = 20, search, warehouseId, factoryId, isLowStock 
    } = req.query;

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
    if (isLowStock === 'true') {
        finalData = finalData.filter(s => s.isLow);
    }

    res.status(200).json({
      status: 'success',
      data: finalData,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error("Lỗi getStockActual:", error);
    next(new AppError('Lỗi lấy dữ liệu tồn kho', 500));
  }
};

// ============================================================================
// 2. CHECK TỒN KHO NHANH
// ============================================================================
export const checkStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId, locationId } = req.query;
    if (!itemId || !locationId) return res.status(200).json({ status: 'success', quantity: 0 });

    const stocks = await prisma.stock.findMany({
      where: { itemId: itemId as string, locationId: locationId as string }
    });
    
    const totalQty = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
    res.status(200).json({ status: 'success', quantity: totalQty });
  } catch (error) {
    next(new AppError('Lỗi kiểm tra tồn kho', 500));
  }
};

// ============================================================================
// 3. TẠO PHIẾU GIAO DỊCH
// ============================================================================
export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, supplierId, details, description, isEmergency } = req.body;
    const user = req.user as any; 

    let steps = await prisma.approvalStep.findMany({
      where: { type },
      orderBy: { order: 'asc' }
    });

    if (steps.length === 0) return next(new AppError(`Chưa cấu hình quy trình duyệt cho loại ${type}`, 400));

    // Nếu là Leader tạo phiếu Xuất, bỏ qua bước duyệt của chính Leader (nếu có cấu hình)
    if (type === 'EXPORT' && ['ROLE-LEADER', 'ROLE-MANAGER'].includes(user.roleId)) {
      steps = steps.filter(step => step.roleId !== user.roleId);
    }

    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.stockTransaction.create({
        data: {
          code: `${type.substring(0, 3)}-${Date.now()}`,
          type,
          isEmergency: isEmergency || false,
          description,
          creatorId: user.id,
          supplierId: supplierId || null,
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

      if (steps.length > 0) {
        await tx.transactionApproval.createMany({
          data: steps.map(step => ({ transactionId: ticket.id, stepId: step.id, status: 'PENDING' }))
        });
      } else {
        // Trường hợp hiếm: Không có người duyệt nào -> Hoàn tất luôn
        await tx.stockTransaction.update({
            where: { id: ticket.id },
            data: { status: 'APPROVED', completedAt: new Date() }
        });
      }
      return ticket;
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error: any) {
    console.error("Lỗi tạo phiếu:", error);
    next(new AppError(error.message || 'Lỗi tạo phiếu', 500));
  }
};

// ============================================================================
// 4. PHÊ DUYỆT BƯỚC (QUAN TRỌNG: LUÔN CHUYỂN VỀ WAITING_CONFIRM)
// ============================================================================
export const approveStep = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId, comment, action } = req.body;
    const user = req.user as any;
    
    const ticket = await prisma.stockTransaction.findUnique({
      where: { id: transactionId },
      include: {
        creator: true,
        details: { include: { item: true } },
        approvals: { include: { step: true }, orderBy: { step: { order: 'asc' } } }
      }
    });

    if (!ticket) return next(new AppError('Phiếu không tồn tại', 404));

    // --- CASE 1: NGƯỜI TẠO BẤM XÁC NHẬN NHẬN HÀNG (BƯỚC CUỐI CÙNG) ---
    if (ticket.status === 'WAITING_CONFIRM') {
        if (ticket.creatorId !== user.id) {
             return next(new AppError('Chỉ người tạo phiếu mới được xác nhận hoàn tất.', 403));
        }
        if (action === 'APPROVE') {
            await prisma.stockTransaction.update({
                where: { id: ticket.id },
                data: { status: 'APPROVED', completedAt: new Date() }
            });
            return res.status(200).json({ status: 'success', message: 'Đã hoàn tất phiếu.' });
        }
        // Nếu muốn thêm logic từ chối nhận hàng ở đây thì thêm else if action === REJECT
    }

    // --- CASE 2: CÁC CẤP DUYỆT (LEADER, KHO, QUẢN LÝ...) ---
    // Tìm bước đang PENDING có thứ tự nhỏ nhất
    const currentApproval = ticket.approvals.find(a => a.status === 'PENDING');
    if (!currentApproval) return next(new AppError('Phiếu đã hoàn tất hoặc không ở trạng thái chờ duyệt', 400));
    
    // [QUAN TRỌNG] Chặn vượt cấp: Phải đúng Role của bước hiện tại mới được duyệt
    if (currentApproval.step.roleId !== user.roleId && !user.roleId.includes('ADMIN')) {
         return next(new AppError(`Chưa đến lượt bạn. Bước hiện tại cần: ${currentApproval.step.name}`, 403));
    }

    await prisma.$transaction(async (tx) => {
      if (action === 'REJECT') {
        // Nếu từ chối -> Hủy toàn bộ phiếu
        await tx.transactionApproval.update({ where: { id: currentApproval.id }, data: { status: 'REJECTED', approverId: user.id } });
        await tx.stockTransaction.update({ where: { id: ticket.id }, data: { status: 'REJECTED' } });
      } 
      else {
        // 1. Cập nhật bước hiện tại thành APPROVED
        await tx.transactionApproval.update({ where: { id: currentApproval.id }, data: { status: 'APPROVED', approverId: user.id } });

        // 2. Logic Trừ Kho/Cộng Kho (Chỉ chạy khi bước Kho duyệt)
        if (currentApproval.step.roleId.includes('KHO') || currentApproval.step.name.toUpperCase().includes('KHO')) {
          for (const detail of ticket.details) {
            // --- LOGIC KHO ---
            if (ticket.type === 'IMPORT') {
              const supplierKey = ticket.supplierId;
              if (!supplierKey) throw new Error('Dữ liệu lỗi: Phiếu nhập thiếu Nhà cung cấp.');
              await tx.stock.upsert({
                where: { itemId_locationId_supplierId: { itemId: detail.itemId, locationId: detail.toLocationId!, supplierId: supplierKey } },
                update: { quantity: { increment: detail.quantity } },
                create: { itemId: detail.itemId, locationId: detail.toLocationId!, supplierId: supplierKey, quantity: detail.quantity }
              });
            } else {
              // Logic Xuất / Chuyển kho
              const stockBatches = await tx.stock.findMany({
                 where: { itemId: detail.itemId, locationId: detail.fromLocationId!, quantity: { gt: 0 } },
                 orderBy: { quantity: 'desc' }
              });
              const totalAvailable = stockBatches.reduce((sum, s) => sum + s.quantity, 0);
              if (totalAvailable < detail.quantity) throw new Error(`Kho không đủ hàng: ${detail.item.itemCode}.`);
              
              let remainingQtyToDeduct = detail.quantity;
              for (const batch of stockBatches) {
                if (remainingQtyToDeduct <= 0) break;
                const deductAmount = Math.min(batch.quantity, remainingQtyToDeduct);
                await tx.stock.update({ where: { id: batch.id }, data: { quantity: { decrement: deductAmount } } });
                
                // Nếu là chuyển kho -> Cộng vào kho đích
                if (ticket.type === 'TRANSFER' && batch.supplierId) {
                       await tx.stock.upsert({
                        where: { itemId_locationId_supplierId: { itemId: detail.itemId, locationId: detail.toLocationId!, supplierId: batch.supplierId } },
                        update: { quantity: { increment: deductAmount } },
                        create: { itemId: detail.itemId, locationId: detail.toLocationId!, supplierId: batch.supplierId, quantity: deductAmount }
                      });
                }
                remainingQtyToDeduct -= deductAmount;
              }
            }
            // --- HẾT LOGIC KHO ---
          }
        }

        // 3. [CHỐT LOGIC] Kiểm tra xem đã hết người duyệt chưa?
        const isLastApprover = ticket.approvals[ticket.approvals.length - 1].id === currentApproval.id;
        
        if (isLastApprover) {
          // Bất kể ai là người tạo (Leader hay Staff), sau khi Kho duyệt xong
          // Đều chuyển sang WAITING_CONFIRM để người tạo kiểm tra và bấm "Đã nhận hàng"
          await tx.stockTransaction.update({ 
              where: { id: ticket.id }, 
              data: { status: 'WAITING_CONFIRM' } 
          });
        }
      }

      // Ghi log lịch sử thao tác
      await tx.approvalLog.create({
        data: { transactionId: ticket.id, userId: user.id, action: `${action}: ${currentApproval.step.name}`, comment: comment || '' }
      });
    });

    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    const statusCode = error.message.includes('Kho không đủ') || error.message.includes('Dữ liệu lỗi') ? 400 : 500;
    next(new AppError(error.message, statusCode));
  }
};

// ============================================================================
// 5. LẤY DANH SÁCH CẦN DUYỆT CỦA TÔI (QUAN TRỌNG: ĐÃ SỬA FILTER)
// ============================================================================
export const getMyPendingApprovals = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user as any;
        
        // 1. Lấy tất cả phiếu chưa hoàn tất (PENDING hoặc WAITING_CONFIRM)
        const tickets = await prisma.stockTransaction.findMany({
            where: { status: { in: ['PENDING', 'WAITING_CONFIRM'] } },
            include: {
                creator: { 
                    select: { 
                        id: true, fullName: true, 
                        department: { select: { id: true, name: true } } 
                    } 
                },
                details: { include: { item: true } },
                approvals: { include: { step: true }, orderBy: { step: { order: 'asc' } } } // Sort step tăng dần
            },
            orderBy: { createdAt: 'desc' }
        });
        
        // 2. [FIX] Filter thủ công để đảm bảo tính tuần tự nghiêm ngặt
        const myTasks = tickets.map((ticket) => {
            // A. Nếu phiếu đang ở trạng thái CHỜ XÁC NHẬN (bước cuối)
            if (ticket.status === 'WAITING_CONFIRM') {
                if (ticket.creatorId === user.id) {
                    return { ...ticket, isRequesterStep: true, currentStepName: 'Xác nhận nhận hàng' };
                }
                return null;
            }

            // B. Nếu phiếu đang duyệt: Tìm bước PENDING đầu tiên
            // (Do đã sort order asc ở query nên find() sẽ lấy bước có order nhỏ nhất)
            const currentStep = ticket.approvals.find(a => a.status === 'PENDING');
            if (!currentStep) return null; // Lỗi data hoặc đã xong hết

            // C. So sánh Role của User với Role của Bước hiện tại
            // [QUAN TRỌNG] Chỉ trả về nếu đúng Role. 
            // Ví dụ: Nếu phiếu đang chờ Leader (bước 1), thì Thủ kho (bước 2) sẽ KHÔNG thấy phiếu này.
            const isMyRole = user.roleId === currentStep.step.roleId || user.roleId.includes('ADMIN');

            if (isMyRole) {
                return { 
                    ...ticket, 
                    isRequesterStep: false, 
                    currentStepName: currentStep.step.name 
                };
            }
            return null;
        }).filter(item => item !== null); // Loại bỏ các phiếu null
        
        res.status(200).json({ status: 'success', data: myTasks }); 
    } catch (e) {
        next(new AppError('Lỗi lấy danh sách duyệt', 500));
    }
};

// ============================================================================
// 6. LẤY LỊCH SỬ GIAO DỊCH (Giữ nguyên)
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
          creator: { 
             select: { 
                 id: true, fullName: true, email: true,
                 department: { select: { name: true } }
             } 
          },
          supplier: { select: { id: true, name: true } },
          approvals: {
            where: { status: 'APPROVED' }, 
            include: {
                approver: { select: { fullName: true } }, 
                step: { select: { name: true } }          
            },
            orderBy: { step: { order: 'asc' } }
          },
          details: { include: { item: true, fromLocation: true, toLocation: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: skip
      })
    ]);

    res.status(200).json({
      status: 'success',
      data: transactions,
      pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
    });

  } catch (error) {
    next(new AppError('Lỗi tải lịch sử giao dịch', 500));
  }
};
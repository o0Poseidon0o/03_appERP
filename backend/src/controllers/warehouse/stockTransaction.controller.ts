import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client"; 
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";

// ============================================================================
// 1. LẤY TỒN KHO THỰC TẾ (GIỮ NGUYÊN)
// ============================================================================
export const getStockActual = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, search, warehouseId, itemId, ignoreFactoryScope, isLowStock } = req.query;
    const user = req.user as any;

    const whereCondition: any = { quantity: { gt: 0 } };

    // 1. Phân quyền dữ liệu (Scope)
    if (ignoreFactoryScope !== "true" && user.roleId !== "ROLE-ADMIN") {
      if (!user.factoryId) return res.status(200).json({ data: [], total: 0 });
      whereCondition.location = { warehouse: { factoryId: user.factoryId } };
    }

    // 2. Filter Search
    if (itemId) whereCondition.itemId = itemId as string;
    else if (search) {
      whereCondition.item = {
        OR: [
          { itemCode: { contains: search as string, mode: "insensitive" } },
          { itemName: { contains: search as string, mode: "insensitive" } },
        ],
      };
    }

    if (warehouseId) {
        whereCondition.location = { 
            ...(whereCondition.location || {}), 
            warehouseId: warehouseId as string 
        };
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [total, stocks] = await Promise.all([
      prisma.stock.count({ where: whereCondition }),
      prisma.stock.findMany({
        where: whereCondition,
        include: { 
            item: { include: { category: true } }, 
            location: { 
                include: { 
                    warehouse: { include: { factory: true } } 
                } 
            }, 
            supplier: true 
        },
        orderBy: [{ item: { itemCode: "asc" } }, { location: { locationCode: "asc" } }],
        take: Number(limit),
        skip: skip,
      }),
    ]);

    // 3. Format Data
    const formattedStocks = stocks.map((stock) => ({
      id: stock.id,
      itemId: stock.itemId,
      itemCode: stock.item.itemCode,
      itemName: stock.item.itemName,
      unit: stock.item.baseUnit,
      category: stock.item.category?.name || "N/A",
      
      locationId: stock.locationId,
      locationCode: stock.location.locationCode,
      warehouseName: stock.location.warehouse.name,
      
      factoryId: stock.location.warehouse.factoryId,
      factoryName: stock.location.warehouse.factory.name,
      
      quantity: stock.quantity,
      minStock: stock.item.minStock,
      supplierName: stock.supplier?.name || "N/A",
      isLow: stock.quantity <= stock.item.minStock,
    }));

    let finalData = formattedStocks;
    if (isLowStock === "true") finalData = finalData.filter((s) => s.isLow);

    res.status(200).json({ 
        status: "success", 
        data: finalData, 
        pagination: { 
            total, 
            page: Number(page), 
            limit: Number(limit), 
            totalPages: Math.ceil(total / Number(limit)) 
        } 
    });
  } catch (error) {
    next(new AppError("Lỗi lấy dữ liệu tồn kho", 500));
  }
};

// ============================================================================
// 2. CHECK TỒN KHO KHẢ DỤNG (GIỮ NGUYÊN)
// ============================================================================
export const checkStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId, locationId } = req.query;
    if (!itemId || !locationId) return res.status(200).json({ status: "success", quantity: 0 });

    const stocks = await prisma.stock.findMany({ where: { itemId: itemId as string, locationId: locationId as string } });
    const physicalQty = stocks.reduce((sum, stock) => sum + stock.quantity, 0);

    const pendingAggregation = await prisma.transactionDetail.aggregate({
      _sum: { quantity: true },
      where: {
        itemId: String(itemId),
        fromLocationId: String(locationId),
        transaction: {
          type: "EXPORT",
          ticket: {
             status: { in: ["PENDING"] } 
          }
        },
      },
    });

    const pendingQty = pendingAggregation._sum.quantity || 0;
    const availableQty = physicalQty - pendingQty;

    res.status(200).json({ 
        status: "success", 
        quantity: availableQty > 0 ? availableQty : 0, 
        physical: physicalQty, 
        pending: pendingQty 
    });
  } catch (error) {
    next(new AppError("Lỗi kiểm tra tồn kho", 500));
  }
};

// ============================================================================
// 3. LẤY LỊCH SỬ GIAO DỊCH (ĐÃ SỬA: LẤY ĐỦ ID, BỘ PHẬN, NGƯỜI DUYỆT)
// ============================================================================
export const getTransactionHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const user = req.user as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    
    if (type) where.type = type as string;

    if (status) {
        where.ticket = {
            status: { in: (status as string).split(',') }
        };
    }

    if (user.roleId !== "ROLE-ADMIN") {
        if (["ROLE-LEADER", "ROLE-MANAGER"].includes(user.roleId)) {
             where.ticket = {
                 ...where.ticket,
                 creator: { departmentId: user.departmentId }
             };
        } else {
             if (user.factoryId) where.factoryId = user.factoryId;
        }
    }

    const [total, transactions] = await Promise.all([
      prisma.stockTransaction.count({ where }),
      prisma.stockTransaction.findMany({
        where,
        include: {
          ticket: {
             select: {
                 code: true,
                 status: true,
                 createdAt: true,
                 creator: { 
                     select: { 
                         id: true, // [OK] Lấy ID người tạo
                         fullName: true, 
                         department: { 
                             select: { 
                                 name: true,
                                 id: true // [OK] Lấy ID bộ phận
                             } 
                         } 
                     } 
                 },
                 // [QUAN TRỌNG] Lấy thông tin các bước duyệt (bao gồm Actor)
                 steps: {
                     include: {
                         step: true,
                         actor: { 
                             select: {
                                 id: true, // [OK] Lấy ID người duyệt
                                 fullName: true
                             }
                         }
                     },
                     orderBy: { step: { order: 'asc' } }
                 },
                 logs: { orderBy: { createdAt: 'desc' }, take: 1 }
             }
          },
          supplier: { select: { name: true } },
          details: { include: { item: true, fromLocation: true, toLocation: true, usageCategory: true } },
          factory: { select: { name: true } }
        },
        orderBy: { ticket: { createdAt: "desc" } }, 
        take: Number(limit),
        skip: skip,
      }),
    ]);

    const mappedTransactions = transactions.map((t: any) => ({
      id: t.id,
      
      code: t.ticket?.code, 
      status: t.ticket?.status, 
      
      // Map đủ thông tin Creator & Dept
      creator: t.ticket?.creator, 
      creatorName: t.ticket?.creator?.fullName,
      creatorId: t.ticket?.creator?.id, // ID người tạo
      departmentName: t.ticket?.creator?.department?.name,
      departmentId: t.ticket?.creator?.department?.id, // ID bộ phận

      createdAt: t.ticket?.createdAt,
      type: t.type,
      isEmergency: t.isEmergency,
      description: t.description,
      
      factoryName: t.factory?.name, 
      supplierName: t.supplier?.name || 'N/A', 
      
      details: t.details,
      
      // Map steps để Frontend hiển thị người duyệt
      steps: t.ticket?.steps || [] 
    }));

    res.status(200).json({ 
        status: "success", 
        data: mappedTransactions, 
        pagination: { 
            total, 
            page: Number(page), 
            limit: Number(limit), 
            totalPages: Math.ceil(total / Number(limit)) 
        } 
    });
  } catch (error) { 
    next(new AppError("Lỗi tải lịch sử giao dịch", 500)); 
  }
};
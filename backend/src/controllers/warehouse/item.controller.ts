import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma'; // Đảm bảo đường dẫn đúng
import { AppError } from '../../utils/AppError';

// ==================================================================
// 1. QUẢN LÝ DANH MỤC VẬT TƯ (ITEM CATEGORY)
// ==================================================================

// Lấy tất cả danh mục
export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.itemCategory.findMany({
      orderBy: { code: 'asc' }, 
      include: { _count: { select: { items: true } } } 
    });
    res.status(200).json({ status: 'success', data: categories });
  } catch (error) {
    next(new AppError('Lỗi khi lấy danh sách danh mục', 500));
  }
};

// Tạo mới danh mục
export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name } = req.body;

    if (!code || !name) {
        return next(new AppError('Mã nhóm và Tên nhóm không được để trống', 400));
    }

    // Kiểm tra trùng mã
    const existingCode = await prisma.itemCategory.findUnique({ where: { code: code.toString() } });
    if (existingCode) {
        return next(new AppError(`Mã nhóm '${code}' đã tồn tại!`, 400));
    }

    const category = await prisma.itemCategory.create({ 
        data: { 
            code: code.toUpperCase().trim(),
            name: name.trim()
        } 
    });
    res.status(201).json({ status: 'success', data: category });
  } catch (error) {
    next(new AppError('Tên danh mục hoặc Mã danh mục đã tồn tại', 400));
  }
};

// Cập nhật danh mục
export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { code, name } = req.body;
    
    const updated = await prisma.itemCategory.update({
      where: { id },
      data: { 
          code: code ? code.toUpperCase().trim() : undefined,
          name: name ? name.trim() : undefined
      }
    });
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(new AppError('Không tìm thấy danh mục hoặc Mã/Tên đã bị trùng', 404));
  }
};

// Xóa danh mục
export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const itemUnderCategory = await prisma.item.count({ where: { categoryId: id } });
    if (itemUnderCategory > 0) {
      return next(new AppError('Không thể xóa danh mục đang có vật tư tồn tại', 400));
    }

    await prisma.itemCategory.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(new AppError('Lỗi khi xóa danh mục', 500));
  }
};

// ==================================================================
// 2. QUẢN LÝ VẬT TƯ (ITEM) - [ĐÃ UPDATE CHO SCHEMA MỚI]
// ==================================================================

export const createItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // [CHANGE] Lấy baseUnit thay vì unit. Nhận thêm mảng conversions
    const { itemCode, itemName, baseUnit, categoryId, minStock, conversions } = req.body;

    if (!itemCode || !itemName || !baseUnit || !categoryId) {
        return next(new AppError('Thiếu thông tin bắt buộc (Mã, Tên, ĐVT cơ sở, Nhóm)', 400));
    }

    const uniqueSuffix = Date.now().toString(36).toUpperCase();
    const qrCode = `ITM-${itemCode}-${uniqueSuffix}`;

    // Xử lý dữ liệu quy đổi đơn vị (nếu có)
    // Client gửi lên dạng: [{ unitName: "Thùng", factor: 24, barcode: "..." }]
    const conversionData = Array.isArray(conversions) ? conversions.map((c: any) => ({
        unitName: c.unitName,
        factor: parseFloat(c.factor),
        barcode: c.barcode || null
    })) : [];

    const item = await prisma.item.create({
      data: { 
        itemCode, 
        itemName, 
        baseUnit, // [IMPORTANT] Dùng baseUnit
        categoryId, 
        qrCode,
        minStock: minStock ? parseFloat(minStock) : 0,
        
        // Tạo luôn đơn vị quy đổi (Nested Write)
        conversions: {
            create: conversionData 
        }
      },
      include: {
          conversions: true // Trả về luôn để hiển thị
      }
    });

    res.status(201).json({ status: 'success', data: item });
  } catch (error) {
    console.error("Create Item Error:", error);
    next(new AppError('Mã vật tư, mã QR hoặc đơn vị quy đổi đã bị trùng', 400));
  }
};

export const searchItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    
    const items = await prisma.item.findMany({
      where: q ? {
        OR: [
          { itemCode: { contains: String(q), mode: 'insensitive' } },
          { itemName: { contains: String(q), mode: 'insensitive' } },
          { qrCode: { equals: String(q) } },
          // [NEW] Tìm kiếm cả trong mã vạch của đơn vị quy đổi (VD: Quét mã thùng)
          { 
            conversions: { 
                some: { barcode: { equals: String(q) } } 
            } 
          }
        ]
      } : {}, 
      include: { 
        category: true, 
        // [IMPORTANT] Lấy kèm bảng quy đổi để Frontend tính toán
        conversions: true, 
        stocks: { 
          include: { location: true, supplier: true } 
        } 
      }
    });

    res.status(200).json({ status: 'success', data: items });
  } catch (error) {
    next(new AppError('Lỗi khi tìm kiếm vật tư', 500));
  }
};

export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // [CHANGE] baseUnit
    const { itemName, baseUnit, categoryId, minStock } = req.body;

    const updatedItem = await prisma.item.update({
      where: { id },
      data: { 
        itemName, 
        baseUnit, 
        categoryId,
        minStock: minStock ? parseFloat(minStock) : undefined
      }
    });

    res.status(200).json({ status: 'success', data: updatedItem });
  } catch (error) {
    next(new AppError('Không tìm thấy vật tư để cập nhật', 404));
  }
};

// [NEW API] Thêm đơn vị quy đổi lẻ (VD: Đã có Thùng, giờ thêm Hộp)
export const addConversionUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { itemId } = req.params;
        const { unitName, factor, barcode } = req.body;

        if(!unitName || !factor) {
            return next(new AppError('Tên đơn vị và hệ số quy đổi là bắt buộc', 400));
        }

        const newUnit = await prisma.itemUnitConversion.create({
            data: {
                itemId,
                unitName,
                factor: parseFloat(factor),
                barcode
            }
        });

        res.status(201).json({ status: 'success', data: newUnit });
    } catch (error) {
        next(new AppError('Đơn vị quy đổi này đã tồn tại cho vật tư này', 400));
    }
};

// [NEW API] Xóa đơn vị quy đổi
export const deleteConversionUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { conversionId } = req.params;
        await prisma.itemUnitConversion.delete({ where: { id: conversionId }});
        res.status(204).send();
    } catch (error) {
        next(new AppError('Lỗi khi xóa đơn vị quy đổi', 500));
    }
};

export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Ràng buộc 1: Không xóa nếu còn tồn kho
    const stockCount = await prisma.stock.findMany({
      where: { itemId: id, quantity: { gt: 0 } }
    });
    if (stockCount.length > 0) return next(new AppError('Vật tư còn hàng tồn, không thể xóa!', 400));

    // Ràng buộc 2: Không xóa nếu đã có giao dịch
    const transactionCount = await prisma.transactionDetail.count({
      where: { itemId: id }
    });
    if (transactionCount > 0) return next(new AppError('Vật tư đã có lịch sử giao dịch, không thể xóa!', 400));

    // Prisma tự động xóa conversions nhờ cascade
    await prisma.item.delete({ where: { id } });
    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    next(new AppError('Lỗi hệ thống khi xóa vật tư', 500));
  }
};

// ==================================================================
// 3. QUẢN LÝ LOẠI HÀNG SỬ DỤNG (USAGE CATEGORY)
// ==================================================================

// Lấy danh sách (Dropdown)
export const getAllUsageCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.usageCategory.findMany({
      orderBy: { code: 'asc' }
    });
    res.status(200).json({ status: 'success', data: categories });
  } catch (error) {
    next(new AppError('Lỗi lấy danh sách loại hàng sử dụng', 500));
  }
};

// Tạo mới
export const createUsageCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) return next(new AppError('Mã và Tên loại hàng không được để trống', 400));

    const newCategory = await prisma.usageCategory.create({
      data: { code, name, description }
    });
    res.status(201).json({ status: 'success', data: newCategory });
  } catch (error) {
    next(new AppError('Mã loại hàng đã tồn tại', 400));
  }
};

// Cập nhật
export const updateUsageCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const updated = await prisma.usageCategory.update({
      where: { id },
      data: { name, description }
    });
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(new AppError('Không tìm thấy loại hàng', 404));
  }
};

// Xóa
export const deleteUsageCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const countUsed = await prisma.transactionDetail.count({
      where: { usageCategoryId: id }
    });

    if (countUsed > 0) {
      return next(new AppError('Loại hàng này đã được sử dụng trong giao dịch, không thể xóa!', 400));
    }

    await prisma.usageCategory.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(new AppError('Lỗi khi xóa loại hàng', 500));
  }
};

// Import Excel/CSV
export const importUsageCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { data } = req.body;
     
     if (!Array.isArray(data) || data.length === 0) {
        return next(new AppError('Dữ liệu import rỗng hoặc không hợp lệ', 400));
     }

     const validItems = [];
     for (const item of data) {
        const rawCode = item.product_category_code || item.code;
        const rawName = item.product_name || item.name;

        if (rawCode && rawName) {
           validItems.push({
              code: String(rawCode).trim(), 
              name: String(rawName).trim()
           });
        }
     }

     if (validItems.length === 0) {
         return next(new AppError('Lỗi: Không tìm thấy cột mã và tên hợp lệ trong file!', 400));
     }

     const result = await prisma.$transaction(
        validItems.map((item) => 
           prisma.usageCategory.upsert({
              where: { code: item.code },
              update: { name: item.name },
              create: { 
                 code: item.code, 
                 name: item.name 
              }
           })
        )
     );
     
     res.status(200).json({ 
        status: 'success', 
        message: `Đã xử lý thành công ${result.length} dòng dữ liệu.` 
     });

  } catch (error) {
     console.error("Import Error:", error);
     next(new AppError('Lỗi hệ thống khi import dữ liệu.', 500));
  }
};
// [MỚI] API IMPORT VẬT TƯ TỪ EXCEL (Bulk Import)
export const importItemsBulk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body; // Mảng items từ Frontend gửi lên

    if (!Array.isArray(items) || items.length === 0) {
      return next(new AppError('Dữ liệu import trống!', 400));
    }

    // 1. Lấy danh sách Category hiện có để map ID
    const categories = await prisma.itemCategory.findMany();
    const categoryMap = new Map<string, string>(); // Map<Code, ID> (VD: "2" -> "uuid-xyz")
    categories.forEach(c => categoryMap.set(c.code, c.id));

    const validItems = [];
    const errors = [];

    // 2. Xử lý từng dòng
    for (const item of items) {
      // itemCode, itemName, baseUnit, _debugCategoryCode (được parse từ Frontend)
      const { itemCode, itemName, baseUnit } = item;
      
      // Tách mã nhóm từ itemCode (Lấy ký tự đầu tiên hoặc phần trước dấu gạch ngang đầu tiên)
      // Ví dụ: "2-02-001" -> prefix = "2"
      const prefix = itemCode.split('-')[0]; 
      const categoryId = categoryMap.get(prefix);

      if (!categoryId) {
        errors.push(`Mã ${itemCode}: Không tìm thấy nhóm vật tư tương ứng với mã "${prefix}"`);
        continue;
      }

      validItems.push({
        itemCode: String(itemCode).trim(),
        itemName: String(itemName).trim(),
        baseUnit: String(baseUnit).trim(),
        categoryId: categoryId,
        minStock: 5, // Giá trị mặc định
        qrCode: `ITM-${itemCode}-${Date.now()}` // Tạo mã QR tạm
      });
    }

    if (validItems.length === 0) {
      return next(new AppError(`Không có dòng nào hợp lệ. Lỗi: ${errors.join(', ')}`, 400));
    }

    // 3. Thực hiện Insert vào DB (Sử dụng transaction để an toàn)
    // Dùng upsert để nếu trùng mã thì update, chưa có thì insert
    let successCount = 0;
    
    await prisma.$transaction(
      validItems.map(item => 
        prisma.item.upsert({
          where: { itemCode: item.itemCode },
          update: { 
             itemName: item.itemName, 
             baseUnit: item.baseUnit,
             categoryId: item.categoryId
          },
          create: {
             itemCode: item.itemCode,
             itemName: item.itemName,
             baseUnit: item.baseUnit,
             categoryId: item.categoryId,
             minStock: item.minStock,
             qrCode: item.qrCode
          }
        })
      )
    );
    
    successCount = validItems.length;

    res.status(200).json({ 
      status: 'success', 
      message: `Đã xử lý ${successCount} vật tư.`,
      warnings: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Bulk Import Error:", error);
    next(new AppError('Lỗi khi import dữ liệu (có thể do trùng mã QR hoặc lỗi hệ thống)', 500));
  }
};
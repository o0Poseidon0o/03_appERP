import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';

// =============================================================================
// 1. LẤY DANH SÁCH KHO (UPDATE: BỎ LỌC, HIỂN THỊ TẤT CẢ)
// =============================================================================
export const getAllWarehouses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Logic mới: Không lọc, lấy tất cả
    const warehouses = await prisma.warehouse.findMany({
      where: {}, 
      orderBy: { 
          name: 'asc' 
      },
      include: { 
        factory: {
            select: { id: true, name: true }
        }, 
        locations: {
            orderBy: { locationCode: 'asc' }
        }, 
        _count: { select: { locations: true } } 
      }
    });

    res.status(200).json({ status: 'success', data: warehouses });
  } catch (error) {
    console.error("Lỗi getAllWarehouses:", error);
    next(new AppError('Lỗi lấy danh sách kho', 500));
  }
};

// =============================================================================
// 2. TẠO KHO MỚI (UPDATE: THÊM TYPE VÀ DESCRIPTION)
// =============================================================================
export const createWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // --- [UPDATE]: Thêm type và description vào body ---
    const { name, warehouseCode, factoryId, type, description } = req.body;

    if (!name || !warehouseCode || !factoryId) {
        return next(new AppError('Vui lòng nhập đủ: Tên, Mã kho và Nhà máy', 400));
    }

    const exists = await prisma.warehouse.findUnique({ where: { warehouseCode } });
    if (exists) {
        return next(new AppError(`Mã kho '${warehouseCode}' đã tồn tại`, 400));
    }

    const newWarehouse = await prisma.warehouse.create({
      data: { 
        name, 
        warehouseCode, 
        factoryId,
        type: type || 'PHYSICAL', // Mặc định là PHYSICAL nếu không gửi
        description 
      },
    });
    
    res.status(201).json({ status: 'success', data: newWarehouse });
  } catch (error) {
    console.error("Lỗi createWarehouse:", error);
    next(new AppError('Lỗi tạo kho mới', 500));
  }
};

// =============================================================================
// 3. THÊM VỊ TRÍ (BIN) VÀO KHO (UPDATE: THÊM RACK, LEVEL, BIN)
// =============================================================================
export const addLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // --- [UPDATE]: Thêm rack, level, bin ---
    const { warehouseId, locationCode, rack, level, bin } = req.body;
    
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) return next(new AppError('Kho không tồn tại', 404));

    const qrCode = `${warehouse.warehouseCode}-${locationCode}`.toUpperCase();

    const location = await prisma.location.create({
      data: { 
          warehouseId, 
          locationCode: locationCode.toUpperCase(), 
          qrCode,
          rack,   // Lưu Kệ
          level,  // Lưu Tầng
          bin     // Lưu Ngăn (nếu có)
      }
    });

    res.status(201).json({ status: 'success', data: location });
  } catch (error: any) {
    if (error.code === 'P2002') {
        return next(new AppError(`Vị trí '${req.body.locationCode}' đã tồn tại trong kho này`, 400));
    }
    next(new AppError('Lỗi tạo vị trí kệ', 500));
  }
};

// =============================================================================
// 4. CẬP NHẬT THÔNG TIN KHO (UPDATE: CHO PHÉP SỬA TYPE VÀ DESC)
// =============================================================================
export const updateWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // --- [UPDATE]: Nhận thêm type và description ---
    const { name, factoryId, type, description } = req.body;
    
    const updated = await prisma.warehouse.update({
      where: { id },
      data: { 
        name, 
        factoryId,
        type,
        description
      }
    });
    
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(new AppError('Không tìm thấy kho hoặc lỗi cập nhật', 404));
  }
};

// =============================================================================
// 5. XÓA KHO (GIỮ NGUYÊN)
// =============================================================================
export const deleteWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const locationCount = await prisma.location.count({ where: { warehouseId: id } });
    if (locationCount > 0) {
        return next(new AppError(`Kho này đang chứa ${locationCount} vị trí kệ, không thể xóa!`, 400));
    }

    await prisma.warehouse.delete({ where: { id } });
    
    res.status(200).json({ status: 'success', message: 'Đã xóa kho thành công' });
  } catch (error) {
    next(new AppError('Lỗi khi xóa kho', 500));
  }
};

// =============================================================================
// 6. LẤY TẤT CẢ VỊ TRÍ (UPDATE: TRẢ VỀ THÊM RACK, LEVEL...)
// =============================================================================
export const getAllLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locations = await prisma.location.findMany({
      include: {
        warehouse: {
          select: { warehouseCode: true, name: true }
        }
      },
      orderBy: { locationCode: 'asc' }
    });

    const formattedData = locations.map(loc => ({
      id: loc.id,
      locationCode: loc.locationCode,
      qrCode: loc.qrCode,
      displayName: `${loc.warehouse.warehouseCode} - ${loc.locationCode}`,
      // --- [UPDATE]: Trả về thông tin chi tiết ---
      rack: loc.rack,
      level: loc.level,
      bin: loc.bin,
      warehouseName: loc.warehouse.name
    }));

    res.status(200).json({ status: 'success', data: formattedData });
  } catch (error) {
    next(new AppError('Lỗi lấy danh sách vị trí', 500));
  }
};

// =============================================================================
// 7. XÓA VỊ TRÍ KHO (GIỮ NGUYÊN)
// =============================================================================
export const deleteLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const stockCount = await prisma.stock.count({ where: { locationId: id, quantity: { gt: 0 } } });
    
    if (stockCount > 0) {
        return next(new AppError(`Vị trí này đang chứa hàng, không thể xóa!`, 400));
    }

    await prisma.location.delete({ where: { id } });
    
    res.status(200).json({ status: 'success', message: 'Đã xóa vị trí thành công' });
  } catch (error) {
    next(new AppError('Lỗi khi xóa vị trí', 500));
  }
};

// =============================================================================
// 8. CẬP NHẬT VỊ TRÍ (UPDATE: SỬA CẢ RACK, LEVEL, BIN)
// =============================================================================
export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // --- [UPDATE]: Nhận thêm rack, level, bin ---
    const { locationCode, rack, level, bin } = req.body;

    const currentLocation = await prisma.location.findUnique({
        where: { id },
        include: { warehouse: true }
    });

    if (!currentLocation) {
        return next(new AppError('Không tìm thấy vị trí này', 404));
    }

    const newQrCode = `${currentLocation.warehouse.warehouseCode}-${locationCode}`.toUpperCase();

    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        locationCode: locationCode.toUpperCase(),
        qrCode: newQrCode,
        rack,   // Cập nhật Kệ
        level,  // Cập nhật Tầng
        bin     // Cập nhật Ngăn
      }
    });

    res.status(200).json({ status: 'success', data: updatedLocation });

  } catch (error: any) {
    if (error.code === 'P2002') {
        return next(new AppError('Mã vị trí này đã tồn tại trong kho', 400));
    }
    next(new AppError('Lỗi cập nhật vị trí', 500));
  }
};
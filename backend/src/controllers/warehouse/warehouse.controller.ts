import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AppError } from '../../utils/AppError';

// =============================================================================
// 1. LẤY DANH SÁCH KHO
// =============================================================================
export const getAllWarehouses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // [NÂNG CẤP]: Hỗ trợ lọc theo factoryId nếu Frontend gửi lên (VD: ?factoryId=xyz)
    const { factoryId } = req.query;
    const whereCondition = factoryId ? { factoryId: String(factoryId) } : {};

    const warehouses = await prisma.warehouse.findMany({
      where: whereCondition, 
      orderBy: [
          { factory: { name: 'asc' } }, // Gom nhóm theo Nhà máy trước
          { name: 'asc' }               // Sau đó mới xếp tên kho a-z
      ],
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
// 2. TẠO KHO MỚI
// =============================================================================
export const createWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, warehouseCode, factoryId, type, description } = req.body;

    if (!name || !warehouseCode || !factoryId) {
        return next(new AppError('Vui lòng nhập đủ: Tên, Mã kho và Nhà máy', 400));
    }

    // Kiểm tra trùng mã kho trên toàn hệ thống
    const exists = await prisma.warehouse.findUnique({ where: { warehouseCode } });
    if (exists) {
        return next(new AppError(`Mã kho '${warehouseCode}' đã tồn tại`, 400));
    }

    const newWarehouse = await prisma.warehouse.create({
      data: { 
        name, 
        warehouseCode: warehouseCode.toUpperCase().trim(), 
        factoryId,
        type: type || 'PHYSICAL', 
        description 
      },
    });
    
    res.status(201).json({ status: 'success', data: newWarehouse });
  } catch (error) {
    next(new AppError('Lỗi tạo kho mới', 500));
  }
};

// =============================================================================
// 3. THÊM VỊ TRÍ (BIN/RACK) VÀO KHO
// =============================================================================
export const addLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { warehouseId, locationCode, rack, level, bin } = req.body;
    
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) return next(new AppError('Kho không tồn tại', 404));

    // Tạo QR Code chuẩn: KHO-VITRI (VD: KHO1-A01)
    const normalizedCode = locationCode.toUpperCase().trim();
    const qrCode = `${warehouse.warehouseCode}-${normalizedCode}`;

    const location = await prisma.location.create({
      data: { 
          warehouseId, 
          locationCode: normalizedCode, 
          qrCode,
          rack: rack || null,   // Kệ
          level: level || null, // Tầng
          bin: bin || null      // Ngăn
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
// 4. CẬP NHẬT THÔNG TIN KHO
// =============================================================================
export const updateWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
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
// 5. XÓA KHO
// =============================================================================
export const deleteWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Ràng buộc: Phải xóa hết vị trí con mới được xóa kho cha
    const locationCount = await prisma.location.count({ where: { warehouseId: id } });
    if (locationCount > 0) {
        return next(new AppError(`Kho này đang chứa ${locationCount} vị trí kệ, vui lòng xóa vị trí trước!`, 400));
    }

    await prisma.warehouse.delete({ where: { id } });
    
    res.status(200).json({ status: 'success', message: 'Đã xóa kho thành công' });
  } catch (error) {
    next(new AppError('Lỗi khi xóa kho', 500));
  }
};

// =============================================================================
// 6. LẤY TẤT CẢ VỊ TRÍ
// =============================================================================
export const getAllLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locations = await prisma.location.findMany({
      include: {
        warehouse: {
          select: { warehouseCode: true, name: true }
        }
      },
      orderBy: [
          { warehouse: { warehouseCode: 'asc' } }, // Xếp theo kho trước
          { locationCode: 'asc' }                  // Xếp theo mã vị trí sau
      ]
    });

    const formattedData = locations.map(loc => ({
      id: loc.id,
      locationCode: loc.locationCode,
      qrCode: loc.qrCode,
      displayName: `${loc.warehouse.warehouseCode} - ${loc.locationCode}`,
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
// 7. XÓA VỊ TRÍ KHO
// =============================================================================
export const deleteLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Ràng buộc: Không xóa vị trí đang có hàng tồn
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
// 8. CẬP NHẬT VỊ TRÍ
// =============================================================================
export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { locationCode, rack, level, bin } = req.body;

    const currentLocation = await prisma.location.findUnique({
        where: { id },
        include: { warehouse: true }
    });

    if (!currentLocation) {
        return next(new AppError('Không tìm thấy vị trí này', 404));
    }

    const normalizedCode = locationCode.toUpperCase().trim();
    // Cập nhật lại QR Code nếu tên vị trí thay đổi
    const newQrCode = `${currentLocation.warehouse.warehouseCode}-${normalizedCode}`;

    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        locationCode: normalizedCode,
        qrCode: newQrCode,
        rack,
        level,
        bin
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
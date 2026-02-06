import { Request, Response } from "express";
import prisma from "../../config/prisma";

// ==========================================
// 1. LẤY LỊCH SỬ SỬA CHỮA CỦA 1 THIẾT BỊ
// ==========================================
export const getAssetMaintenanceHistory = async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;

    const history = await prisma.maintenanceLog.findMany({
      where: { assetId },
      orderBy: { startDate: 'desc' } // Mới nhất lên đầu
    });

    res.status(200).json({ status: "success", data: history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Lỗi lấy lịch sử sửa chữa" });
  }
};

// ==========================================
// 2. TẠO PHIẾU SỬA CHỮA MỚI (BẮT ĐẦU SỬA)
// ==========================================
export const createMaintenanceLog = async (req: Request, res: Response) => {
  try {
    const { 
        assetId, 
        type,           // 'REPAIR' (Sửa), 'MAINTENANCE' (Bảo trì), 'UPGRADE' (Nâng cấp)
        description, 
        providerType,   // 'INTERNAL' (Nội bộ), 'EXTERNAL' (Thuê ngoài)
        providerName,   // Tên nhân viên hoặc Tên công ty sửa
        cost, 
        startDate 
    } = req.body;

    // Sử dụng Transaction để đảm bảo tính nhất quán:
    // 1. Tạo log sửa chữa
    // 2. Update trạng thái máy sang REPAIR (Đang sửa)
    const result = await prisma.$transaction(async (tx) => {
        // A. Tạo Log
        const newLog = await tx.maintenanceLog.create({
            data: {
                assetId,
                type: type || 'REPAIR',
                description,
                providerType,
                providerName,
                cost: Number(cost) || 0,
                startDate: startDate ? new Date(startDate) : new Date(),
                status: 'IN_PROGRESS' // Đang thực hiện
            }
        });

        // B. Cập nhật trạng thái máy
        await tx.asset.update({
            where: { id: assetId },
            data: { status: 'REPAIR' } 
        });

        return newLog;
    });

    res.status(201).json({ status: "success", message: "Đã tạo phiếu sửa chữa", data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Lỗi tạo phiếu sửa chữa" });
  }
};

// ==========================================
// 3. HOÀN TẤT SỬA CHỮA (CHỐT SỔ)
// ==========================================
export const completeMaintenanceLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // ID của phiếu sửa chữa
    const { cost, note } = req.body; // Chi phí chốt thực tế, ghi chú thêm

    // Lấy thông tin log cũ để biết assetId
    const existingLog = await prisma.maintenanceLog.findUnique({ where: { id } });
    if (!existingLog) return res.status(404).json({ message: "Phiếu không tồn tại" });

    // Transaction:
    // 1. Update phiếu thành DONE
    // 2. Trả trạng thái máy về IN_USE (Sẵn sàng)
    await prisma.$transaction(async (tx) => {
        // A. Chốt phiếu
        await tx.maintenanceLog.update({
            where: { id },
            data: {
                status: 'DONE',
                endDate: new Date(), // Thời điểm xong là ngay lúc bấm nút
                cost: cost !== undefined ? Number(cost) : existingLog.cost, // Cập nhật giá nếu có thay đổi
                description: note ? `${existingLog.description} | Ghi chú thêm: ${note}` : existingLog.description
            }
        });

        // B. Update máy
        await tx.asset.update({
            where: { id: existingLog.assetId },
            data: { status: 'IN_USE' }
        });
    });

    res.status(200).json({ status: "success", message: "Đã hoàn thành sửa chữa. Thiết bị đã sẵn sàng sử dụng." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Lỗi cập nhật trạng thái" });
  }
};
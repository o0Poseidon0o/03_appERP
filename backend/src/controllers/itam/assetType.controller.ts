import { Request, Response } from "express";
import prisma from "../../config/prisma";

// ==========================================
// 1. LẤY DANH SÁCH (READ)
// ==========================================
export const getAssetTypes = async (req: Request, res: Response) => {
  try {
    const types = await prisma.assetType.findMany({
      orderBy: { name: 'asc' },
      // Kèm theo số lượng tài sản đang thuộc loại này (để biết mà không xóa bậy)
      include: {
        _count: {
            select: { assets: true }
        }
      }
    });
    
    res.status(200).json({
      status: "success",
      data: types
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Lỗi lấy danh sách loại tài sản" });
  }
};

// ==========================================
// 2. TẠO MỚI LOẠI TÀI SẢN (CREATE)
// ==========================================
export const createAssetType = async (req: Request, res: Response) => {
    try {
        const { code, name } = req.body;

        if (!code || !name) {
            return res.status(400).json({ status: "error", message: "Mã (Code) và Tên là bắt buộc!" });
        }

        // Check trùng Code
        const exists = await prisma.assetType.findUnique({ where: { code: code.toUpperCase() } });
        if (exists) {
            return res.status(400).json({ status: "error", message: `Mã loại '${code}' đã tồn tại!` });
        }

        const newType = await prisma.assetType.create({
            data: {
                code: code.toUpperCase(),
                name: name
            }
        });

        res.status(201).json({ status: "success", data: newType });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Lỗi khi tạo loại tài sản" });
    }
};

// ==========================================
// 3. CẬP NHẬT LOẠI TÀI SẢN (UPDATE)
// ==========================================
export const updateAssetType = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { code, name } = req.body;

        // Check trùng Code với thằng khác (nếu có đổi code)
        if (code) {
            const exists = await prisma.assetType.findFirst({
                where: { 
                    code: code.toUpperCase(),
                    id: { not: id } // Không tính chính nó
                }
            });
            if (exists) {
                return res.status(400).json({ status: "error", message: `Mã loại '${code}' đã được sử dụng!` });
            }
        }

        const updatedType = await prisma.assetType.update({
            where: { id },
            data: {
                code: code ? code.toUpperCase() : undefined,
                name
            }
        });

        res.status(200).json({ status: "success", data: updatedType });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Lỗi khi cập nhật loại tài sản" });
    }
};

// ==========================================
// 4. XÓA LOẠI TÀI SẢN (DELETE)
// ==========================================
export const deleteAssetType = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // [QUAN TRỌNG] Kiểm tra xem có tài sản nào đang dùng loại này không?
        const count = await prisma.asset.count({ where: { typeId: id } });
        
        if (count > 0) {
            return res.status(400).json({ 
                status: "error", 
                message: `Không thể xóa! Đang có ${count} thiết bị thuộc loại này. Hãy chuyển chúng sang loại khác trước.` 
            });
        }

        await prisma.assetType.delete({ where: { id } });

        res.status(200).json({ status: "success", message: "Đã xóa loại tài sản thành công" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Lỗi khi xóa loại tài sản" });
    }
};

// ==========================================
// 5. SEED DATA (GIỮ NGUYÊN)
// ==========================================
export const seedAssetTypes = async (req: Request, res: Response) => {
    try {
        const defaultTypes = [
            { code: 'PC', name: 'Máy tính để bàn (PC)' },
            { code: 'LAPTOP', name: 'Laptop' },
            { code: 'MONITOR', name: 'Màn hình' },
            { code: 'PRINTER', name: 'Máy in' },
            { code: 'SCANNER', name: 'Máy Scan' },
            { code: 'PROJECTOR', name: 'Máy chiếu' },
            { code: 'SERVER', name: 'Máy chủ (Server)' },
            { code: 'NETWORK', name: 'Thiết bị mạng (Switch/Wifi)' },
            { code: 'MOUSE', name: 'Chuột' },
            { code: 'KEYBOARD', name: 'Bàn phím' },
            { code: 'WEBCAM', name: 'Webcam / Camera' },
            { code: 'HEADPHONE', name: 'Tai nghe / Loa' },
            { code: 'UPS', name: 'Bộ lưu điện (UPS)' },
            { code: 'OTHER', name: 'Khác' },
        ];

        await prisma.$transaction(
            defaultTypes.map(type => 
                prisma.assetType.upsert({
                    where: { code: type.code },
                    update: {},
                    create: type
                })
            )
        );

        res.status(200).json({ status: "success", message: "Đã khởi tạo dữ liệu mẫu thành công!" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Lỗi khi seed data" });
    }
};
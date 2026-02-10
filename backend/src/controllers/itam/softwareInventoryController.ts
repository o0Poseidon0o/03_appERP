import { Request, Response } from "express";
import prisma from "../../config/prisma";

// 1. API TỔNG HỢP: Lấy danh sách tất cả phần mềm & Số lượng máy cài
// GET /api/itam/software/inventory
export const getSoftwareInventory = async (req: Request, res: Response) => {
  try {
    // Sử dụng tính năng groupBy của Prisma để gom nhóm theo tên
    const inventory = await prisma.installedSoftware.groupBy({
      by: ['name', 'publisher'], // Gom nhóm theo Tên và Nhà phát hành
      _count: {
        assetId: true // Đếm số lượng máy (assetId)
      },
      orderBy: {
        _count: {
          assetId: 'desc' // Sắp xếp cái nào cài nhiều nhất lên đầu
        }
      },
      // Có thể thêm having để lọc bớt rác (ví dụ chỉ lấy cái nào > 1 máy cài)
      // having: { assetId: { _count: { gt: 0 } } } 
    });

    // Format lại dữ liệu cho đẹp
    const formattedData = inventory.map(item => ({
      name: item.name,
      publisher: item.publisher || 'Unknown',
      installCount: item._count.assetId
    }));

    return res.status(200).json({
      status: "success",
      totalUniqueSoftware: inventory.length,
      data: formattedData
    });

  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 2. API CHI TIẾT: Xem phần mềm X đang cài trên những máy nào?
// GET /api/itam/software/detail?name=AutoCAD
export const getSoftwareInstallations = async (req: Request, res: Response) => {
  try {
    const { name } = req.query;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: "Vui lòng cung cấp tên phần mềm (query param: name)" });
    }

    const installations = await prisma.installedSoftware.findMany({
      where: {
        name: {
          equals: name // Tìm chính xác tên
          // Hoặc dùng contains nếu muốn tìm gần đúng: contains: name, mode: 'insensitive'
        }
      },
      select: {
        version: true,
        installDate: true,
        // KẾT HỢP (JOIN) VỚI BẢNG ASSET ĐỂ LẤY USER VÀ TÊN MÁY
        asset: {
          select: {
            id: true,
            name: true,       // Tên máy (Hostname)
            domainUser: true, // User đang sử dụng
            model: true,
            department: true  // Phòng ban (nếu có)
          }
        }
      }
    });

    return res.status(200).json({
      status: "success",
      softwareName: name,
      total: installations.length,
      data: installations
    });

  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};
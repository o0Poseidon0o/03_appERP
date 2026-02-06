import { Request, Response } from "express";
import prisma from "../../config/prisma";

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const [
      totalAssets, 
      // [UPDATE] Lấy full danh sách máy hỏng thay vì chỉ count
      brokenAssets, 
      // [UPDATE] Lấy full danh sách máy tính để lọc RAM yếu
      allComputers, 
      offlineAssets, 
      statusGroups, 
      typeGroups,
      factoryGroups 
    ] = await Promise.all([
      // 1. Tổng tài sản
      prisma.asset.count(),
      
      // 2. [UPDATE] Lấy danh sách máy đang sửa/hỏng (Kèm thông tin vị trí, user)
      prisma.asset.findMany({ 
          where: { status: { in: ['BROKEN', 'REPAIR'] } },
          include: { factory: true, users: true },
          orderBy: { updatedAt: 'desc' }
      }),

      // 3. [UPDATE] Lấy danh sách PC/Laptop để lọc RAM yếu (Kèm thông tin hiển thị)
      prisma.asset.findMany({
        where: { type: { code: { in: ['PC', 'LAPTOP'] } } },
        select: { 
            id: true, name: true, modelName: true, status: true,
            customSpecs: true, domainUser: true, 
            factory: { select: { name: true } } 
        }
      }),

      // 4. Đếm máy offline > 30 ngày (Vẫn giữ count để hiển thị số)
      prisma.asset.count({
        where: { lastSeen: { lt: new Date(new Date().setDate(new Date().getDate() - 30)) } }
      }),

      // 5. Group theo Trạng thái (Biểu đồ tròn)
      prisma.asset.groupBy({
        by: ['status'],
        _count: { status: true }
      }),

      // 6. Group theo Loại (Biểu đồ cột)
      prisma.asset.groupBy({
        by: ['typeId'],
        _count: { typeId: true }
      }),

      // 7. Thống kê PC/Laptop theo Nhà máy (Biểu đồ cột ngang)
      prisma.factory.findMany({
        select: {
            name: true,
            _count: {
                select: {
                    assets: {
                        where: {
                            type: { code: { in: ['PC', 'LAPTOP'] } }
                        }
                    }
                }
            }
        }
      })
    ]);

    // --- XỬ LÝ DỮ LIỆU ---

    // 1. Lọc ra danh sách máy RAM < 8GB từ allComputers
    const lowRamList = allComputers.filter((a: any) => {
        if (a.customSpecs && a.customSpecs.ram) {
            const ramNum = parseInt(a.customSpecs.ram.replace(/\D/g, ''));
            // Logic: Có số RAM, nhỏ hơn 8 và lớn hơn 0
            return !isNaN(ramNum) && ramNum < 8 && ramNum > 0;
        }
        return false;
    });

    // 2. Map tên Loại tài sản
    const types = await prisma.assetType.findMany();
    const typeStats = typeGroups.map(g => {
        const typeInfo = types.find(t => t.id === g.typeId);
        return { name: typeInfo?.name || 'Khác', value: g._count.typeId };
    });

    // 3. Map Trạng thái
    const statusStats = statusGroups.map(g => ({
        name: g.status, value: g._count.status
    }));

    // 4. Map Nhà máy
    const factoryStats = factoryGroups.map(f => ({
        name: f.name,
        value: f._count.assets
    }));

    res.status(200).json({
      status: "success",
      data: {
        cards: {
            total: totalAssets,
            broken: brokenAssets.length, // Đếm số lượng từ mảng
            lowRam: lowRamList.length,   // Đếm số lượng từ mảng
            offline: offlineAssets
        },
        // [MỚI] Trả về danh sách chi tiết để Frontend hiện Modal
        lists: {
            broken: brokenAssets,
            lowRam: lowRamList
        },
        charts: {
            byStatus: statusStats,
            byType: typeStats,
            byFactory: factoryStats
        }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Lỗi tải thống kê Dashboard" });
  }
};
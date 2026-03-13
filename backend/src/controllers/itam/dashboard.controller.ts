import { Request, Response } from "express";
import prisma from "../../config/prisma";

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // [UPDATE] Đã đổi thành lấy mốc thời gian 60 ngày trước để test
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [
      totalAssets, 
      totalComputingAssets, 
      brokenAssets, 
      allComputers, 
      offlineAssets, 
      statusGroups, 
      typeGroups,
      factoryGroups,
      // Chứa kết quả truy vấn lịch sử nâng cấp
      upgradedAssetsLogs 
    ] = await Promise.all([
      prisma.asset.count(),
      
      prisma.asset.count({
          where: { type: { code: { in: ['PC', 'LAPTOP', 'SERVER'] } } }
      }),

      // 2. Lấy danh sách máy đang sửa/hỏng
      prisma.asset.findMany({ 
          where: { status: { in: ['BROKEN', 'REPAIR'] } },
          include: { 
              factory: true, 
              department: true, 
              // Lấy thông tin User và include luôn Department của User đó
              users: {
                  include: {
                      department: true 
                  }
              } 
          }, 
          orderBy: { updatedAt: 'desc' }
      }),

      // 3. Lấy danh sách PC/Laptop để lọc RAM yếu
      prisma.asset.findMany({
        where: { type: { code: { in: ['PC', 'LAPTOP'] } } },
        select: { 
            id: true, name: true, modelName: true, status: true,
            customSpecs: true, domainUser: true, 
            factory: { select: { name: true } },
            department: { select: { name: true } }, 
            
            users: { 
                select: { 
                    id: true, 
                    fullName: true, 
                    email: true,
                    department: { select: { name: true } } 
                } 
            } 
        }
      }),

      prisma.asset.count({
        where: { lastSeen: { lt: new Date(new Date().setDate(new Date().getDate() - 30)) } }
      }),

      prisma.asset.groupBy({
        by: ['status'],
        _count: { status: true }
      }),

      prisma.asset.groupBy({
        by: ['typeId'],
        _count: { typeId: true }
      }),

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
      }),

      // [UPDATE] Truy vấn bảng MaintenanceLog lấy các máy thay đổi phần cứng trong 60 ngày
      prisma.maintenanceLog.findMany({
          where: {
              type: 'UPGRADE', // Lọc đúng loại log là nâng cấp/thay đổi
              startDate: { gte: sixtyDaysAgo } // Trong vòng 60 ngày qua
          },
          include: {
              asset: { // Include thông tin máy tính để hiển thị lên bảng
                  include: {
                      factory: true,
                      department: true,
                      users: {
                          include: { department: true }
                      }
                  }
              }
          },
          orderBy: { startDate: 'desc' } // Sắp xếp mới nhất lên đầu
      })
    ]);

    // --- XỬ LÝ DỮ LIỆU ---

    // 1. Lọc ra danh sách máy RAM < 8GB từ allComputers
    const lowRamList = allComputers.filter((a: any) => {
        if (a.customSpecs && a.customSpecs.ram) {
            const ramNum = parseInt(a.customSpecs.ram.replace(/\D/g, ''));
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
            totalComputing: totalComputingAssets, 
            totalComponents: totalAssets - totalComputingAssets, 
            broken: brokenAssets.length, 
            lowRam: lowRamList.length, 
            offline: offlineAssets,
            upgraded: upgradedAssetsLogs.length // Tổng số máy thay đổi
        },
        lists: {
            broken: brokenAssets,
            lowRam: lowRamList,
            upgraded: upgradedAssetsLogs // Danh sách chi tiết
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
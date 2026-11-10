"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const getDashboardStats = async (req, res) => {
    try {
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const [totalAssets, totalComputingAssets, brokenAssets, allComputers, offlineAssets, statusGroups, typeGroups, factoryGroups, upgradedAssetsLogs] = await Promise.all([
            prisma_1.default.asset.count(),
            prisma_1.default.asset.count({
                where: { type: { code: { in: ['PC', 'LAPTOP', 'SERVER'] } } }
            }),
            prisma_1.default.asset.findMany({
                where: { status: { in: ['BROKEN', 'REPAIR'] } },
                include: {
                    factory: true,
                    department: true,
                    users: {
                        include: {
                            department: true
                        }
                    }
                },
                orderBy: { updatedAt: 'desc' }
            }),
            prisma_1.default.asset.findMany({
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
            prisma_1.default.asset.count({
                where: { lastSeen: { lt: new Date(new Date().setDate(new Date().getDate() - 30)) } }
            }),
            prisma_1.default.asset.groupBy({
                by: ['status'],
                _count: { status: true }
            }),
            prisma_1.default.asset.groupBy({
                by: ['typeId'],
                _count: { typeId: true }
            }),
            prisma_1.default.factory.findMany({
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
            prisma_1.default.maintenanceLog.findMany({
                where: {
                    type: 'UPGRADE',
                    startDate: { gte: sixtyDaysAgo }
                },
                include: {
                    asset: {
                        include: {
                            factory: true,
                            department: true,
                            users: {
                                include: { department: true }
                            }
                        }
                    }
                },
                orderBy: { startDate: 'desc' }
            })
        ]);
        const lowRamList = allComputers.filter((a) => {
            if (a.customSpecs && a.customSpecs.ram) {
                const ramNum = parseInt(a.customSpecs.ram.replace(/\D/g, ''));
                return !isNaN(ramNum) && ramNum < 8 && ramNum > 0;
            }
            return false;
        });
        const types = await prisma_1.default.assetType.findMany();
        const typeStats = typeGroups.map(g => {
            const typeInfo = types.find(t => t.id === g.typeId);
            return { name: typeInfo?.name || 'Khác', value: g._count.typeId };
        });
        const statusStats = statusGroups.map(g => ({
            name: g.status, value: g._count.status
        }));
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
                    upgraded: upgradedAssetsLogs.length
                },
                lists: {
                    broken: brokenAssets,
                    lowRam: lowRamList,
                    upgraded: upgradedAssetsLogs
                },
                charts: {
                    byStatus: statusStats,
                    byType: typeStats,
                    byFactory: factoryStats
                }
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Lỗi tải thống kê Dashboard" });
    }
};
exports.getDashboardStats = getDashboardStats;

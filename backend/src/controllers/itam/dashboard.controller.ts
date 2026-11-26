import { Request, Response } from "express";
import prisma from "../../config/prisma";

const STATUS_LABEL_MAP: Record<string, string> = {
  IN_USE: "Đang sử dụng",
  NEW: "Mới tiếp nhận",
  REPAIR: "Đang sửa chữa",
  BROKEN: "Đang báo hỏng",
  STORAGE: "Lưu kho",
  LIQUIDATED: "Đã thanh lý",
  LOST: "Thất lạc",
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalAssets,
      allComputers,
      brokenAssets,
      componentGroups,
      faultyComponentsCount,
      statusGroups,
      typeGroups,
      factoryGroups,
      upgradedAssetsLogs,
      types,
      expiringKeysCount,
    ] = await Promise.all([
      prisma.asset.count(),

      prisma.asset.findMany({
        where: { type: { code: { in: ["PC", "LAPTOP", "SERVER"] } } },
        select: {
          id: true,
          name: true,
          serialNumber: true,
          ipAddress: true,
          osName: true,
          osVersion: true,
          modelName: true,
          manufacturer: true,
          status: true,
          lastSeen: true,
          domainUser: true,
          customSpecs: true,
          type: { select: { code: true, name: true } },
          factory: { select: { name: true } },
          department: { select: { name: true } },
          components: {
            select: {
              id: true,
              type: true,
              name: true,
              status: true,
              specs: true,
            },
          },
          users: {
            select: {
              id: true,
              fullName: true,
              email: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { lastSeen: "desc" },
      }),

      prisma.asset.findMany({
        where: { status: { in: ["BROKEN", "REPAIR"] } },
        include: {
          factory: true,
          department: true,
          users: { include: { department: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),

      prisma.assetComponent.groupBy({
        by: ["type"],
        _count: { type: true },
      }),

      prisma.assetComponent.count({
        where: { status: "FAULTY" },
      }),

      prisma.asset.groupBy({
        by: ["status"],
        _count: { status: true },
      }),

      prisma.asset.groupBy({
        by: ["typeId"],
        _count: { typeId: true },
      }),

      prisma.factory.findMany({
        select: {
          name: true,
          _count: {
            select: {
              assets: {
                where: { type: { code: { in: ["PC", "LAPTOP", "SERVER"] } } },
              },
            },
          },
        },
      }),

      prisma.maintenanceLog.findMany({
        where: {
          type: "UPGRADE",
          startDate: { gte: sixtyDaysAgo },
        },
        include: {
          asset: {
            include: {
              factory: true,
              department: true,
              users: { include: { department: true } },
            },
          },
        },
        orderBy: { startDate: "desc" },
      }),

      prisma.assetType.findMany(),

      prisma.softwareLicenseKey.count({
        where: {
          status: "ACTIVE",
          expiredAt: { lte: thirtyDaysFromNow },
        },
      }),
    ]);

    // --- 1. TỔNG HỢP LINH KIỆN & NGOẠI VI THỰC TẾ ---
    const componentCountMap: Record<string, number> = {};
    let totalComponentsReal = 0;
    for (const cg of componentGroups) {
      componentCountMap[cg.type] = cg._count.type;
      totalComponentsReal += cg._count.type;
    }

    // --- 2. PHÂN TÍCH SỨC KHỎE, KẾT NỐI, CẤU HÌNH, BẢN QUYỀN & HỆ ĐIỀU HÀNH ---
    const lowRamList: any[] = [];
    const healthWarningList: any[] = [];
    const offlineList: any[] = [];
    const unlicensedOsList: any[] = [];
    let batteryDegradedCount = 0;

    let online24hCount = 0;
    let active7dCount = 0;
    let offline7dCount = 0;
    let offline30dCount = 0;

    let healthGoodCount = 0;
    let healthWarningCount = 0;
    let healthCriticalCount = 0;

    let licensedOsCount = 0;
    let unlicensedOsCount = 0;

    const osDistribution: Record<string, number> = {
      "Windows 11": 0,
      "Windows 10": 0,
      "Windows 7 / 8": 0,
      "Windows Server": 0,
      "Ubuntu / Linux": 0,
      "Khác": 0,
    };

    const ramGenDistribution: Record<string, number> = {
      DDR5: 0,
      DDR4: 0,
      DDR3: 0,
      "DDR2 / Cũ": 0,
    };

    let ssdMachineCount = 0;
    let hddOnlyMachineCount = 0;

    for (const comp of allComputers) {
      const specs: any = comp.customSpecs || {};
      const rawRamStr = String(specs.ram || "");
      // Sửa lỗi parseInt: chỉ lấy số đứng đầu (VD: "4 GB DDR4" -> 4, không bị gộp số 4 của DDR4 thành 44)
      const ramMatch = rawRamStr.match(/^(\d+)/);
      const ramNum = ramMatch ? parseInt(ramMatch[1], 10) : 0;

      const diskComps = (comp.components || []).filter((c: any) => c.type === "HARD_DISK");
      const hasSsd =
        diskComps.some((d: any) => /SSD|NVMe/i.test(String(d.specs?.type || d.name || ""))) ||
        /SSD|NVMe/i.test(String(specs.disk || ""));
      const hasDiskInfo = diskComps.length > 0 || Boolean(specs.disk && specs.disk !== "N/A");

      if (hasSsd) ssdMachineCount++;
      else if (hasDiskInfo) hddOnlyMachineCount++;

      // Máy cấu hình yếu: RAM < 8GB (trên PC/Laptop)
      if (comp.type?.code !== "SERVER" && ramNum > 0 && ramNum < 8) {
        lowRamList.push({
          ...comp,
          upgradeReason:
            !hasSsd && hasDiskInfo
              ? `RAM thấp (${rawRamStr}) + Đang dùng ổ HDD cơ`
              : `RAM thấp (${rawRamStr})`,
        });
      }

      // Phân loại thế hệ RAM (DDR3 / DDR4 / DDR5)
      const firstStick = Array.isArray(specs.ramDetails) ? specs.ramDetails[0] : null;
      const ddrCombined = `${specs.ramType || ""} ${rawRamStr} ${firstStick?.Type || ""} ${firstStick?.Speed || ""}`;
      if (/DDR5/i.test(ddrCombined)) ramGenDistribution["DDR5"]++;
      else if (/DDR4/i.test(ddrCombined)) ramGenDistribution["DDR4"]++;
      else if (/DDR3/i.test(ddrCombined)) ramGenDistribution["DDR3"]++;
      else if (/DDR2/i.test(ddrCombined)) ramGenDistribution["DDR2 / Cũ"]++;
      else if (specs.cpu) {
        if (/i[3579]-(6|7|8|9|10|11|12|13|14)\d{2}|Ryzen/i.test(specs.cpu)) ramGenDistribution["DDR4"]++;
        else if (/i[357]-[2345]\d{2}|i[357]-\d{3}/i.test(specs.cpu)) ramGenDistribution["DDR3"]++;
      }

      // Phân loại Hệ điều hành
      const os = String(comp.osName || "");
      if (/Server/i.test(os)) osDistribution["Windows Server"]++;
      else if (/Windows 11/i.test(os)) osDistribution["Windows 11"]++;
      else if (/Windows 10/i.test(os)) osDistribution["Windows 10"]++;
      else if (/Windows (7|8|XP|Vista)/i.test(os)) osDistribution["Windows 7 / 8"]++;
      else if (/Ubuntu|Linux|Debian|CentOS|RedHat/i.test(os)) osDistribution["Ubuntu / Linux"]++;
      else if (os) osDistribution["Khác"]++;

      // Phân loại trạng thái kết nối Agent
      const lastSeenDate = comp.lastSeen ? new Date(comp.lastSeen) : null;
      if (lastSeenDate && lastSeenDate >= twentyFourHoursAgo) {
        online24hCount++;
      } else if (lastSeenDate && lastSeenDate >= sevenDaysAgo) {
        active7dCount++;
      } else {
        offline7dCount++;
        offlineList.push(comp);
        if (!lastSeenDate || lastSeenDate < thirtyDaysAgo) {
          offline30dCount++;
        }
      }

      // Phân loại Sức khỏe phần cứng (100% S.M.A.R.T phần cứng / CPU / RAM / Ổ đĩa / Pin Laptop)
      const hwHealth = specs.hardwareHealth || null;
      const batInfo = hwHealth?.battery?.hasBattery ? hwHealth.battery : null;
      if (batInfo && (batInfo.status === "CRITICAL" || batInfo.status === "WARNING")) {
        batteryDegradedCount++;
      }
      const hasFaultyDisk = diskComps.some(
        (d: any) => d.status === "FAULTY" || d.specs?.healthStatus === "CRITICAL"
      );
      const hasWarningDisk = diskComps.some(
        (d: any) => d.specs?.healthStatus === "WARNING"
      );

      // Thu thập chi tiết nguyên nhân lỗi S.M.A.R.T cụ thể từng ổ cứng (Bad Sector, Pending, Uncorrectable, CRC cáp SATA, SSD hao mòn)
      const diskIssueMessages: string[] = [];
      for (const dc of diskComps) {
        const ds: any = dc.specs || {};
        if (Array.isArray(ds.healthIssues) && ds.healthIssues.length > 0) {
          diskIssueMessages.push(`${dc.name}: ${ds.healthIssues.join(" | ")}`);
        } else if (dc.status === "FAULTY" || ds.healthStatus === "CRITICAL" || ds.healthStatus === "WARNING") {
          diskIssueMessages.push(`${dc.name}: ${ds.healthText || "Phát hiện lỗi ổ cứng"}`);
        }
      }

      const combinedAlerts: string[] = [];
      for (const msg of diskIssueMessages) {
        if (!combinedAlerts.includes(msg)) combinedAlerts.push(msg);
      }
      if (Array.isArray(hwHealth?.alerts)) {
        for (const al of hwHealth.alerts) {
          if (al && !combinedAlerts.some((c) => c.includes(al) || al.includes(c))) {
            combinedAlerts.push(al);
          }
        }
      }

      if (
        comp.status === "BROKEN" ||
        hasFaultyDisk ||
        hwHealth?.overallStatus === "CRITICAL" ||
        batInfo?.status === "CRITICAL"
      ) {
        healthCriticalCount++;
        healthWarningList.push({
          ...comp,
          healthLevel: "CRITICAL",
          healthSummary:
            combinedAlerts.join("; ") ||
            batInfo?.statusText ||
            hwHealth?.overallText ||
            "Lỗi phần cứng nghiêm trọng (Ổ cứng S.M.A.R.T / Pin chai nặng / Thiết bị báo hỏng)",
        });
      } else if (
        comp.status === "REPAIR" ||
        hasWarningDisk ||
        hwHealth?.overallStatus === "WARNING" ||
        batInfo?.status === "WARNING" ||
        (ramNum > 0 && ramNum <= 4)
      ) {
        healthWarningCount++;
        healthWarningList.push({
          ...comp,
          healthLevel: "WARNING",
          healthSummary:
            combinedAlerts.join("; ") ||
            batInfo?.statusText ||
            hwHealth?.overallText ||
            (ramNum <= 4 ? `RAM thấp (${rawRamStr})` : "Cần chú ý dung lượng ổ đĩa / RAM / Pin Laptop"),
        });
      } else {
        healthGoodCount++;
      }

      // Kiểm tra Bản quyền Hệ điều hành
      const osLic = specs.osLicense || null;
      if (/Ubuntu|Linux/i.test(os)) {
        licensedOsCount++;
      } else if (osLic?.status === "LICENSED") {
        licensedOsCount++;
      } else if (osLic?.status === "UNLICENSED") {
        unlicensedOsCount++;
        unlicensedOsList.push({
          ...comp,
          licenseNote: `Windows chưa kích hoạt (${osLic.channel || "UNLICENSED"})`,
        });
      }
    }

    // --- 2B. THỐNG KÊ CHI TIẾT THEO NHÀ MÁY & BỘ PHẬN (PHÒNG BAN) ---
    const factoryDeptMap: Record<
      string,
      {
        key: string;
        factoryName: string;
        departmentName: string;
        total: number;
        pcCount: number;
        laptopCount: number;
        serverCount: number;
        inUseCount: number;
        brokenCount: number;
        lowRamCount: number;
      }
    > = {};

    for (const comp of allComputers) {
      const factoryName = comp.factory?.name || "Chưa gán Nhà máy";
      const deptName =
        comp.department?.name ||
        comp.users?.[0]?.department?.name ||
        "Chưa gán Bộ phận";
      const mapKey = `${factoryName}___${deptName}`;

      if (!factoryDeptMap[mapKey]) {
        factoryDeptMap[mapKey] = {
          key: mapKey,
          factoryName,
          departmentName: deptName,
          total: 0,
          pcCount: 0,
          laptopCount: 0,
          serverCount: 0,
          inUseCount: 0,
          brokenCount: 0,
          lowRamCount: 0,
        };
      }

      const row = factoryDeptMap[mapKey];
      row.total++;
      const tCode = comp.type?.code || "PC";
      if (tCode === "LAPTOP") row.laptopCount++;
      else if (tCode === "SERVER") row.serverCount++;
      else row.pcCount++;

      if (comp.status === "BROKEN" || comp.status === "REPAIR") row.brokenCount++;
      else row.inUseCount++;

      const specs: any = comp.customSpecs || {};
      const ramMatch = String(specs.ram || "").match(/^(\d+)/);
      const ramNum = ramMatch ? parseInt(ramMatch[1], 10) : 0;
      if (tCode !== "SERVER" && ramNum > 0 && ramNum < 8) {
        row.lowRamCount++;
      }
    }

    const factoryDepartmentSummary = Object.values(factoryDeptMap).sort((a, b) => {
      const fCmp = a.factoryName.localeCompare(b.factoryName, "vi");
      if (fCmp !== 0) return fCmp;
      return b.total - a.total;
    });

    // --- 3. DỮ LIỆU BIỂU ĐỒ ---
    const typeStats = typeGroups.map((g) => {
      const typeInfo = types.find((t) => t.id === g.typeId);
      return {
        name: typeInfo?.name || "Khác",
        code: typeInfo?.code || "OTHER",
        value: g._count.typeId,
      };
    });

    const statusStats = statusGroups.map((g) => ({
      code: g.status,
      name: STATUS_LABEL_MAP[g.status] || g.status,
      value: g._count.status,
    }));

    const factoryStats = factoryGroups.map((f) => ({
      name: f.name,
      value: f._count.assets,
    }));

    const osChartData = Object.entries(osDistribution)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({ name, value }));

    const ramGenChartData = Object.entries(ramGenDistribution)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({ name, value }));

    res.status(200).json({
      status: "success",
      data: {
        cards: {
          total: totalAssets,
          totalComputing: allComputers.length,
          totalComponents: totalComponentsReal,
          monitorsCount: componentCountMap["MONITOR"] || 0,
          disksCount: componentCountMap["HARD_DISK"] || 0,
          peripheralsCount:
            (componentCountMap["MOUSE"] || 0) +
            (componentCountMap["KEYBOARD"] || 0) +
            (componentCountMap["PERIPHERAL"] || 0),
          faultyComponents: faultyComponentsCount,
          broken: brokenAssets.length,
          lowRam: lowRamList.length,
          hddOnly: hddOnlyMachineCount,
          ssdMachines: ssdMachineCount,
          offline: offline30dCount,
          offline7d: offline7dCount,
          online24h: online24hCount,
          active7d: active7dCount,
          upgraded: upgradedAssetsLogs.length,
          healthGood: healthGoodCount,
          healthWarning: healthWarningCount,
          healthCritical: healthCriticalCount,
          batteryDegraded: batteryDegradedCount,
          licensedOs: licensedOsCount,
          unlicensedOs: unlicensedOsCount,
          expiringKeys: expiringKeysCount,
        },
        lists: {
          allComputers,
          factoryDepartmentSummary,
          broken: brokenAssets,
          lowRam: lowRamList,
          upgraded: upgradedAssetsLogs,
          offline: offlineList,
          healthAlerts: healthWarningList,
          unlicensed: unlicensedOsList,
        },
        charts: {
          byStatus: statusStats,
          byType: typeStats,
          byFactory: factoryStats,
          byOs: osChartData,
          byRamGen: ramGenChartData,
          storageSummary: [
            { name: "Đã có SSD/NVMe", value: ssdMachineCount },
            { name: "Chỉ có HDD cơ", value: hddOnlyMachineCount },
          ].filter((x) => x.value > 0),
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Lỗi tải thống kê Dashboard" });
  }
};

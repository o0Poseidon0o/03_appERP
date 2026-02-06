import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma";

// --- INTERFACE CHO PAYLOAD CỦA AGENT ---
interface AgentPayload {
  hostname: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  osName: string;
  osVersion: string;
  username: string; // Domain User
  cpuName: string;
  ramGB: number;
  ipAddress: string;
  macAddress: string;
  timestamp: string;

  // Trường này do PowerShell gửi lên (PC, LAPTOP, SERVER...)
  deviceType?: string;

  // [MỚI] Danh sách màn hình từ Agent V3.9
  monitors: Array<{
    Manufacturer: string;
    Model: string;
    SerialNumber: string;
    ManufacturedDate: string;
    ScreenSize?: string; // <--- [FIX] THÊM DÒNG NÀY ĐỂ HẾT LỖI
  }>;

  disks: Array<{
    Index: number;
    Model: string;
    MediaType: string;
    SizeGB: number;
    Interface: string;
    SerialNumber: string;
  }>;
  software: Array<{
    Name: string;
    Version: string;
    Publisher: string;
  }>;
}

// [HELPER] Hàm hỗ trợ so sánh sự thay đổi
const generateChangeLog = (oldVal: string, newVal: string, label: string) => {
  if (!oldVal || !newVal) return null;
  const v1 = String(oldVal).trim();
  const v2 = String(newVal).trim();
  if (v1 !== v2) {
    return `Thay đổi ${label}: [${v1}] -> [${v2}]`;
  }
  return null;
};

// ==========================================
// 0. AGENT SYNC (POWERSHELL GỬI VỀ)
// ==========================================
export const syncAssetAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. [BẢO MẬT] Check API Key
    const SECRET_KEY = process.env.AGENT_API_KEY || "@Towa2026!#Secure_Agent_998811_AbCdEf";
    const apiKey = req.headers["x-api-key"];

    if (apiKey !== SECRET_KEY) {
      return res.status(401).json({ status: "fail", message: "Sai mã bảo mật Agent!" });
    }

    const data = req.body as AgentPayload;

    // 2. Validate Hostname
    if (!data.hostname) {
      return res.status(400).json({ status: "error", message: "Hostname is required" });
    }

    const uniqueHostname = data.hostname.toUpperCase().trim();

    // 3. [UPDATE] Xử lý AssetType Thông Minh
    const detectedCode = data.deviceType ? data.deviceType.toUpperCase() : "PC";
    
    let assetType = await prisma.assetType.findUnique({
        where: { code: detectedCode }
    });

    if (!assetType) {
        assetType = await prisma.assetType.upsert({
            where: { code: "PC" },
            update: {},
            create: { code: "PC", name: "Máy tính (Auto Import)" }
        });
    }

    // 4. Chuẩn bị dữ liệu phần cứng MỚI
    const newDiskSummary = Array.isArray(data.disks)
      ? data.disks.map((d) => `${d.SizeGB}GB ${d.MediaType ? `(${d.MediaType})` : ""}`).join(" + ")
      : "N/A";
    
    const newRamString = `${data.ramGB} GB`;
    const newCpuString = data.cpuName;

    // 5. [LOGIC QUAN TRỌNG] Lấy dữ liệu CŨ từ DB để so sánh
    const existingAsset = await prisma.asset.findUnique({
        where: { name: uniqueHostname }
    });

    const changeDetails: string[] = [];

    // Nếu máy đã tồn tại thì so sánh
    if (existingAsset) {
        const oldSpecs: any = existingAsset.customSpecs || {};
        
        // A. So sánh RAM
        const ramLog = generateChangeLog(oldSpecs.ram, newRamString, "RAM");
        if (ramLog) changeDetails.push(ramLog);

        // B. So sánh CPU
        const cpuLog = generateChangeLog(oldSpecs.cpu, newCpuString, "CPU");
        if (cpuLog) changeDetails.push(cpuLog);

        // C. So sánh Ổ cứng (Tổng quan)
        const diskLog = generateChangeLog(oldSpecs.disk, newDiskSummary, "Ổ cứng");
        if (diskLog) changeDetails.push(diskLog);

        // D. [MỚI] So sánh số lượng màn hình (Cảnh báo nếu bị tháo)
        const oldMonitorCount = await prisma.assetComponent.count({
            where: { assetId: existingAsset.id, type: 'MONITOR' }
        });
        const newMonitorCount = Array.isArray(data.monitors) ? data.monitors.length : 0;
        
        if (oldMonitorCount !== newMonitorCount) {
            changeDetails.push(`Thay đổi số lượng màn hình: [${oldMonitorCount}] -> [${newMonitorCount}]`);
        }
    }

    // 6. TRANSACTION: Cập nhật Máy + Log + Linh kiện (Disk, Monitor) + Software
    const result = await prisma.$transaction(async (tx) => {
      // Chuẩn bị dữ liệu Asset Update
      const assetData = {
        serialNumber: data.serialNumber === "Default string" ? null : data.serialNumber,
        manufacturer: data.manufacturer,
        modelName: data.model, 
        osName: data.osName,
        osVersion: data.osVersion,
        ipAddress: data.ipAddress,
        macAddress: data.macAddress,
        lastSeen: new Date(),
        domainUser: data.username, 
        customSpecs: {
          cpu: newCpuString,
          ram: newRamString,
          disk: newDiskSummary,
          lastAgentSync: data.timestamp,
        },
      };

      // A. Upsert Asset
      const asset = await tx.asset.upsert({
        where: { name: uniqueHostname },
        update: assetData, 
        create: {
          name: uniqueHostname,
          status: "NEW",
          typeId: assetType!.id, 
          ...assetData
        },
      });

      // B. Ghi Log Thay đổi Linh kiện
      if (changeDetails.length > 0) {
          await tx.maintenanceLog.create({
              data: {
                  assetId: asset.id,
                  type: 'UPGRADE', 
                  description: `Agent phát hiện thay đổi: ${changeDetails.join('. ')}`,
                  providerType: 'INTERNAL',
                  providerName: 'System Agent (Auto)',
                  cost: 0,
                  startDate: new Date(),
                  endDate: new Date(),
                  status: 'DONE'
              }
          });
      }

      // C. Xử lý Ổ cứng (Xóa cũ -> Thêm mới)
      if (Array.isArray(data.disks) && data.disks.length > 0) {
        await tx.assetComponent.deleteMany({
            where: { assetId: asset.id, type: "HARD_DISK" },
        });

        const diskComponents = data.disks.map((d) => ({
            assetId: asset.id,
            type: "HARD_DISK",
            name: d.Model || "Unknown Disk",
            serialNumber: d.SerialNumber !== "N/A" ? d.SerialNumber : null,
            status: "ACTIVE",
            specs: {
              sizeGB: d.SizeGB,
              interface: d.Interface,
              type: d.MediaType,
              index: d.Index,
            },
        }));
        await tx.assetComponent.createMany({ data: diskComponents });
      }

      // D. [MỚI] Xử lý Màn hình (Xóa cũ -> Thêm mới)
      if (Array.isArray(data.monitors) && data.monitors.length > 0) {
        await tx.assetComponent.deleteMany({
            where: { assetId: asset.id, type: "MONITOR" },
        });

        const monitorComponents = data.monitors.map((m, index) => ({
            assetId: asset.id,
            type: "MONITOR",
            name: m.Model || "Unknown Monitor",
            serialNumber: m.SerialNumber !== "0" ? m.SerialNumber : null,
            status: "ACTIVE",
            specs: {
                manufacturer: m.Manufacturer,
                manufacturedDate: m.ManufacturedDate,
                
                // ✅ [FIX] THÊM DÒNG NÀY VÀO:
                size: m.ScreenSize || "N/A", 
                
                index: index + 1
            },
        }));
        await tx.assetComponent.createMany({ data: monitorComponents });
      }

      // E. Xử lý Phần mềm
      if (Array.isArray(data.software) && data.software.length > 0) {
        await tx.installedSoftware.deleteMany({
          where: { assetId: asset.id },
        });

        const swList = data.software.slice(0, 500).map((s) => ({
          assetId: asset.id,
          name: s.Name || "Unknown App",
          version: s.Version || "",
          publisher: s.Publisher || "",
        }));

        await tx.installedSoftware.createMany({ data: swList });
      }

      return asset;
    });

    // --- SOCKET EMIT ---
    try {
        const { getIO } = require("../socket"); 
        const io = getIO();
        
        io.emit("asset_updated", { 
            message: `Máy ${uniqueHostname} vừa cập nhật!`, 
            hostname: uniqueHostname 
        });

        if (changeDetails.length > 0) {
             io.emit("hardware_alert", { 
                 message: `CẢNH BÁO: ${uniqueHostname} thay đổi phần cứng!`, 
                 details: changeDetails 
             });
        }
    } catch (e) {}

    res.status(200).json({
      status: "success",
      message: changeDetails.length > 0 
        ? `Đã cập nhật và ghi nhận ${changeDetails.length} thay đổi`
        : `Đồng bộ thành công`,
      data: result,
    });
  } catch (error: any) {
    console.error("Agent Sync Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ==========================================
// 1. LẤY DANH SÁCH TÀI SẢN (FILTER & PAGINATION)
// ==========================================
export const getAllAssets = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      typeId,
      factoryId,
      departmentId,
      status,
      parentId,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { serialNumber: { contains: String(search), mode: "insensitive" } },
        { modelName: { contains: String(search), mode: "insensitive" } },
        { domainUser: { contains: String(search), mode: "insensitive" } },
        { ipAddress: { contains: String(search) } },
      ];
    }

    if (typeId) whereClause.typeId = String(typeId);
    if (factoryId) whereClause.factoryId = String(factoryId);
    if (departmentId) whereClause.departmentId = String(departmentId);
    if (status) whereClause.status = String(status);

    if (parentId === "null") {
      whereClause.parentId = null;
    } else if (parentId) {
      whereClause.parentId = String(parentId);
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where: whereClause,
        skip,
        take: Number(limit),
        orderBy: { updatedAt: "desc" },
        include: {
          type: true, 
          factory: true,
          department: true,
          users: { select: { id: true, fullName: true, email: true } },
          parent: { select: { id: true, name: true } },
          _count: { select: { children: true, softwares: true } },
          // [MỚI] Bao gồm Monitors để hiển thị ra bảng
          components: {
             where: { type: 'MONITOR' },
             select: { id: true, name: true, serialNumber: true, type: true, specs: true }
          }
        },
      }),
      prisma.asset.count({ where: whereClause }),
    ]);

    res.status(200).json({
      status: "success",
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: assets,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ==========================================
// 2. XEM CHI TIẾT TÀI SẢN
// ==========================================
export const getAssetById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        type: true,
        factory: true,
        department: true,
        users: true,
        parent: true,
        children: { include: { type: true } },
        components: true, // [MỚI] Sẽ trả về cả Màn hình ở đây
        softwares: { orderBy: { name: "asc" } },
        maintenances: { orderBy: { startDate: "desc" } },
      },
    });

    if (!asset) return res.status(404).json({ status: "error", message: "Không tìm thấy tài sản!" });

    res.status(200).json({ status: "success", data: asset });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ==========================================
// 3. TẠO TÀI SẢN THỦ CÔNG
// ==========================================
export const createAsset = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const exists = await prisma.asset.findUnique({ where: { name: data.name } });
    if (exists) return res.status(400).json({ status: "error", message: "Tên tài sản đã tồn tại!" });

    const newAsset = await prisma.asset.create({
      data: {
        name: data.name,
        serialNumber: data.serialNumber,
        typeId: data.typeId,
        status: data.status || "NEW",
        factoryId: data.factoryId || null,
        departmentId: data.departmentId || null,
        domainUser: data.domainUser,
        parentId: data.parentId || null,
        manufacturer: data.manufacturer,
        modelName: data.modelName,
        customSpecs: data.customSpecs || {},
        users: data.userIds?.length > 0 
            ? { connect: data.userIds.map((id: string) => ({ id })) } 
            : undefined,
      },
    });

    res.status(201).json({ status: "success", data: newAsset });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ==========================================
// 4. CẬP NHẬT TÀI SẢN
// ==========================================
export const updateAsset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (data.name) {
      const exists = await prisma.asset.findFirst({
        where: { name: data.name, id: { not: id } },
      });
      if (exists) return res.status(400).json({ status: "error", message: "Tên tài sản đã bị trùng!" });
    }

    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: {
        name: data.name,
        serialNumber: data.serialNumber,
        typeId: data.typeId,
        status: data.status,
        factoryId: data.factoryId,
        departmentId: data.departmentId,
        domainUser: data.domainUser,
        parentId: data.parentId,
        manufacturer: data.manufacturer,
        modelName: data.modelName,
        customSpecs: data.customSpecs,
        users: data.userIds 
            ? { set: data.userIds.map((id: string) => ({ id })) } 
            : undefined,
      },
    });

    res.status(200).json({ status: "success", data: updatedAsset });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ==========================================
// 5. XÓA TÀI SẢN
// ==========================================
export const deleteAsset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const childrenCount = await prisma.asset.count({ where: { parentId: id } });
    if (childrenCount > 0) {
      return res.status(400).json({ 
        status: "error", 
        message: `Đang có ${childrenCount} thiết bị con gắn vào tài sản này. Hãy gỡ chúng ra trước!` 
      });
    }

    await prisma.asset.delete({ where: { id } });
    res.status(200).json({ status: "success", message: "Đã xóa tài sản." });
  } catch (error: any) {
    if (error.code === 'P2003') {
        return res.status(400).json({ status: "error", message: "Tài sản này đang có dữ liệu liên quan. Không thể xóa!" });
    }
    res.status(500).json({ status: "error", message: error.message });
  }
};
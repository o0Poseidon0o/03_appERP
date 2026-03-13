import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma";
import { getIO } from "../../socket"; 

// --- INTERFACE CHO PAYLOAD CỦA AGENT V3.13 ---
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

  deviceType?: string; // PC, LAPTOP, SERVER...

  ramDetails?: Array<{
      Slot: string;
      Capacity: string;
      Speed: string;
      Manufacturer: string;
  }>;

  gpus?: Array<{
      Name: string;
      VRAM: string;
      DriverVersion: string;
  }>;

  peripherals?: Array<{
      Name: string;
      Type: string; // Keyboard / Mouse
      Brand: string;
      Connection: string;
      Id: string;
  }>;

  monitors: Array<{
    Manufacturer: string;
    Model: string;
    SerialNumber: string;
    ManufacturedDate: string;
    ScreenSize?: string; 
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

// [HELPER] Hàm hỗ trợ so sánh sự thay đổi chuỗi cơ bản
const generateChangeLog = (oldVal: string, newVal: string, label: string) => {
  if (!oldVal || !newVal) return null;
  const v1 = String(oldVal).trim();
  const v2 = String(newVal).trim();
  if (v1 !== v2) {
    return `Thay đổi ${label}: [${v1}] -> [${v2}]`;
  }
  return null;
};

// [HELPER MỚI] Hàm so sánh chi tiết mảng để tìm đồ bị mất / đồ thêm vào
const getDetailedDifference = (oldItems: any[], newItems: any[], keySelector: (item: any) => string, descGenerator: (item: any) => string) => {
  const oldKeys = oldItems.map(keySelector);
  const newKeys = newItems.map(keySelector);

  const removed = oldItems.filter(item => !newKeys.includes(keySelector(item))).map(descGenerator);
  const added = newItems.filter(item => !oldKeys.includes(keySelector(item))).map(descGenerator);

  const changes: string[] = [];
  if (removed.length > 0) {
      changes.push(`Bị tháo/Mất: ${removed.join(', ')}`);
  }
  if (added.length > 0) {
      changes.push(`Được gắn thêm: ${added.join(', ')}`);
  }
  return changes;
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

    // 3. Xử lý AssetType Thông Minh
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

    // 5. [LOGIC BẮT TRÁO ĐỔI] Lấy dữ liệu CŨ từ DB để so sánh
    const existingAsset = await prisma.asset.findUnique({
        where: { name: uniqueHostname }
    });

    const changeDetails: string[] = [];

    // NẾU MÁY ĐÃ TỒN TẠI (Tức là đang sync lần 2 trở đi)
    if (existingAsset) {
        const oldSpecs: any = existingAsset.customSpecs || {};
        
        // --- A. SO SÁNH RAM CHI TIẾT ---
        const ramLog = generateChangeLog(oldSpecs.ram, newRamString, "Tổng dung lượng RAM");
        if (ramLog) changeDetails.push(ramLog);

        const oldRamDetails = Array.isArray(oldSpecs.ramDetails) ? oldSpecs.ramDetails : [];
        const newRamDetails = Array.isArray(data.ramDetails) ? data.ramDetails : [];

        if (oldRamDetails.length > 0 || newRamDetails.length > 0) {
            const ramChanges = getDetailedDifference(
                oldRamDetails, 
                newRamDetails, 
                // Khóa so sánh: Gộp Slot + Hãng + Dung lượng + Tốc độ
                (item) => `${item.Slot || ''}-${item.Manufacturer || ''}-${item.Capacity || ''}-${item.Speed || ''}`,
                // Mô tả hiển thị cho Admin
                (item) => `[${item.Slot || 'Slot ẩn'}: ${item.Manufacturer || 'Unknown'} ${item.Capacity || ''} ${item.Speed ? `(${item.Speed})` : ''}]`
            );

            if (ramChanges.length > 0) {
                changeDetails.push(`Thay đổi chi tiết RAM: ${ramChanges.join(' | ')}`);
            }
        }

        // --- B. SO SÁNH CPU ---
        const cpuLog = generateChangeLog(oldSpecs.cpu, newCpuString, "CPU");
        if (cpuLog) changeDetails.push(cpuLog);

        // --- LẤY CHI TIẾT Ổ CỨNG & MÀN HÌNH TỪ BẢNG COMPONENTS ---
        const oldComponents = await prisma.assetComponent.findMany({
            where: { assetId: existingAsset.id, type: { in: ['MONITOR', 'HARD_DISK'] } }
        });
        const oldMonitors = oldComponents.filter(c => c.type === 'MONITOR');
        const oldDisks = oldComponents.filter(c => c.type === 'HARD_DISK');

        // --- C. SO SÁNH Ổ CỨNG CHI TIẾT ---
        const diskLog = generateChangeLog(oldSpecs.disk, newDiskSummary, "Tổng dung lượng Ổ cứng");
        if (diskLog) changeDetails.push(diskLog);

        const newDisks = Array.isArray(data.disks) ? data.disks : [];
        if (oldDisks.length > 0 || newDisks.length > 0) {
            const diskChanges = getDetailedDifference(
                oldDisks, 
                newDisks, 
                // Khóa so sánh: Ưu tiên SN, nếu không có thì lấy tên model
                (item) => (item.serialNumber || item.SerialNumber || "N/A") + "-" + (item.name || item.Model || ""),
                // Mô tả hiển thị
                (item) => `[${item.name || item.Model} - SN: ${item.serialNumber || item.SerialNumber || 'N/A'}]`
            );
            
            if (diskChanges.length > 0) {
                changeDetails.push(`Thay đổi Ổ cứng vật lý: ${diskChanges.join(' | ')}`);
            }
        }

        // --- D. SO SÁNH MÀN HÌNH CHI TIẾT ---
        const newMonitors = Array.isArray(data.monitors) ? data.monitors : [];
        if (oldMonitors.length > 0 || newMonitors.length > 0) {
            const monitorChanges = getDetailedDifference(
                oldMonitors, 
                newMonitors, 
                (item) => {
                    const sn = item.serialNumber || item.SerialNumber || "N/A";
                    return sn !== "0" && sn !== "N/A" ? sn : (item.name || item.Model || "Unknown");
                },
                (item) => {
                    const sn = item.serialNumber || item.SerialNumber || 'N/A';
                    const name = item.name || item.Model || 'Unknown';
                    const size = item.specs?.size || item.ScreenSize || '';
                    return `[${name} ${size ? `(${size})` : ''} - SN: ${sn}]`;
                }
            );

            if (monitorChanges.length > 0) {
                changeDetails.push(`Thay đổi Màn hình: ${monitorChanges.join(' | ')}`);
            }
        }
    }

    // 6. TRANSACTION: Cập nhật Máy + Log + Linh kiện
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
          ramDetails: data.ramDetails || [],
          gpus: data.gpus || [],
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

      // B. Ghi Log Thay đổi và Thông báo (NẾU CÓ THAY ĐỔI)
      if (changeDetails.length > 0) {
          // 1. Tạo Log bảo trì
          await tx.maintenanceLog.create({
              data: {
                  assetId: asset.id,
                  type: 'UPGRADE', 
                  description: `Hệ thống ghi nhận thay đổi phần cứng: ${changeDetails.join('. ')}`,
                  providerType: 'INTERNAL',
                  providerName: 'System Agent (Auto)',
                  cost: 0,
                  startDate: new Date(),
                  endDate: new Date(),
                  status: 'DONE'
              }
          });

          // 2. Tạo Thông báo cho Admin
          const adminUsers = await tx.user.findMany({
              where: { roleId: 'ROLE-ADMIN', isActive: true },
              select: { id: true }
          });

          if (adminUsers.length > 0) {
              const notificationData = adminUsers.map(admin => ({
                  userId: admin.id,
                  title: `⚠️ Cảnh báo phần cứng: ${uniqueHostname}`,
                  message: `Phát hiện thay đổi: ${changeDetails.join('. ')}`,
                  link: `/itam`,
                  isRead: false
              }));

              await tx.notification.createMany({
                  data: notificationData
              });
          }
      }

      // C. Xử lý Ổ cứng (Xóa cũ -> Thêm mới)
      if (Array.isArray(data.disks)) {
        await tx.assetComponent.deleteMany({
            where: { assetId: asset.id, type: "HARD_DISK" },
        });

        if (data.disks.length > 0) {
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
      }

      // D. Xử lý Màn hình (Xóa cũ -> Thêm mới)
      if (Array.isArray(data.monitors)) {
        await tx.assetComponent.deleteMany({
            where: { assetId: asset.id, type: "MONITOR" },
        });

        if (data.monitors.length > 0) {
            const monitorComponents = data.monitors.map((m, index) => ({
                assetId: asset.id,
                type: "MONITOR",
                name: m.Model || "Unknown Monitor",
                serialNumber: m.SerialNumber !== "0" && m.SerialNumber !== "N/A" ? m.SerialNumber : null,
                status: "ACTIVE",
                specs: {
                    manufacturer: m.Manufacturer,
                    manufacturedDate: m.ManufacturedDate,
                    size: m.ScreenSize || "N/A",
                    index: index + 1
                },
            }));
            await tx.assetComponent.createMany({ data: monitorComponents });
        }
      }

      // E. Xử lý Ngoại vi (Chuột/Phím)
      if (Array.isArray(data.peripherals)) {
        await tx.assetComponent.deleteMany({
            where: { 
                assetId: asset.id, 
                type: { in: ["KEYBOARD", "MOUSE", "PERIPHERAL"] } 
            },
        });

        if (data.peripherals.length > 0) {
            const periphComponents = data.peripherals.map((p) => ({
                assetId: asset.id,
                type: p.Type.toUpperCase(),
                name: p.Name,
                serialNumber: null,
                status: "ACTIVE",
                specs: {
                    brand: p.Brand,
                    connection: p.Connection,
                    deviceId: p.Id
                }
            }));
            await tx.assetComponent.createMany({ data: periphComponents });
        }
      }

      // F. Xử lý Phần mềm
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
        const io = getIO();
        if (io) {
            io.emit("asset_updated", { 
                message: `Máy ${uniqueHostname} vừa cập nhật!`, 
                hostname: uniqueHostname 
            });

            if (changeDetails.length > 0) {
                 console.log(`[CẢNH BÁO SOCKET] Phát hiện thay đổi trên ${uniqueHostname}`);
                 io.emit("hardware_alert", { 
                     message: `Cảnh báo: ${uniqueHostname} vừa thay đổi phần cứng!`, 
                     details: changeDetails 
                 });
            }
        }
    } catch (e) {
        console.error("Lỗi gửi Socket:", e);
    }

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
      page = 1, limit = 10, search, typeId, factoryId, departmentId, status, parentId,
      // [UPDATE] Nhận thêm tham số excludeComputers từ Frontend
      excludeComputers 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const whereClause: any = {};

    if (search) {
      const searchString = String(search);
      whereClause.OR = [
        { name: { contains: searchString, mode: "insensitive" } },
        { serialNumber: { contains: searchString, mode: "insensitive" } },
        { modelName: { contains: searchString, mode: "insensitive" } },
        { domainUser: { contains: searchString, mode: "insensitive" } },
        { ipAddress: { contains: searchString } },
        {
          users: {
            some: {
              fullName: { contains: searchString, mode: "insensitive" }
            }
          }
        }
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

    // [UPDATE QUAN TRỌNG] Logic lọc PC, LAPTOP, SERVER ở Backend
    if (excludeComputers === 'true') {
        whereClause.type = {
            code: {
                notIn: ['PC', 'LAPTOP', 'SERVER']
            }
        };
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
          components: {
             where: { type: { in: ['MONITOR', 'KEYBOARD', 'MOUSE'] } },
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
        components: true, 
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

// ==========================================
// 6. LẤY TÀI SẢN CỦA TÔI (MY ASSETS)
// ==========================================
export const getMyAssets = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ status: "error", message: "Vui lòng đăng nhập" });
    }

    const assets = await prisma.asset.findMany({
      where: {
        users: { some: { id: userId } }
      },
      include: {
        type: true,
        department: true,
        factory: true,
        components: {
          where: { type: { in: ['MONITOR', 'KEYBOARD', 'MOUSE'] } },
          select: { id: true, name: true, serialNumber: true, type: true, specs: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.status(200).json({ status: "success", data: assets });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
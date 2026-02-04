import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma";

// ==========================================
// 0. AGENT SYNC (POWERSHELL GỬI VỀ)
// ==========================================
export const syncAssetAgent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. [BẢO MẬT] Check API Key
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== "@Towa2026!#Secure_Agent_998811_AbCdEf") {
      return res
        .status(401)
        .json({ status: "fail", message: "Sai mã bảo mật Agent!" });
    }

    const data = req.body;

    // 2. Validate Hostname
    if (!data.hostname) {
      return res
        .status(400)
        .json({ status: "error", message: "Hostname is required" });
    }

    const uniqueHostname = data.hostname.toUpperCase().trim();

    // 3. Xử lý AssetType (Mặc định là PC nếu chưa có)
    const defaultType = await prisma.assetType.upsert({
      where: { code: "PC" },
      update: {},
      create: { code: "PC", name: "Máy tính cá nhân (Auto Import)" },
    });

    // 4. Tạo chuỗi tóm tắt ổ cứng
    let diskSummary = "N/A";
    if (data.disks && Array.isArray(data.disks)) {
      diskSummary = data.disks
        .map(
          (d: any) => `${d.SizeGB}GB ${d.MediaType ? `(${d.MediaType})` : ""}`,
        )
        .join(" + ");
    }

    // 5. TRANSACTION: Cập nhật Máy + Ổ cứng + Phần mềm
    const result = await prisma.$transaction(async (tx) => {
      // A. Upsert Asset (Cập nhật thông tin máy)
      const asset = await tx.asset.upsert({
        where: { name: uniqueHostname },
        update: {
          serialNumber:
            data.serialNumber === "Default string" ? null : data.serialNumber,
          manufacturer: data.manufacturer,
          modelName: data.model,
          osName: data.osName,
          osVersion: data.osVersion,
          ipAddress: data.ipAddress,
          macAddress: data.macAddress,
          lastSeen: new Date(),

          // [UPDATED] Lưu User Domain (VD: TOWA\UserA)
          domainUser: data.username,

          customSpecs: {
            cpu: data.cpuName,
            ram: `${data.ramGB} GB`,
            disk: diskSummary,
            lastAgentSync: data.timestamp,
          },
        },
        create: {
          name: uniqueHostname,
          serialNumber:
            data.serialNumber === "Default string" ? null : data.serialNumber,
          status: "NEW",
          typeId: defaultType.id,

          manufacturer: data.manufacturer,
          modelName: data.model,
          osName: data.osName,
          osVersion: data.osVersion,
          ipAddress: data.ipAddress,
          macAddress: data.macAddress,
          lastSeen: new Date(),

          // [UPDATED] Lưu User Domain
          domainUser: data.username,

          customSpecs: {
            cpu: data.cpuName,
            ram: `${data.ramGB} GB`,
            disk: diskSummary,
          },
        },
      });

      // B. Xử lý chi tiết linh kiện ổ cứng (Xóa cũ -> Thêm mới)
      await tx.assetComponent.deleteMany({
        where: { assetId: asset.id, type: "HARD_DISK" },
      });

      if (data.disks && data.disks.length > 0) {
        const diskComponents = data.disks.map((d: any) => ({
          assetId: asset.id,
          type: "HARD_DISK",
          name: d.Model || "Unknown Disk",
          serialNumber: d.SerialNumber !== "N/A" ? d.SerialNumber : null,
          status: "ACTIVE",
          specs: {
            sizeGB: d.SizeGB,
            interface: d.Interface,
            type: d.MediaType, // SSD/HDD
            index: d.Index,
          },
        }));
        await tx.assetComponent.createMany({ data: diskComponents });
      }

      // C. [QUAN TRỌNG] Xử lý danh sách Phần mềm (Xóa cũ -> Thêm mới)
      // Chỉ thực hiện nếu Agent có gửi danh sách phần mềm lên
      if (data.software && Array.isArray(data.software)) {
        // Xóa danh sách cũ của máy này
        await tx.installedSoftware.deleteMany({
          where: { assetId: asset.id },
        });

        // Chuẩn bị dữ liệu mới (Giới hạn 500 records để an toàn)
        const swList = data.software.slice(0, 500).map((s: any) => ({
          assetId: asset.id,
          name: s.Name || "Unknown App",
          version: s.Version,
          publisher: s.Publisher,
        }));

        // Insert vào DB
        if (swList.length > 0) {
          await tx.installedSoftware.createMany({ data: swList });
        }
      }

      return asset;
    });

    res.status(200).json({
      status: "success",
      message: `Đã đồng bộ ${uniqueHostname} (User: ${data.username || "N/A"})`,
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
export const getAllAssets = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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

    // Xây dựng bộ lọc
    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { serialNumber: { contains: String(search), mode: "insensitive" } },
        { modelName: { contains: String(search), mode: "insensitive" } },
        { manufacturer: { contains: String(search), mode: "insensitive" } },
        // Tìm kiếm theo User Domain
        { domainUser: { contains: String(search), mode: "insensitive" } },
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
        skip: skip,
        take: Number(limit),
        orderBy: { updatedAt: "desc" },
        include: {
          type: true,
          factory: true,
          department: true,

          // Lấy danh sách users quản lý (Admin gán)
          users: {
            select: { id: true, fullName: true, email: true },
          },

          parent: { select: { id: true, name: true } },

          // [UPDATED] Đếm số phần mềm để hiện Badge
          _count: { select: { children: true, softwares: true } },
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
    console.error("Get All Assets Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ==========================================
// 2. XEM CHI TIẾT TÀI SẢN (GET BY ID)
// ==========================================
export const getAssetById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        type: true,
        factory: true,
        department: true,
        users: true, // Users quản lý
        parent: true,
        children: { include: { type: true } },
        components: true,

        // [UPDATED] Lấy danh sách phần mềm để hiển thị trong Drawer
        softwares: {
          orderBy: { name: "asc" },
        },

        maintenances: { orderBy: { startDate: "desc" } },
      },
    });

    if (!asset) {
      return res
        .status(404)
        .json({ status: "error", message: "Không tìm thấy tài sản!" });
    }

    res.status(200).json({ status: "success", data: asset });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ==========================================
// 3. TẠO TÀI SẢN THỦ CÔNG (CREATE)
// ==========================================
export const createAsset = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = req.body;

    if (!data.name || !data.typeId) {
      return res
        .status(400)
        .json({ status: "error", message: "Tên và Loại tài sản là bắt buộc!" });
    }

    const exists = await prisma.asset.findUnique({
      where: { name: data.name },
    });
    if (exists) {
      return res
        .status(400)
        .json({
          status: "error",
          message: `Tên tài sản '${data.name}' đã tồn tại!`,
        });
    }

    const newAsset = await prisma.asset.create({
      data: {
        name: data.name,
        serialNumber: data.serialNumber,
        typeId: data.typeId,
        status: data.status || "NEW",

        factoryId: data.factoryId || null,
        departmentId: data.departmentId || null,

        // Cho phép nhập tay User Domain
        domainUser: data.domainUser,

        users:
          data.userIds && data.userIds.length > 0
            ? { connect: data.userIds.map((id: string) => ({ id })) }
            : undefined,

        parentId: data.parentId || null,

        manufacturer: data.manufacturer,
        modelName: data.modelName,
        customSpecs: data.customSpecs,
      },
    });

    res.status(201).json({ status: "success", data: newAsset });
  } catch (error: any) {
    console.error("Create Asset Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ==========================================
// 4. CẬP NHẬT TÀI SẢN (UPDATE)
// ==========================================
export const updateAsset = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (data.name) {
      const exists = await prisma.asset.findFirst({
        where: { name: data.name, id: { not: id } },
      });
      if (exists) {
        return res
          .status(400)
          .json({
            status: "error",
            message: `Tên '${data.name}' đã được sử dụng!`,
          });
      }
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

        // Cập nhật User Domain thủ công
        domainUser: data.domainUser,

        users: data.userIds
          ? { set: data.userIds.map((id: string) => ({ id })) }
          : undefined,

        parentId: data.parentId,

        manufacturer: data.manufacturer,
        modelName: data.modelName,
        customSpecs: data.customSpecs,
      },
    });

    res.status(200).json({ status: "success", data: updatedAsset });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ==========================================
// 5. XÓA TÀI SẢN (DELETE)
// ==========================================
export const deleteAsset = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem có phải máy cha không
    const hasChildren = await prisma.asset.count({ where: { parentId: id } });
    if (hasChildren > 0) {
      return res.status(400).json({
        status: "error",
        message:
          "Không thể xóa máy này vì đang có thiết bị khác gắn vào. Hãy gỡ bỏ thiết bị con trước!",
      });
    }

    await prisma.asset.delete({ where: { id } });

    res
      .status(200)
      .json({ status: "success", message: "Đã xóa tài sản thành công" });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
